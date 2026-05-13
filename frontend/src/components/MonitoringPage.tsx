import { useState, useEffect, useCallback } from 'react'
import type { Server, HostMetrics, MetricSnapshot, PurposeItem } from '@/types'
import { metricsApi, hostingApi, settingsApi } from '@/api/client'
import { Loader2, Server as ServerIcon, Cpu, MemoryStick, HardDrive, Activity, AlertTriangle } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, ReferenceArea } from 'recharts'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { flagImg, countryName } from '@/lib/flags'

interface MonitoringPageProps {
  servers: Server[]
}

const CHART_COLORS = {
  cpu: '#6366f1',
  ram: '#22c55e',
  disk: '#f59e0b',
  muted: '#6b7280',
}

const RANGES = [
  { value: 10, label: '10 мин' },
  { value: 60, label: '1 час' },
  { value: 480, label: '8 часов' },
  { value: 1440, label: '24 часа' },
]

function formatGib(v: number | null | undefined): string {
  if (v == null) return '—'
  return v.toFixed(1) + ' GiB'
}

function formatTime(iso: string, range: number): string {
  const d = new Date(iso)
  if (range >= 1440) {
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

function formatTimeFull(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function SpacedAreaChart({
  data,
  dataKey,
  color,
  yFormatter,
  tooltipFormatter,
  timeRange,
}: {
  data: { t: string; v: number | null }[]
  dataKey: string
  color: string
  yFormatter?: (v: number) => string
  tooltipFormatter?: (v: number) => string
  timeRange: number
}) {
  const allNull = data.every((d) => d.v == null)
  if (allNull) return null

  const gaps: { start: string; end: string }[] = []
  let inGap = false
  let gapStartIdx = -1
  for (let i = 0; i < data.length; i++) {
    if (data[i].v == null && !inGap) {
      inGap = true
      gapStartIdx = i - 1
    } else if (data[i].v != null && inGap) {
      inGap = false
      if (gapStartIdx >= 0) {
        gaps.push({ start: data[gapStartIdx].t, end: data[i].t })
      }
    }
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 2, right: 4, bottom: 2, left: 0 }}>
        <defs>
          <linearGradient id={`grad_${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.25} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="t"
          tickFormatter={(v) => formatTime(v, timeRange)}
          tick={{ fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
          minTickGap={40}
        />
        <YAxis
          tick={{ fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          domain={[0, 100]}
          tickFormatter={yFormatter}
          width={36}
        />
        <Tooltip
          contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }}
          labelFormatter={(label) => formatTimeFull(label as string)}
          formatter={(value) => {
            const v = typeof value === 'number' ? value : Number(value)
            return [tooltipFormatter ? tooltipFormatter(v) : v.toFixed(1), '']
          }}
        />
        {gaps.map((g, i) => (
          <ReferenceArea key={i} x1={g.start} x2={g.end} fill="hsl(var(--muted-foreground))" fillOpacity={0.08} />
        ))}
        <Area type="monotone" dataKey="v" stroke={color} fill={`url(#grad_${dataKey})`} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

const barColors = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316']

export function MonitoringPage({ servers }: MonitoringPageProps) {
  const [selectedServer, setSelectedServer] = useState<Server | null>(null)
  const [metrics, setMetrics] = useState<HostMetrics | null>(null)
  const [history, setHistory] = useState<MetricSnapshot[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState(10)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [hostingLogoMap, setHostingLogoMap] = useState<Record<string, string>>({})
  const [purposeList, setPurposeList] = useState<PurposeItem[]>([])

  useEffect(() => {
    Promise.all([
      hostingApi.getAll().catch(() => []),
      settingsApi.getAll().catch(() => ({}) as Record<string, string>),
    ]).then(([hostings, settings]) => {
      const map: Record<string, string> = {}
      hostings.forEach((h) => { if (h.name) map[h.name] = h.logo_url || '' })
      setHostingLogoMap(map)
      if (settings.purposes) {
        try {
          const parsed = JSON.parse(settings.purposes)
          if (Array.isArray(parsed)) setPurposeList(parsed)
        } catch {}
      }
    })
  }, [])

  const serversWithTermix = servers.filter((s) => s.termix_host_id)

  useEffect(() => {
    if (serversWithTermix.length > 0 && !selectedServer) {
      setSelectedServer(serversWithTermix[0])
    }
  }, [serversWithTermix, selectedServer])

  const fetchMetrics = useCallback(async () => {
    if (!selectedServer?.termix_host_id) return
    setLoading(true)
    setError(null)
    try {
      const hostId = Number(selectedServer.termix_host_id)
      const data = await metricsApi.getMetrics(hostId)
      if ('error' in data && data.error) {
        setError(data.error)
        setMetrics(null)
      } else {
        setMetrics(data as HostMetrics)
      }
    } catch {
      setError('Failed to fetch metrics')
    } finally {
      setLoading(false)
    }
  }, [selectedServer])

  const fetchHistory = useCallback(async (minutes: number) => {
    if (!selectedServer?.termix_host_id) return
    setLoadingHistory(true)
    try {
      const data = await metricsApi.getHistory(Number(selectedServer.termix_host_id), minutes)
      setHistory(data)
    } catch {
      // silently fail
    } finally {
      setLoadingHistory(false)
    }
  }, [selectedServer])

  useEffect(() => {
    fetchMetrics()
  }, [fetchMetrics])

  useEffect(() => {
    fetchHistory(timeRange)
  }, [fetchHistory, timeRange])

  useEffect(() => {
    if (!selectedServer?.termix_host_id) return
    const id = setInterval(fetchMetrics, 10000)
    return () => clearInterval(id)
  }, [fetchMetrics])

  useEffect(() => {
    if (!selectedServer?.termix_host_id) return
    const id = setInterval(() => fetchHistory(timeRange), 5000)
    return () => clearInterval(id)
  }, [fetchHistory, timeRange])

  const cpuData = history.map((h) => ({ t: h.t, v: h.cpu }))
  const memData = history.map((h) => ({ t: h.t, v: h.mem }))
  const diskData = history.map((h) => ({ t: h.t, v: h.disk }))

  return (
    <ErrorBoundary>
      <div className="space-y-6">
      {serversWithTermix.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
          <ServerIcon className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm">Нет серверов, подключенных к Termix</p>
          <p className="text-xs text-muted-foreground/60">Добавьте сервер и выполните синхронизацию с Termix</p>
        </div>
      ) : (
        <div className="space-y-2">
        {(() => {
          const groups: Record<string, Server[]> = {}
          for (const s of serversWithTermix) {
            if (!groups[s.purpose]) groups[s.purpose] = []
            groups[s.purpose].push(s)
          }
          const ordered = purposeList.filter((p) => groups[p.value]).map((p) => ({
            purpose: p.value,
            label: p.label,
            servers: groups[p.value],
          }))
          return ordered.map((group) => (
            <div key={group.purpose} className="flex items-start gap-1.5 sm:gap-3">
              <span className="mt-1 shrink-0 rounded border border-border/30 bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:mt-1.5 sm:px-2 sm:py-1 sm:text-[11px]">{group.label}</span>
              <div className="overflow-x-auto pb-1 -mb-1">
              <div className="flex gap-1.5 min-w-min">
                {group.servers.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setSelectedServer(s); setMetrics(null); setHistory([]) }}
                  className={`shrink-0 rounded-lg border px-2 py-1.5 text-left transition-colors text-xs sm:px-3 sm:py-2 sm:text-sm ${
                    selectedServer?.id === s.id
                      ? 'border-primary bg-primary/10 shadow-sm'
                      : 'border-border/50 bg-card hover:border-border hover:bg-accent'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <div className={`h-1.5 w-1.5 sm:h-2 sm:w-2 shrink-0 rounded-full ${selectedServer?.id === s.id ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                    {hostingLogoMap[s.hosting] && (
                      <img src={hostingLogoMap[s.hosting]} alt="" className="h-3 w-3 shrink-0 rounded object-contain sm:h-3.5 sm:w-3.5" />
                    )}
                    <span className="font-medium truncate max-w-20 sm:max-w-28">{s.hosting || s.purpose}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 text-[9px] sm:text-[10px] text-muted-foreground">
                    {s.country && flagImg(s.country) && (
                      <img src={flagImg(s.country)!} alt="" className="h-2.5 w-3.5 shrink-0 rounded object-cover sm:h-3 sm:w-4" />
                    )}
                    <span className="truncate max-w-16 sm:max-w-24">{s.country ? countryName(s.country) : ''}</span>
                    <span className="text-muted-foreground/50">·</span>
                    <span className="truncate max-w-20 sm:max-w-28 text-muted-foreground/60">{s.ip}</span>
                  </div>
                </button>
                ))}
              </div>
              </div>
            </div>
          ))
        })()}
        </div>
      )}

      {loading && !metrics && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {error && !loading && !metrics && (
        <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
          <AlertTriangle className="h-10 w-10 text-amber-400" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {metrics && (
        <div>
          {metrics.lastChecked && (() => {
            const age = (Date.now() - new Date(metrics.lastChecked).getTime()) / 1000
            return age > 120
              ? <div className="flex items-center gap-1.5 mb-3 text-xs text-amber-400"><AlertTriangle className="h-3 w-3" />Данные устарели (Termix не собирает метрики)</div>
              : null
          })()}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-border/50 bg-card p-3">
            <div className="text-[10px] text-muted-foreground mb-1">CPU</div>
            <div className="text-xl font-bold tabular-nums">{metrics.cpu?.percent != null ? metrics.cpu.percent.toFixed(1) + '%' : '—'}</div>
            {metrics.cpu?.cores && <div className="text-[10px] text-muted-foreground/60">{metrics.cpu.cores} ядер</div>}
          </div>
          <div className="rounded-xl border border-border/50 bg-card p-3">
            <div className="text-[10px] text-muted-foreground mb-1">RAM</div>
            <div className="text-xl font-bold tabular-nums">{metrics.memory != null ? metrics.memory.percent + '%' : '—'}</div>
            {metrics.memory && <div className="text-[10px] text-muted-foreground/60">{formatGib(metrics.memory.usedGiB)} / {formatGib(metrics.memory.totalGiB)}</div>}
          </div>
          <div className="rounded-xl border border-border/50 bg-card p-3">
            <div className="text-[10px] text-muted-foreground mb-1">Диск</div>
            <div className="text-xl font-bold tabular-nums">{metrics.disk != null ? metrics.disk.percent + '%' : '—'}</div>
            {metrics.disk && <div className="text-[10px] text-muted-foreground/60">{metrics.disk.usedHuman} / {metrics.disk.totalHuman}</div>}
          </div>
          <div className="rounded-xl border border-border/50 bg-card p-3">
            <div className="text-[10px] text-muted-foreground mb-1">Аптайм</div>
            <div className="text-xl font-bold tabular-nums text-emerald-400">{metrics.uptime?.formatted || '—'}</div>
          </div>
        </div>
        </div>
      )}

      <div className="flex items-center gap-1.5">
        {RANGES.map((r) => (
          <button
            key={r.value}
            onClick={() => setTimeRange(r.value)}
            className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
              timeRange === r.value ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground border border-border/50'
            }`}
          >
            {r.label}
          </button>
        ))}
        {loadingHistory && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-1" />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border/50 bg-card p-4">
          <div className="flex items-center justify-between gap-1.5 text-xs text-muted-foreground mb-2">
            <div className="flex items-center gap-1.5">
              <Cpu className="h-3 w-3" />
              <span>CPU</span>
            </div>
            <span className="text-[10px]">{metrics?.cpu?.cores ? `${metrics.cpu.cores} ядер` : ''}</span>
          </div>
          <div className="h-48">
            {cpuData.length > 0 ? (
              <SpacedAreaChart data={cpuData} dataKey="cpu" color={CHART_COLORS.cpu} yFormatter={(v) => v + '%'} tooltipFormatter={(v) => v.toFixed(1) + '%'} timeRange={timeRange} />
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-muted-foreground/60">Нет данных</div>
            )}
          </div>
        </div>
        <div className="rounded-xl border border-border/50 bg-card p-4">
          <div className="flex items-center justify-between gap-1.5 text-xs text-muted-foreground mb-2">
            <div className="flex items-center gap-1.5">
              <MemoryStick className="h-3 w-3" />
              <span>RAM</span>
            </div>
            <span className="text-[10px]">{metrics?.memory ? formatGib(metrics.memory.totalGiB) : ''}</span>
          </div>
          <div className="h-48">
            {memData.length > 0 ? (
              <SpacedAreaChart data={memData} dataKey="mem" color={CHART_COLORS.ram} yFormatter={(v) => v + '%'} tooltipFormatter={(v) => v.toFixed(1) + '%'} timeRange={timeRange} />
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-muted-foreground/60">Нет данных</div>
            )}
          </div>
        </div>
        <div className="rounded-xl border border-border/50 bg-card p-4">
          <div className="flex items-center justify-between gap-1.5 text-xs text-muted-foreground mb-2">
            <div className="flex items-center gap-1.5">
              <HardDrive className="h-3 w-3" />
              <span>Диск</span>
            </div>
            <span className="text-[10px]">{metrics?.disk ? metrics.disk.totalHuman : ''}</span>
          </div>
          <div className="h-48">
            {diskData.length > 0 ? (
              <SpacedAreaChart data={diskData} dataKey="disk" color={CHART_COLORS.disk} yFormatter={(v) => v + '%'} tooltipFormatter={(v) => v.toFixed(1) + '%'} timeRange={timeRange} />
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-muted-foreground/60">Нет данных</div>
            )}
          </div>
        </div>
      </div>

      {metrics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {metrics.network?.interfaces && metrics.network.interfaces.filter((i) => i.state === 'UP' || i.state === 'UNKNOWN').length > 0 && (
            <div className="rounded-xl border border-border/50 bg-card p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                <Activity className="h-3.5 w-3.5" />
                <span>Сетевые интерфейсы</span>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {metrics.network.interfaces
                  .filter((iface) => iface.state === 'UP' || iface.state === 'UNKNOWN')
                  .map((iface, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                        <span className="font-medium truncate">{iface.name}</span>
                      </div>
                      <span className="text-muted-foreground truncate ml-2">{iface.ip}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {metrics.processes?.top && metrics.processes.top.length > 0 && (
            <div className="rounded-xl border border-border/50 bg-card p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                <Cpu className="h-3.5 w-3.5" />
                <span>Процессы (топ {Math.min(metrics.processes.top.length, 8)})
                  <span className="ml-2 text-muted-foreground/60">всего: {metrics.processes.total}</span>
                </span>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={metrics.processes.top.slice(0, 8).map((p, i) => ({
                      name: p.command.length > 18 ? p.command.slice(0, 18) + '...' : p.command,
                      cpu: parseFloat(p.cpu) || 0,
                      fill: barColors[i % barColors.length],
                    }))}
                    layout="vertical"
                    margin={{ left: 10, right: 10 }}
                  >
                    <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }}
                      formatter={(value) => {
                        const v = typeof value === 'number' ? value.toFixed(1) : value
                        return [`${v}%`, 'CPU']
                      }}
                    />
                    <Bar dataKey="cpu" fill={CHART_COLORS.cpu} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {metrics.system && (
            <div className="rounded-xl border border-border/50 bg-card p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                <ServerIcon className="h-3.5 w-3.5" />
                <span>Система</span>
              </div>
              <div className="space-y-2 text-sm">
                {metrics.system.hostname && (
                  <div className="flex justify-between border-b border-border/30 pb-1.5">
                    <span className="text-muted-foreground">Хост</span>
                    <span className="font-medium">{metrics.system.hostname}</span>
                  </div>
                )}
                {metrics.system.os && (
                  <div className="flex justify-between border-b border-border/30 pb-1.5">
                    <span className="text-muted-foreground">ОС</span>
                    <span className="font-medium">{metrics.system.os}</span>
                  </div>
                )}
                {metrics.system.kernel && (
                  <div className="flex justify-between border-b border-border/30 pb-1.5">
                    <span className="text-muted-foreground">Ядро</span>
                    <span className="font-medium">{metrics.system.kernel}</span>
                  </div>
                )}
                {metrics.cpu?.cores && (
                  <div className="flex justify-between border-b border-border/30 pb-1.5">
                    <span className="text-muted-foreground">Ядра CPU</span>
                    <span className="font-medium">{metrics.cpu.cores}</span>
                  </div>
                )}
                {metrics.memory && (
                  <div className="flex justify-between border-b border-border/30 pb-1.5">
                    <span className="text-muted-foreground">RAM</span>
                    <span className="font-medium">{formatGib(metrics.memory.totalGiB)}</span>
                  </div>
                )}
                {metrics.disk && (
                  <div className="flex justify-between pb-1.5">
                    <span className="text-muted-foreground">Диск</span>
                    <span className="font-medium">{metrics.disk.totalHuman}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
    </ErrorBoundary>
  )
}
