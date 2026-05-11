import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react'
import { serversApi, hostingApi, uptimeApi, settingsApi } from '@/api/client'
import type { UptimeMonitorWithStatus, Server, PurposeItem } from '@/types'
import { DEFAULT_PURPOSES } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Plus, Loader2, Wifi, RefreshCw, ServerIcon } from 'lucide-react'
import { flagImg, countryName } from '@/lib/flags'

function getStatus(mon: UptimeMonitorWithStatus, retryCount: number): 'up' | 'pending' | 'down' | 'disabled' {
  if (!mon.monitor.is_active) return 'disabled'
  if (!mon.last_check) return 'pending'
  if (mon.last_check.is_up) return 'up'
  let fails = 0
  for (let i = mon.recent_checks.length - 1; i >= 0; i--) {
    if (mon.recent_checks[i].is_up) break
    fails++
  }
  return fails >= retryCount ? 'down' : 'pending'
}

function Timeline({ checks, retryCount, interval = 60 }: { checks: { id: string; is_up: boolean; response_time_ms?: number | null; error?: string | null; checked_at: string }[]; retryCount: number; interval?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [maxBars, setMaxBars] = useState(48)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const resize = () => {
      const w = el.clientWidth
      const bars = Math.max(8, Math.floor((w + 1) / 7))
      setMaxBars(bars)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const items: { id: string; color: string; title: string }[] = []
  let consecutiveFails = 0
  let prevMs: number | null = null
  const expectedMs = (interval || 60) * 1000

  for (const c of checks) {
    const ctMs = new Date(c.checked_at).getTime()
    if (prevMs !== null) {
      const gapMs = ctMs - prevMs
      if (gapMs > expectedMs * 3) {
        const missed = Math.floor(gapMs / expectedMs) - 1
        for (let n = 0; n < missed; n++) {
          const gapMs2 = prevMs + expectedMs * (n + 1)
          items.push({
            id: `gap-${c.id}-${n}`,
            color: 'bg-muted-foreground/20',
            title: `Мониторинг отключён\n${new Date(gapMs2).toLocaleString('ru-RU')}`,
          })
        }
      }
    }
    if (c.is_up) {
      consecutiveFails = 0
    } else {
      consecutiveFails++
    }
    const color = c.is_up
      ? 'bg-emerald-500/60'
      : consecutiveFails >= retryCount
        ? 'bg-red-500/60'
        : 'bg-amber-500/40'
    items.push({
      id: c.id,
      color,
      title: `${c.is_up ? '✓ Доступен' : '✗ Ошибка'}${c.response_time_ms ? ` (${c.response_time_ms}ms)` : ''}\n${c.error || ''}\n${new Date(c.checked_at).toLocaleString('ru-RU')}`,
    })
    prevMs = ctMs
  }

  if (prevMs !== null) {
    const expectedMs = (interval || 60) * 1000
    const nowMs = Date.now()
    const gapMs = nowMs - prevMs
    if (gapMs > expectedMs * 3) {
      const missed = Math.floor(gapMs / expectedMs)
      for (let n = 0; n < missed; n++) {
        const t = prevMs + expectedMs * (n + 1)
        items.push({
          id: `gap-end-${n}`,
          color: 'bg-muted-foreground/20',
          title: `Мониторинг отключён\n${new Date(t).toLocaleString('ru-RU')}`,
        })
      }
    }
  }

  const totalBars = maxBars
  const visible = items.slice(-totalBars)
  const placeholders = totalBars - visible.length

  return (
    <div ref={ref} className="flex items-end gap-px h-8">
      <style>{`@keyframes barIn{from{opacity:0;transform:scaleY(0)}to{opacity:1;transform:scaleY(1)}}`}</style>
      {Array.from({ length: placeholders }).map((_, idx) => (
        <div
          key={`p-${idx}`}
          className={`w-1.5 flex-none h-5 rounded-sm bg-muted-foreground/10`}
        />
      ))}
      {visible.map((item) => (
        <div
          key={item.id}
          className={'w-1.5 flex-none h-5 rounded-sm cursor-pointer transition-opacity hover:opacity-80 ' + item.color}
          style={{ animation: 'barIn 0.3s ease-out' }}
          title={item.title}
        />
      ))}
    </div>
  )
}

export function UptimePage() {
  const [monitors, setMonitors] = useState<UptimeMonitorWithStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [addName, setAddName] = useState('')
  const [addHost, setAddHost] = useState('')
  const [addPort, setAddPort] = useState('22')
  const [addServerId, setAddServerId] = useState('')
  const [saving, setSaving] = useState(false)
  const [servers, setServers] = useState<Server[]>([])
  const [hostingLogoMap, setHostingLogoMap] = useState<Record<string, string>>({})
  const [purposeList, setPurposeList] = useState<PurposeItem[]>(DEFAULT_PURPOSES)
  const [purposeOrder, setPurposeOrder] = useState<string[]>([])
  const [retryCount, setRetryCount] = useState(3)
  const [checkInterval, setCheckInterval] = useState(60)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [incidentDay, setIncidentDay] = useState<string | null>(null)

  useEffect(() => {
    serversApi.getAll().then(setServers).catch(() => {})
    hostingApi.getAll().then((hostings) => {
      const map: Record<string, string> = {}
      hostings.forEach((h) => { if (h.name) map[h.name] = h.logo_url || '' })
      setHostingLogoMap(map)
    }).catch(() => {})
    settingsApi.getAll().then((s) => {
      if (s.purposes) { try { setPurposeList(JSON.parse(s.purposes)) } catch {} }
      if (s.purpose_order) { try { setPurposeOrder(JSON.parse(s.purpose_order)) } catch {} }
      if (s.uptime_retry_count) setRetryCount(parseInt(s.uptime_retry_count) || 3)
      if (s.uptime_check_interval) setCheckInterval(parseInt(s.uptime_check_interval) || 60)
    }).catch(() => {})
  }, [])

  const serverMap = new Map(servers.map((s) => [s.id, s]))
  const load = useCallback(async () => {
    try {
      const data = await uptimeApi.getAll()
      setMonitors(data)
    } catch {} finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const id = setInterval(load, 15000)
    return () => clearInterval(id)
  }, [load])

  const handleAdd = async () => {
    if (!addName.trim() || !addHost.trim()) return
    setSaving(true)
    try {
      await uptimeApi.create({
        name: addName.trim(),
        host: addHost.trim(),
        port: parseInt(addPort) || 22,
        server_id: addServerId.trim() || null,
      })
      setShowAdd(false)
      setAddName('')
      setAddHost('')
      setAddPort('22')
      setAddServerId('')
      load()
    } catch {} finally {
      setSaving(false)
    }
  }

  const handleToggle = async (id: string, active: boolean) => {
    try {
      await uptimeApi.update(id, { is_active: !active })
      load()
    } catch {}
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Мониторинг аптайма</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            TCP-проверка доступности серверов
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={'h-4 w-4' + (loading ? ' animate-spin' : '')} />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : monitors.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Wifi className="h-12 w-12 mb-4 opacity-30" />
          <p className="text-lg font-medium">Нет мониторов</p>
          <p className="text-sm mt-1 mb-4">Добавьте первый монитор для отслеживания аптайма</p>
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Добавить монитор
          </Button>
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-center gap-4 text-[11px] text-muted-foreground/70">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500/60" />
              Доступен
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-500/60" />
              Недоступен
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-500/40" />
              Ожидание
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-muted-foreground/20" />
              Мониторинг отключён
            </span>
          </div>
          <div className="mb-4 flex items-center gap-4 text-[11px] text-muted-foreground/50">
            <span>Интервал проверки: <strong className="text-foreground/70">{checkInterval}с</strong></span>
            <span>Попыток до «Недоступен»: <strong className="text-foreground/70">{retryCount}</strong></span>
          </div>
          {(() => {
            const order = purposeOrder.length > 0 ? purposeOrder : ['PANEL', 'NODE', 'SERVICES']
            const groups = order
              .map((p) => ({ purpose: p, items: monitors.filter((m) => {
                const sv = m.monitor.server_id ? serverMap.get(m.monitor.server_id) : undefined
                return sv?.purpose === p
              }) }))
              .filter((g) => g.items.length > 0)
            const other = monitors.filter((m) => {
              const sv = m.monitor.server_id ? serverMap.get(m.monitor.server_id) : undefined
              return !sv || !order.includes(sv.purpose)
            })
            if (other.length > 0) groups.push({ purpose: '', items: other })
            if (groups.length === 0 && monitors.length > 0) groups.push({ purpose: '', items: monitors })

            return groups.map((group) => (
              <div key={group.purpose || '_'}>
                {group.purpose && (
                  <div className="mb-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                      {purposeList.find((p) => p.value === group.purpose)?.label || group.purpose}
                    </span>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                  {group.items.map(({ monitor, last_check, recent_checks, uptime_24h, uptime_7d }) => {
                    const status = getStatus({ monitor, last_check, recent_checks, uptime_24h, uptime_7d }, retryCount)
                    const statusColor = status === 'up' ? 'bg-emerald-500' : status === 'down' ? 'bg-red-500' : status === 'pending' ? 'bg-amber-500' : 'bg-muted-foreground'
                    const downtime = recent_checks.filter(c => !c.is_up).length
                    return (
                      <div
                        key={monitor.id}
                        className="group relative rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm overflow-hidden transition-shadow hover:shadow-md cursor-pointer"
                        onClick={() => setExpandedId(expandedId === monitor.id ? null : monitor.id)}
                      >
                        <div className={'h-1 w-full ' + statusColor} />

                        <div className="p-4 pt-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <div className="relative flex h-8 w-8 shrink-0 items-center justify-center">
                                <style>{`
                                  @keyframes pulse-green { 0%,100% { opacity:1;box-shadow:0 0 0 0 rgba(52,211,153,0.4) } 50% { opacity:0.7;box-shadow:0 0 0 6px rgba(52,211,153,0) } }
                                  @keyframes blink-red { 0%,100% { opacity:1 } 50% { opacity:0.3 } }
                                  @keyframes pulse-yellow { 0%,100% { opacity:1;box-shadow:0 0 0 0 rgba(251,191,36,0.4) } 50% { opacity:0.7;box-shadow:0 0 0 6px rgba(251,191,36,0) } }
                                `}</style>
                                <div className={`h-4 w-4 rounded-full ${
                                  status === 'up' ? 'bg-emerald-400 animate-[pulse-green_2s_ease-in-out_infinite]' :
                                  status === 'pending' ? 'bg-amber-400 animate-[pulse-yellow_1.5s_ease-in-out_infinite]' :
                                  status === 'down' ? 'bg-red-500 animate-[blink-red_0.5s_step-end_infinite]' :
                                  'bg-muted-foreground/40'
                                }`} />
                              </div>
                              <div className="min-w-0">
                                {(() => {
                                  const sv = monitor.server_id ? serverMap.get(monitor.server_id) : undefined
                                  if (sv) {
                                    return (
                                      <>
                                        <p className="font-semibold text-sm truncate leading-tight">
                                          [{flagImg(sv.country) && <img src={flagImg(sv.country)!} alt="" className="inline-block h-3.5 w-5 rounded align-text-bottom mr-0.5" />}{countryName(sv.country)}]
                                        </p>
                                        <div className="flex items-center gap-1 mt-0.5 text-[11px] text-muted-foreground/70">
                                          {hostingLogoMap[sv.hosting] ? (
                                            <img src={hostingLogoMap[sv.hosting]} alt="" className="h-3 w-3 shrink-0 rounded object-contain" />
                                          ) : (
                                            <ServerIcon className="h-3 w-3 shrink-0" />
                                          )}
                                          <span className="truncate">{sv.hosting}</span>
                                        </div>
                                      </>
                                    )
                                  }
                                  return (
                                    <>
                                      <p className="font-semibold text-sm truncate leading-tight">{monitor.name}</p>
                                      <p className="text-xs text-muted-foreground/70 truncate mt-0.5 font-mono">{monitor.host}:{monitor.port}</p>
                                    </>
                                  )
                                })()}
                              </div>
                            </div>
                            <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleToggle(monitor.id, monitor.is_active) }}
                                className={'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ' + (monitor.is_active ? 'bg-emerald-500' : 'bg-muted-foreground/30')}
                              >
                                <span className={'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ' + (monitor.is_active ? 'translate-x-4' : 'translate-x-0.5')} />
                              </button>
                            </div>
                          </div>

                          <div className="mt-4 flex items-center gap-3 text-xs">
                            <div className="flex items-center gap-1.5">
                              <div className={'h-1.5 w-1.5 rounded-full ' + (uptime_24h != null && uptime_24h < 100 ? 'bg-red-400' : 'bg-emerald-400')} />
                              <span className="text-muted-foreground">24ч</span>
                              <span className={'font-semibold tabular-nums ' + (uptime_24h != null && uptime_24h < 100 ? 'text-red-400' : 'text-emerald-400')}>
                                {uptime_24h != null ? `${uptime_24h}%` : '—'}
                              </span>
                            </div>
                            <span className="text-muted-foreground/20">|</span>
                            <div className="flex items-center gap-1.5">
                              <div className={'h-1.5 w-1.5 rounded-full ' + (uptime_7d != null && uptime_7d < 100 ? 'bg-red-400' : 'bg-emerald-400')} />
                              <span className="text-muted-foreground">7д</span>
                              <span className={'font-semibold tabular-nums ' + (uptime_7d != null && uptime_7d < 100 ? 'text-red-400' : 'text-emerald-400')}>
                                {uptime_7d != null ? `${uptime_7d}%` : '—'}
                              </span>
                            </div>
                            <span className="text-muted-foreground/20">|</span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-muted-foreground">Последний</span>
                              <span className="font-semibold tabular-nums">{last_check?.response_time_ms != null ? `${last_check.response_time_ms}ms` : '—'}</span>
                            </div>
                            <span className="text-muted-foreground/20">|</span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-muted-foreground">Средний</span>
                              <span className="font-semibold tabular-nums">{(() => {
                                const dayAgo = Date.now() - 86400000
                                const withTime = recent_checks.filter(c => c.response_time_ms != null && new Date(c.checked_at).getTime() > dayAgo)
                                if (withTime.length === 0) return '—'
                                const avg = Math.round(withTime.reduce((s, c) => s + c.response_time_ms!, 0) / withTime.length)
                                return `${avg}ms`
                              })()}</span>
                            </div>
                          </div>

                          <div className="mt-3">
                            <Timeline checks={recent_checks} retryCount={retryCount} interval={checkInterval} />
                          </div>

                          <div className="mt-2.5 flex items-center justify-between text-[11px]">
                            <div className="flex items-center gap-2 text-muted-foreground/60">
                              {!monitor.is_active ? (
                                <span className="text-muted-foreground/40">Отключён</span>
                              ) : status === 'up' ? (
                                <>
                                  <span className="text-emerald-400">Доступен</span>
                                  <span>·</span>
                                  <span>{last_check ? new Date(last_check.checked_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}</span>
                                </>
                              ) : status === 'pending' ? (
                                <span className="text-amber-400">Ожидание</span>
                              ) : (
                                <>
                                  <span className="text-red-400">Недоступен</span>
                                  <span>·</span>
                                  <span>{last_check ? new Date(last_check.checked_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}</span>
                                </>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground/40">
                              {downtime > 0 && <span className="text-red-400/60">{downtime} сбоев</span>}
                            </div>
                          </div>
                        </div>

                        {expandedId === monitor.id && (() => {
                          const daysMap = new Map<string, { dateKey: string; up: number; down: number; total: number; avgPing: number; pingCount: number; checks: { is_up: boolean; checked_at: string; response_time_ms?: number | null; error?: string | null; id: string }[] }>()
                          for (const c of recent_checks) {
                            const day = new Date(c.checked_at).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })
                            const dateKey = new Date(c.checked_at).toISOString().split('T')[0]
                            let entry = daysMap.get(day)
                            if (!entry) {
                              entry = { dateKey, up: 0, down: 0, total: 0, avgPing: 0, pingCount: 0, checks: [] }
                              daysMap.set(day, entry)
                            }
                            entry.total++
                            if (c.is_up) entry.up++
                            else entry.down++
                            if (c.response_time_ms != null) {
                              entry.avgPing += c.response_time_ms
                              entry.pingCount++
                            }
                            entry.checks.push(c)
                          }
                          for (const entry of daysMap.values()) {
                            if (entry.pingCount > 0) entry.avgPing = Math.round(entry.avgPing / entry.pingCount)
                            else entry.avgPing = 0
                          }

                          const days = Array.from(daysMap.entries()).reverse()

                          return (
                            <div className="border-t border-border/40 px-4 py-3 space-y-4">
                              <div>
                                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50 mb-2">Статистика по дням</div>
                                <div className="space-y-2">
                                  {days.map(([day, stats]) => {
                                    const checks = stats.checks.sort((a, b) => new Date(a.checked_at).getTime() - new Date(b.checked_at).getTime())

                                    const dayStart = new Date(checks[0].checked_at)
                                    dayStart.setHours(0, 0, 0, 0)

                                    const segMs = 3600000

                                    const now = new Date()
                                    const isToday = dayStart.toDateString() === now.toDateString()
                                    const currentHour = now.getHours()

                                    const hourLabels = [
                                      { label: '00', position: 0 },
                                      { label: '06', position: 25 },
                                      { label: '12', position: 50 },
                                      { label: '18', position: 75 },
                                    ].filter(hl => !isToday || hl.label < `${currentHour}`.padStart(2, '0'))

                                    const segments: { cls: string; title: string }[] = []
                                    for (let si = 0; si < 24; si++) {
                                      if (isToday && si >= currentHour) {
                                        segments.push({ cls: 'bg-transparent', title: '' })
                                        continue
                                      }
                                      const segStart = dayStart.getTime() + segMs * si
                                      const segEnd = segStart + segMs
                                      const inSeg = checks.filter((c) => {
                                        const ct = new Date(c.checked_at).getTime()
                                        return ct >= segStart && ct < segEnd
                                      })
                                      if (inSeg.length === 0) {
                                        segments.push({ cls: 'bg-muted-foreground/15', title: 'Нет данных' })
                                      } else {
                                        const segUpCount = inSeg.filter((c) => c.is_up).length
                                        const pct = segUpCount / inSeg.length
                                        const lastErr = inSeg.filter(c => !c.is_up && c.error).map(c => c.error).pop()

                                        let cls: string
                                        if (pct === 1) {
                                          const avg = inSeg.filter(c => c.response_time_ms != null)
                                          const segAvg = avg.length > 0 ? Math.round(avg.reduce((s, c) => s + c.response_time_ms!, 0) / avg.length) : 0
                                          if (segAvg < 50) cls = 'bg-emerald-500/80'
                                          else if (segAvg < 100) cls = 'bg-emerald-500/60'
                                          else if (segAvg < 200) cls = 'bg-emerald-500/45'
                                          else cls = 'bg-emerald-500/30'
                                        } else if (pct >= 0.5) {
                                          cls = 'bg-amber-500/40'
                                        } else {
                                          cls = 'bg-red-500/60'
                                        }

                                        segments.push({
                                          cls,
                                          title: `✓ ${segUpCount}/${inSeg.length}\n${lastErr ? `✗ ${lastErr}` : ''}\n${new Date(segStart).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`,
                                        })
                                      }
                                    }

                                    const isSelected = incidentDay === stats.dateKey

                                    return (
                                      <div
                                        key={day}
                                        className={`cursor-pointer rounded px-1 -mx-1 transition-colors hover:bg-accent/20 ${isSelected ? 'bg-accent/30' : ''}`}
                                        onClick={() => setIncidentDay(incidentDay === stats.dateKey ? null : stats.dateKey)}
                                      >
                                        <div className="flex items-center gap-2 text-[11px]">
                                          <span className="w-16 shrink-0 text-muted-foreground/60">{day}</span>
                                          <div className="flex flex-col flex-1 min-w-0 gap-0">
                                            <div className="flex gap-px h-3 items-stretch rounded-sm overflow-hidden">
                                              {segments.map((seg, si) => (
                                                <div key={si} className={`flex-1 ${seg.cls}`} title={seg.title} />
                                              ))}
                                            </div>
                                            {hourLabels.length > 0 && (
                                              <div className="relative h-2 mt-0.5">
                                                {hourLabels.map((hl, i) => (
                                                  <span key={i} className="absolute text-[8px] leading-none text-muted-foreground/40" style={{ left: `${hl.position}%`, transform: 'translateX(-50%)' }}>
                                                    {hl.label}
                                                  </span>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                          <span className="w-8 text-right shrink-0 font-semibold tabular-nums text-emerald-400">{stats.up}</span>
                                          {stats.down > 0 ? (
                                            <span className="w-8 text-right shrink-0 font-semibold tabular-nums text-red-400">{stats.down}</span>
                                          ) : (
                                            <span className="w-8 text-right shrink-0 text-muted-foreground/30">—</span>
                                          )}
                                          <span className="w-8 text-right shrink-0 text-muted-foreground/40">{stats.total}</span>
                                          <span className="w-12 text-right shrink-0 tabular-nums text-muted-foreground/60">
                                            {stats.pingCount > 0 ? `${stats.avgPing}ms` : '—'}
                                          </span>
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>

                              <div>
                                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50 mb-2">Тепловая карта</div>
                                {(() => {
                                  const dayPct = new Map<string, { pct: number; total: number }>()
                                  for (const c of recent_checks) {
                                    const d = new Date(c.checked_at).toISOString().split('T')[0]
                                    if (!dayPct.has(d)) dayPct.set(d, { pct: 0, total: 0 })
                                    const e = dayPct.get(d)!
                                    e.total++
                                    if (c.is_up) e.pct++
                                  }
                                  for (const e of dayPct.values()) {
                                    if (e.total > 0) e.pct = e.pct / e.total
                                  }
                                  const dates = Array.from(dayPct.keys()).sort()
                                  if (dates.length === 0) return <div className="text-[11px] text-muted-foreground/40">Нет данных</div>

                                  const firstDate = new Date(dates[0])
                                  firstDate.setDate(firstDate.getDate() - firstDate.getDay())
                                  const lastDate = new Date()
                                  const weeks: { dates: string[]; month: string }[] = []
                                  let cursor = new Date(firstDate)
                                  while (cursor <= lastDate) {
                                    const week: string[] = []
                                    for (let d = 0; d < 7; d++) {
                                      week.push(cursor.toISOString().split('T')[0])
                                      cursor.setDate(cursor.getDate() + 1)
                                    }
                                    const monthLabel = new Date(week[0]).toLocaleDateString('ru-RU', { month: 'short' }).replace('.', '')
                                    weeks.push({ dates: week, month: weeks.length === 0 || new Date(week[0]).getMonth() !== new Date(weeks[weeks.length - 1].dates[0]).getMonth() ? monthLabel : '' })
                                  }

                                  return (
                                    <div className="overflow-x-auto">
                                      <div className="inline-flex gap-px">
                                        <div className="flex flex-col gap-px">
                                          <div className="h-3" />
                                          {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d => (
                                            <div key={d} className="h-2.5 flex items-center text-[8px] text-muted-foreground/40 leading-none">{d}</div>
                                          ))}
                                        </div>
                                        {weeks.map((wk, wi) => (
                                          <div key={wi} className="flex flex-col gap-px items-center">
                                            <div className="h-3 text-[8px] text-muted-foreground/40 leading-none flex items-end">
                                              {wk.month}
                                            </div>
                                            {wk.dates.map((date) => {
                                              const data = dayPct.get(date)
                                              const pct = data ? data.pct : 0
                                              const total = data ? data.total : 0
                                              const dayNum = parseInt(date.split('-')[2])
                                              const color = total === 0 ? 'bg-muted-foreground/10'
                                                : pct === 1 ? 'bg-emerald-500/70'
                                                : pct >= 0.5 ? 'bg-amber-500/50'
                                                : 'bg-red-500/60'
                                              return (
                                                <div
                                                  key={date}
                                                  className="h-2.5 w-2.5 rounded-sm relative overflow-hidden"
                                                  title={`${date}: ${total > 0 ? `${Math.round(pct * 100)}%` : 'нет данных'}${total > 0 ? ` (${total} проверок)` : ''}`}
                                                >
                                                  <div className={`absolute inset-0 ${color}`} />
                                                  <span className="absolute inset-0 flex items-center justify-center text-[5px] font-bold leading-none text-white/80" style={{ textShadow: '0 0 2px rgba(0,0,0,0.4)' }}>
                                                    {dayNum}
                                                  </span>
                                                </div>
                                              )
                                            })}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )
                                })()}
                              </div>

                              {incidentDay && (() => {
                                const dayChecks = recent_checks.filter(c => new Date(c.checked_at).toISOString().split('T')[0] === incidentDay)
                                  .sort((a, b) => new Date(a.checked_at).getTime() - new Date(b.checked_at).getTime())
                                if (dayChecks.length === 0) return null

                                const incidents: { start: string; end: string | null; duration: string; errors: string[]; count: number }[] = []
                                let current: typeof incidents[0] | null = null
                                for (const c of dayChecks) {
                                  if (!c.is_up) {
                                    if (!current) {
                                      current = { start: c.checked_at, end: null, duration: '', errors: c.error ? [c.error] : [], count: 1 }
                                    } else {
                                      current.count++
                                      if (c.error && !current.errors.includes(c.error)) current.errors.push(c.error)
                                    }
                                  } else {
                                    if (current) {
                                      current.end = c.checked_at
                                      const durMin = Math.round((new Date(current.end).getTime() - new Date(current.start).getTime()) / 60000)
                                      current.duration = durMin > 0 ? `${durMin} мин` : '<1 мин'
                                      incidents.push(current)
                                      current = null
                                    }
                                  }
                                }
                                if (current) {
                                  current.duration = 'продолжается'
                                  incidents.push(current)
                                }

                                if (incidents.length === 0) return null

                                const fmt = (iso: string) => new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })

                                return (
                                  <div>
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                                        Инциденты за {incidentDay}
                                      </span>
                                      <button onClick={() => setIncidentDay(null)} className="text-muted-foreground/40 hover:text-foreground text-xs">✕</button>
                                    </div>
                                    <div className="space-y-1.5">
                                      {incidents.map((inc, i) => (
                                        <div key={i} className="flex items-center gap-2 text-[11px] rounded bg-red-500/5 px-2 py-1.5">
                                          <span className="text-red-400/80 whitespace-nowrap">
                                            {fmt(inc.start)}{inc.end ? `–${fmt(inc.end)}` : '–...'}
                                          </span>
                                          <span className="text-muted-foreground whitespace-nowrap">· {inc.duration}</span>
                                          {inc.errors.length > 0 && (
                                            <>
                                              <span className="text-muted-foreground">·</span>
                                              <span className="text-muted-foreground/70 truncate min-w-0" title={inc.errors.join(', ')}>
                                                {inc.errors[0]}
                                              </span>
                                            </>
                                          )}
                                          <span className="text-muted-foreground/40 ml-auto whitespace-nowrap">{inc.count} сбоев</span>
                                        </div>
                                      ))}
                                      {incidents.length === 0 && (
                                        <div className="text-[11px] text-muted-foreground/40 py-2 text-center">Сбоев не было</div>
                                      )}
                                    </div>
                                  </div>
                                )
                              })()}
                            </div>
                          )
                        })()}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          })()}
        </>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Добавить монитор</DialogTitle>
            <DialogDescription>
              Укажите хост и порт для TCP-проверки
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Название (например, Main Panel)"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
            />
            <div className="flex gap-2">
              <Input
                placeholder="Хост (IP или домен)"
                value={addHost}
                onChange={(e) => setAddHost(e.target.value)}
                className="flex-1"
              />
              <Input
                placeholder="Порт"
                value={addPort}
                onChange={(e) => setAddPort(e.target.value)}
                className="w-24"
              />
            </div>
            <Input
              placeholder="ID сервера (необязательно)"
              value={addServerId}
              onChange={(e) => setAddServerId(e.target.value)}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowAdd(false)}>Отмена</Button>
              <Button onClick={handleAdd} disabled={saving || !addName.trim() || !addHost.trim()}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Добавить
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
