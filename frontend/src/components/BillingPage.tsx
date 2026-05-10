import { useMemo, useState, useEffect, useCallback } from 'react'
import type { Server, PurposeItem } from '@/types'
import { CreditCard, DollarSign, CalendarDays, ChevronLeft, ChevronRight, AlertTriangle, Clock, List, Grid3X3, Loader2, CheckCircle2, Ban, ExternalLink } from 'lucide-react'
import { settingsApi, hostingApi, serversApi, exchangeRatesApi } from '@/api/client'
import type { Hosting } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { flagImg, countryName } from '@/lib/flags'
import { RATES_UPDATED_EVENT } from '@/lib/utils'

const CURRENCY_SYMBOLS: Record<string, string> = { RUB: '₽', USD: '$', EUR: '€' }

interface BillingPageProps {
  servers: Server[]
  onServersChange?: () => void
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

function addCycle(dateStr: string, cycle: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  switch (cycle) {
    case 'daily': d.setDate(d.getDate() + 1); break
    case 'weekly': d.setDate(d.getDate() + 7); break
    case 'monthly': d.setMonth(d.getMonth() + 1); break
    case 'yearly': d.setFullYear(d.getFullYear() + 1); break
  }
  return d.toISOString().split('T')[0]
}

export function BillingPage({ servers, onServersChange }: BillingPageProps) {
  const [view, setView] = useState<'calendar' | 'list'>('calendar')
  const [monthOffset, setMonthOffset] = useState(0)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [baseCurrency, setBaseCurrency] = useState('RUB')
  const [rates, setRates] = useState<Record<string, number>>({ USD: 1, RUB: 85, EUR: 0.92 })
  const [loadingRates, setLoadingRates] = useState(true)
  const [hostingLogoMap, setHostingLogoMap] = useState<Record<string, string>>({})
  const [hostingUrlMap, setHostingUrlMap] = useState<Record<string, string>>({})
  const [purposeMap, setPurposeMap] = useState<Record<string, string>>({})

  useEffect(() => {
    Promise.all([
      settingsApi.getAll().catch(() => ({ base_currency: 'RUB' })),
      exchangeRatesApi.get().catch(() => null),
      hostingApi.getAll().catch(() => [] as Hosting[]),
    ]).then(([rawSettings, data, hostings]) => {
      const settings = rawSettings as Record<string, string>
      if (settings.base_currency) setBaseCurrency(settings.base_currency)
      if (data?.rates) setRates(data.rates)
      const logoMap: Record<string, string> = {}
      const urlMap: Record<string, string> = {}
      hostings.forEach((h) => {
        if (h.name) { logoMap[h.name] = h.logo_url || ''; urlMap[h.name] = h.url || '' }
      })
      setHostingLogoMap(logoMap)
      setHostingUrlMap(urlMap)
      if (settings.purposes) {
        try {
          const items: PurposeItem[] = JSON.parse(settings.purposes)
          const pmap: Record<string, string> = {}
          items.forEach((p) => { pmap[p.value] = p.label })
          setPurposeMap(pmap)
        } catch {}
      }
    }).finally(() => setLoadingRates(false))

    const handleRatesUpdated = () => {
      exchangeRatesApi.get().then((data) => {
        if (data?.rates) setRates(data.rates)
      }).catch(() => {})
    }
    window.addEventListener(RATES_UPDATED_EVENT, handleRatesUpdated)
    return () => window.removeEventListener(RATES_UPDATED_EVENT, handleRatesUpdated)
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
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const [paidDialogServer, setPaidDialogServer] = useState<Server | null>(null)
  const [paidDialogDate, setPaidDialogDate] = useState('')
  const [notRenewDialogServer, setNotRenewDialogServer] = useState<Server | null>(null)

  const openPaidDialog = useCallback((server: Server) => {
    if (!server.next_payment) return
    setPaidDialogServer(server)
    setPaidDialogDate(addCycle(server.next_payment, server.cycle))
  }, [])

  const confirmPaid = useCallback(async () => {
    const server = paidDialogServer
    if (!server) return
    setActionLoading(server.id)
    try {
      await serversApi.update(server.id, { next_payment: paidDialogDate })
      onServersChange?.()
      setPaidDialogServer(null)
    } catch {
      console.error('Failed to mark as paid')
    } finally {
      setActionLoading(null)
    }
  }, [paidDialogServer, paidDialogDate, onServersChange])

  const openNotRenewDialog = useCallback((server: Server) => {
    setNotRenewDialogServer(server)
  }, [])

  const confirmNotRenew = useCallback(async () => {
    const server = notRenewDialogServer
    if (!server) return
    setActionLoading(server.id)
    try {
      await serversApi.update(server.id, { not_renewing: !server.not_renewing })
      onServersChange?.()
      setNotRenewDialogServer(null)
    } catch {
      console.error('Failed to toggle renew')
    } finally {
      setActionLoading(null)
    }
  }, [notRenewDialogServer, onServersChange])

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
        <div className="flex gap-4">
          <div className="flex-1 min-w-0">
            <div className="rounded-xl border border-border/50 bg-card shadow-sm overflow-hidden">
              <div className="flex items-center justify-between bg-accent/20 px-4 py-3">
                <button
                  onClick={() => { setMonthOffset(monthOffset - 1); setSelectedDate(null) }}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  {MONTHS[month === 0 ? 11 : month - 1]}
                </button>
                <h2 className="text-sm font-semibold">
                  {MONTHS[month]} {year}
                </h2>
                <button
                  onClick={() => { setMonthOffset(monthOffset + 1); setSelectedDate(null) }}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {MONTHS[month === 11 ? 0 : month + 1]}
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="p-2">
                <div className="grid grid-cols-7 mb-1">
                  {DAYS.map((d) => (
                    <div key={d} className="py-1 text-center text-[10px] font-medium text-muted-foreground/60">
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-0.5">
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
                        className={`relative flex flex-col rounded-lg p-1.5 text-xs transition-all min-h-[80px] ${
                          isSelected
                            ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-105'
                            : dayPayments
                            ? 'bg-accent/60 hover:bg-accent hover:shadow-sm'
                            : 'hover:bg-accent/30'
                        }`}
                      >
                        <span className={`text-left leading-none mb-0.5 ${isToday && !isSelected ? 'font-bold' : ''} ${isWeekend && !isSelected && !dayPayments ? 'text-muted-foreground/50' : ''}`}>
                          {day}
                        </span>
                        {isToday && !isSelected && (
                          <span className="h-0.5 w-2 rounded-full bg-primary mb-0.5" />
                        )}
                        {dayPayments && (
                          <div className="flex flex-col gap-0.5 w-full">
                            {dayPayments.slice(0, 2).map((s, idx) => (
                              <div key={s.id} className={`leading-tight text-[10px] ${!isSelected && idx > 0 ? 'border-t border-border/20 pt-0.5' : ''}`}>
                                <div className={`font-semibold truncate ${isSelected ? 'text-primary-foreground' : 'text-foreground'}`}>
                                  {purposeMap[s.purpose] || s.purpose}
                                </div>
                                <div className={`truncate ${isSelected ? 'text-primary-foreground/75' : 'text-foreground/70'}`}>
                                  {flagImg(s.country) && <img src={flagImg(s.country)!} alt="" className="inline-block h-2.5 w-3.5 rounded align-text-bottom mr-0.5" />}
                                  {countryName(s.country)}
                                </div>
                                <div className={`truncate ${isSelected ? 'text-primary-foreground/75' : 'text-foreground/70'}`}>
                                  {hostingLogoMap[s.hosting] ? (
                                    <img src={hostingLogoMap[s.hosting]} alt="" className="inline-block h-3 w-3 rounded object-contain align-text-bottom mr-0.5" />
                                  ) : null}
                                  {s.hosting}
                                </div>
                                {s.cost ? (
                                  <div className={`font-semibold ${isSelected ? 'text-primary-foreground' : 'text-emerald-400'}`}>
                                    {currencySymbol}{toBaseCurrency(s.cost, s.currency || 'USD').toFixed(2)}
                                  </div>
                                ) : null}
                              </div>
                            ))}
                            {dayPayments.length > 2 && (
                              <span className={`text-[10px] ${isSelected ? 'text-primary-foreground/60' : 'text-foreground/60'}`}>
                                +{dayPayments.length - 2}
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
          </div>

          <div className="w-80 shrink-0">
            <div className="rounded-xl border border-border/50 bg-card shadow-sm h-full">
              <div className="border-b border-border/50 px-4 py-3">
                <h3 className="text-sm font-semibold">Ближайшие оплаты</h3>
              </div>
              {visiblePayments.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-muted-foreground">
                  <CalendarDays className="mb-2 h-8 w-8 text-primary/30" />
                  <p className="text-xs">Нет оплат</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50 max-h-[500px] overflow-y-auto">
                  {visiblePayments.map((s) => {
                    const daysLeft = daysUntil(s.next_payment!)
                    const isOverdue = daysLeft < 0
                    const isUrgent = daysLeft >= 0 && daysLeft <= 1
                    const isWarning = daysLeft >= 2 && daysLeft <= 7
                    const rowClass = isOverdue ? 'bg-red-500/5' : isUrgent ? 'bg-red-500/5' : isWarning ? 'bg-amber-500/5' : ''
                    return (
                      <div key={s.id} className={`px-4 py-3 hover:bg-accent/20 transition-colors ${rowClass}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-semibold ${isOverdue ? 'text-red-400' : isUrgent ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-foreground'}`}>
                                {s.next_payment!.slice(8, 10)}.{s.next_payment!.slice(5, 7)}
                              </span>
                              <span className={`text-[10px] ${isOverdue ? 'text-red-400' : isUrgent ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-muted-foreground'}`}>
                                {isOverdue ? `Просрочено на ${Math.abs(daysLeft)} дн` : `Осталось ${daysLeft} дн`}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                              <span className="text-sm font-medium truncate">{purposeMap[s.purpose] || s.purpose}</span>
                              {s.not_renewing && (
                                <span className="flex items-center gap-1 rounded-full bg-rose-500/10 px-1.5 py-0.5 text-[10px] text-rose-400">
                                  <Ban className="h-2.5 w-2.5" />
                                  Не продляется
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                              <span>{flagImg(s.country) && <img src={flagImg(s.country)!} alt="" className="inline-block h-2.5 w-3.5 rounded align-text-bottom" />}{countryName(s.country)}</span>
                              <span>·</span>
                              <span>{hostingLogoMap[s.hosting] ? <img src={hostingLogoMap[s.hosting]} alt="" className="inline-block h-3 w-3 rounded object-contain align-text-bottom" /> : null}{s.hosting}</span>
                              {hostingUrlMap[s.hosting] && (
                                <a href={hostingUrlMap[s.hosting]} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-muted-foreground/50 hover:text-foreground transition-colors" title={hostingUrlMap[s.hosting]}>
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {s.cost && <span className="font-semibold text-emerald-400">{currencySymbol}{toBaseCurrency(s.cost, s.currency || 'USD').toFixed(2)}</span>}
                              <span className="ml-1">{getCycleLabel(s.cycle)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => openPaidDialog(s)}
                              disabled={actionLoading === s.id || s.not_renewing}
                              className="rounded p-1 text-emerald-400 hover:text-emerald-300 disabled:opacity-30"
                              title="Оплачен"
                            >
                              {actionLoading === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                            </button>
                            <button
                              onClick={() => openNotRenewDialog(s)}
                              disabled={actionLoading === s.id}
                              className={'rounded p-1 disabled:opacity-30 ' + (s.not_renewing ? 'text-rose-400 hover:text-rose-300' : 'text-muted-foreground hover:text-foreground')}
                              title={s.not_renewing ? 'Возобновить продление' : 'Не продлять'}
                            >
                              <Ban className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
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
                          <span className="font-medium">{purposeMap[s.purpose] || s.purpose} {flagImg(s.country) && <img src={flagImg(s.country)!} alt="" className="inline-block h-3 w-4 rounded align-text-bottom" />}{countryName(s.country)} {hostingLogoMap[s.hosting] ? <img src={hostingLogoMap[s.hosting]} alt="" className="inline-block h-3.5 w-3.5 rounded object-contain align-text-bottom" /> : null}{s.hosting}</span>
                          {s.not_renewing && (
                            <span className="flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-xs text-rose-400">
                              <Ban className="h-3 w-3" />
                              Не продляется
                            </span>
                          )}
                          {isOverdue && !s.not_renewing && (
                            <span className="flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs text-red-400">
                              <AlertTriangle className="h-3 w-3" />
                              Просрочено
                            </span>
                          )}
                          {isSoon && !isOverdue && !s.not_renewing && (
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

                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          {s.cost && (
                            <div className="text-sm font-semibold">
                              {currencySymbol}{toBaseCurrency(s.cost, s.currency || 'USD').toFixed(2)}
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground">{getCycleLabel(s.cycle)}</div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openPaidDialog(s)}
                            disabled={actionLoading === s.id || s.not_renewing}
                            className="rounded p-1 text-emerald-400 hover:text-emerald-300 disabled:opacity-30"
                            title="Оплачен"
                          >
                            {actionLoading === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                          </button>
                          <button
                            onClick={() => openNotRenewDialog(s)}
                            disabled={actionLoading === s.id}
                            className={'rounded p-1 disabled:opacity-30 ' + (s.not_renewing ? 'text-rose-400 hover:text-rose-300' : 'text-muted-foreground hover:text-foreground')}
                            title={s.not_renewing ? 'Возобновить продление' : 'Не продлять'}
                          >
                            <Ban className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <Dialog open={paidDialogServer !== null} onOpenChange={(open) => !open && setPaidDialogServer(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Подтверждение оплаты</DialogTitle>
            <DialogDescription>
              {paidDialogServer && (
                <span>{paidDialogServer.purpose} [{countryName(paidDialogServer.country)}] {paidDialogServer.hosting}</span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Следующая оплата</label>
              <Input
                type="date"
                value={paidDialogDate}
                onChange={(e) => setPaidDialogDate(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Рассчитано автоматически на основе цикла. Можно изменить вручную.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPaidDialogServer(null)}>
                Отмена
              </Button>
              <Button onClick={confirmPaid} disabled={actionLoading !== null}>
                {actionLoading ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Обработка...</> : 'Подтвердить оплату'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={notRenewDialogServer !== null} onOpenChange={(open) => !open && setNotRenewDialogServer(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{notRenewDialogServer?.not_renewing ? 'Возобновить продление' : 'Не продлять сервер'}</DialogTitle>
            <DialogDescription>
              {notRenewDialogServer && (
                <span>
                  {notRenewDialogServer.not_renewing
                    ? `Сервер ${notRenewDialogServer.purpose} [${countryName(notRenewDialogServer.country)}] ${notRenewDialogServer.hosting} будет продлеваться автоматически`
                    : `Сервер ${notRenewDialogServer.purpose} [${countryName(notRenewDialogServer.country)}] ${notRenewDialogServer.hosting} не будет продлеваться после текущей оплаты`}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setNotRenewDialogServer(null)}>
              Отмена
            </Button>
            <Button variant={notRenewDialogServer?.not_renewing ? 'default' : 'destructive'} onClick={confirmNotRenew} disabled={actionLoading !== null}>
              {actionLoading ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Обработка...</> : (notRenewDialogServer?.not_renewing ? 'Возобновить' : 'Не продлять')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
