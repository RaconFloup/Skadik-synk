import { useMemo, useState, useEffect } from 'react'
import type { Server } from '@/types'
import { CreditCard, DollarSign, CalendarDays, ChevronLeft, ChevronRight, AlertTriangle, Clock, List, Grid3X3, Loader2 } from 'lucide-react'
import { settingsApi, hostingApi } from '@/api/client'
import type { Hosting } from '@/types'

const CURRENCY_SYMBOLS: Record<string, string> = { RUB: '₽', USD: '$', EUR: '€' }

interface BillingPageProps {
  servers: Server[]
}

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

function getCycleLabel(cycle: string): string {
  switch (cycle) {
    case 'daily': return '/день'
    case 'weekly': return '/нед'
    case 'monthly': return '/мес'
    case 'yearly': return '/год'
    default: return ''
  }
}

function daysUntil(dateStr: string): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T00:00:00')
  return Math.ceil((target.getTime() - now.getTime()) / 86400000)
}

export function BillingPage({ servers }: BillingPageProps) {
  const [view, setView] = useState<'calendar' | 'list'>('calendar')
  const [monthOffset, setMonthOffset] = useState(0)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [baseCurrency, setBaseCurrency] = useState('RUB')
  const [rates, setRates] = useState<Record<string, number>>({ USD: 1, RUB: 85, EUR: 0.92 })
  const [loadingRates, setLoadingRates] = useState(true)
  const [hostingLogoMap, setHostingLogoMap] = useState<Record<string, string>>({})

  useEffect(() => {
    Promise.all([
      settingsApi.getAll().catch(() => ({ base_currency: 'RUB' })),
      fetch('https://api.exchangerate-api.com/v4/latest/USD').then((r) => r.json()).catch(() => null),
      hostingApi.getAll().catch(() => [] as Hosting[]),
    ]).then(([settings, data, hostings]) => {
      if (settings.base_currency) setBaseCurrency(settings.base_currency)
      if (data?.rates) setRates(data.rates)
      const map: Record<string, string> = {}
      hostings.forEach((h) => { if (h.name) map[h.name] = h.logo_url || '' })
      setHostingLogoMap(map)
    }).finally(() => setLoadingRates(false))
  }, [])

  function toBaseCurrency(cost: number, currency: string): number {
    const costInUsd = cost / (rates[currency] || 1)
    return costInUsd * (rates[baseCurrency] || 1)
  }

  const currencySymbol = CURRENCY_SYMBOLS[baseCurrency] || baseCurrency

  const now = new Date()
  const currentMonth = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)

  const serversWithPayments = useMemo(() => {
    return servers.filter((s) => s.next_payment && s.status === 'active')
  }, [servers])

  const sortedPayments = useMemo(() => {
    return [...serversWithPayments].sort((a, b) => {
      if (!a.next_payment || !b.next_payment) return 0
      return a.next_payment.localeCompare(b.next_payment)
    })
  }, [serversWithPayments])

  const paymentsByDate = useMemo(() => {
    const map: Record<string, Server[]> = {}
    serversWithPayments.forEach((s) => {
      if (!s.next_payment) return
      if (!map[s.next_payment]) map[s.next_payment] = []
      map[s.next_payment].push(s)
    })
    return map
  }, [serversWithPayments])

  const paymentsByMonth = useMemo(() => {
    const groups: Record<string, Server[]> = {}
    sortedPayments.forEach((s) => {
      if (!s.next_payment) return
      const key = s.next_payment.slice(0, 7)
      if (!groups[key]) groups[key] = []
      groups[key].push(s)
    })
    return groups
  }, [sortedPayments])

  const currentMonthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`
  const visiblePayments = paymentsByMonth[currentMonthKey] || []

  const totalMonthly = serversWithPayments.reduce((sum, s) => sum + toBaseCurrency(s.cost || 0, s.currency || 'USD'), 0)
  const overdueCount = sortedPayments.filter((s) => s.next_payment && daysUntil(s.next_payment) < 0).length

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfWeek = (new Date(year, month, 1).getDay() + 6) % 7

  const todayStr = now.toISOString().split('T')[0]

  function getCalendarDays(): (number | null)[] {
    const days: (number | null)[] = []
    for (let i = 0; i < firstDayOfWeek; i++) days.push(null)
    for (let d = 1; d <= daysInMonth; d++) days.push(d)
    return days
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border/50 bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CreditCard className="h-4 w-4" />
            <span>Активных оплат</span>
          </div>
          <p className="mt-2 text-3xl font-bold">{serversWithPayments.length}</p>
        </div>
        <div className="rounded-xl border border-border/50 bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <DollarSign className="h-4 w-4" />
            <span>Общая стоимость /мес</span>
          </div>
          <p className="mt-2 text-3xl font-bold">{loadingRates ? <Loader2 className="inline h-6 w-6 animate-spin" /> : <>{currencySymbol}{totalMonthly.toFixed(2)}</>}</p>
        </div>
        <div className="rounded-xl border border-border/50 bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarDays className="h-4 w-4" />
            <span>Оплат в {MONTHS[currentMonth.getMonth()].toLowerCase()}</span>
          </div>
          <p className="mt-2 text-3xl font-bold">{visiblePayments.length}</p>
        </div>
        <div className="rounded-xl border border-border/50 bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4" />
            <span>Просрочено</span>
          </div>
          <p className={`mt-2 text-3xl font-bold ${overdueCount > 0 ? 'text-red-400' : ''}`}>{overdueCount}</p>
        </div>
      </div>

      <div className="flex gap-1">
        <button
          onClick={() => setView('calendar')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            view === 'calendar' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Grid3X3 className="h-4 w-4" />
          Календарь
        </button>
        <button
          onClick={() => setView('list')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            view === 'list' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <List className="h-4 w-4" />
          Список
        </button>
      </div>

      {view === 'calendar' && (
        <>
          <div className="rounded-xl border border-border/50 bg-card shadow-sm overflow-hidden">
            <div className="flex items-center justify-between bg-accent/20 px-6 py-4">
              <button
                onClick={() => { setMonthOffset(monthOffset - 1); setSelectedDate(null) }}
                className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4" />
                {MONTHS[month === 0 ? 11 : month - 1]}
              </button>
              <h2 className="text-lg font-semibold">
                {MONTHS[month]} {year}
              </h2>
              <button
                onClick={() => { setMonthOffset(monthOffset + 1); setSelectedDate(null) }}
                className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {MONTHS[month === 11 ? 0 : month + 1]}
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4">
              <div className="grid grid-cols-7 mb-2">
                {DAYS.map((d) => (
                  <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground/60">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {getCalendarDays().map((day, i) => {
                  if (day === null) return <div key={`e-${i}`} />
                  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  const dayPayments = paymentsByDate[dateStr]
                  const isSelected = selectedDate === dateStr
                  const isToday = dateStr === todayStr
                  const isWeekend = (new Date(year, month, day).getDay() === 0 || new Date(year, month, day).getDay() === 6)

                  return (
                    <button
                      key={dateStr}
                      onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                      className={`relative flex flex-col rounded-xl p-2 text-xs transition-all min-h-[72px] ${
                        isSelected
                          ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-105'
                          : dayPayments
                          ? 'bg-accent/50 hover:bg-accent hover:shadow-sm'
                          : 'hover:bg-accent/30'
                      }`}
                    >
                      <span className={`text-left leading-none mb-1 ${isToday && !isSelected ? 'font-bold' : ''} ${isWeekend && !isSelected && !dayPayments ? 'text-muted-foreground/50' : ''}`}>
                        {day}
                      </span>
                      {isToday && !isSelected && (
                        <span className="h-0.5 w-3 rounded-full bg-primary mb-1" />
                      )}
                      {dayPayments && (
                        <div className="flex flex-col gap-0.5 w-full">
                          {dayPayments.slice(0, 3).map((s) => (
                            <div key={s.id} className="flex items-center gap-1 leading-tight">
                              {hostingLogoMap[s.hosting] ? (
                                <img src={hostingLogoMap[s.hosting]} alt="" className="h-3.5 w-3.5 rounded shrink-0 object-contain" />
                              ) : (
                                <span className="h-3.5 w-3.5 rounded shrink-0 bg-accent" />
                              )}
                              <span className={`truncate ${isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                                {s.purpose}
                              </span>
                            </div>
                          ))}
                          {dayPayments.length > 3 && (
                            <span className={`text-[10px] ${isSelected ? 'text-primary-foreground/60' : 'text-muted-foreground/60'}`}>
                              +{dayPayments.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {selectedDate && (
            <div className="rounded-xl border border-border/50 bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h4 className="text-sm font-medium">
                  Оплаты <span className="text-primary">{selectedDate}</span>
                </h4>
                <span className="text-xs text-muted-foreground">
                  {daysUntil(selectedDate) < 0 ? 'Просрочено' : `Осталось ${daysUntil(selectedDate)} дн`}
                </span>
              </div>
              {(paymentsByDate[selectedDate] || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Нет оплат на эту дату</p>
              ) : (
                <div className="space-y-2">
                  {paymentsByDate[selectedDate].map((s) => {
                    const daysLeft = daysUntil(s.next_payment!)
                    const isOverdue = daysLeft < 0
                    const isSoon = daysLeft >= 0 && daysLeft <= 3
                    return (
                      <div key={s.id} className="flex items-center justify-between rounded-lg bg-accent/30 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium">{s.purpose} [{s.country}]</span>
                          <span className="text-xs text-muted-foreground">{s.hosting}</span>
                          {isOverdue && (
                            <span className="flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs text-red-400">
                              <AlertTriangle className="h-3 w-3" />
                              Просрочено
                            </span>
                          )}
                          {isSoon && !isOverdue && (
                            <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400">
                              <Clock className="h-3 w-3" />
                              {daysLeft === 0 ? 'Сегодня' : daysLeft === 1 ? 'Завтра' : `Через ${daysLeft} дн`}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <span className="text-muted-foreground">{getCycleLabel(s.cycle)}</span>
                          {s.cost && <span className="font-medium">{currencySymbol}{toBaseCurrency(s.cost, s.currency || 'USD').toFixed(2)}</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {view === 'list' && (
        <div className="rounded-xl border border-border/50 bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border/50 px-6 py-4">
            <button
              onClick={() => setMonthOffset(monthOffset - 1)}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
              {MONTHS[month === 0 ? 11 : month - 1]}
            </button>
            <h2 className="text-lg font-semibold">
              {MONTHS[month]} {year}
            </h2>
            <button
              onClick={() => setMonthOffset(monthOffset + 1)}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {MONTHS[month === 11 ? 0 : month + 1]}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {visiblePayments.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-muted-foreground">
              <CalendarDays className="mb-3 h-10 w-10 text-primary/30" />
              <p className="text-sm">Нет оплат в этом месяце</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {visiblePayments.map((s) => {
                const daysLeft = daysUntil(s.next_payment!)
                const isOverdue = daysLeft < 0
                const isSoon = daysLeft >= 0 && daysLeft <= 3

                return (
                  <div key={s.id} className="group flex items-center gap-4 px-6 py-4 transition-colors hover:bg-accent/20">
                    <div className={`flex w-14 flex-col items-center rounded-lg py-2 ${
                      isOverdue
                        ? 'bg-red-500/10 text-red-400'
                        : isSoon
                        ? 'bg-amber-500/10 text-amber-400'
                        : 'bg-accent/50'
                    }`}>
                      <span className="text-lg font-bold">{s.next_payment!.slice(8, 10)}</span>
                      <span className="text-[10px] uppercase leading-tight opacity-70">
                        {MONTHS[parseInt(s.next_payment!.slice(5, 7)) - 1].slice(0, 3)}
                      </span>
                    </div>

                    <div className="flex flex-1 items-center gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{s.purpose} [{s.country}]</span>
                          {isOverdue && (
                            <span className="flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs text-red-400">
                              <AlertTriangle className="h-3 w-3" />
                              Просрочено
                            </span>
                          )}
                          {isSoon && !isOverdue && (
                            <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400">
                              <Clock className="h-3 w-3" />
                              {daysLeft === 0 ? 'Сегодня' : daysLeft === 1 ? 'Завтра' : `Через ${daysLeft} дн`}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{s.hosting}</span>
                          <span className="text-border">·</span>
                          <span>{s.ip}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        {s.cost && (
                          <div className="text-sm font-semibold">
                            {currencySymbol}{toBaseCurrency(s.cost, s.currency || 'USD').toFixed(2)}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">{getCycleLabel(s.cycle)}</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
