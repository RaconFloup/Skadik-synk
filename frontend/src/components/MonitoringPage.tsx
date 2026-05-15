import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Server, HostMetrics, MetricSnapshot, PurposeItem } from '@/types'
import { metricsApi, hostingApi, settingsApi } from '@/api/client'
import { Loader2, Server as ServerIcon, Cpu, MemoryStick, HardDrive, Activity, AlertTriangle, Wifi, Layers, Users } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceArea } from 'recharts'
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

function formatBytes(bytes: number): string {
  if (bytes == null) return '—'
  if (bytes >= 1 << 30) return (bytes / (1 << 30)).toFixed(1) + ' GiB'
  if (bytes >= 1 << 20) return (bytes / (1 << 20)).toFixed(1) + ' MiB'
  if (bytes >= 1 << 10) return (bytes / (1 << 10)).toFixed(1) + ' KiB'
  return bytes + ' B'
}

function findGaps(data: Record<string, any>[], valueKeys: string[], timeKey = "t") {
  const gaps: { start: string; end: string }[] = []
  let inGap = false
  let gapStartIdx = -1
  for (let i = 0; i < data.length; i++) {
    const allNull = valueKeys.every(k => data[i][k] == null)
    if (allNull && !inGap) {
      inGap = true
      gapStartIdx = i - 1
    } else if (!allNull && inGap) {
      inGap = false
      if (gapStartIdx >= 0) {
        gaps.push({ start: data[gapStartIdx][timeKey], end: data[i][timeKey] })
      }
    }
  }
  return gaps
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
          <pattern id="gapStripes" patternUnits="userSpaceOnUse" width="20" height="20" patternTransform="rotate(45)">
            <rect width="20" height="20" fill="hsl(var(--muted-foreground))" fillOpacity="0.03" />
            <circle cx="10" cy="10" r="2" fill="hsl(var(--muted-foreground))" fillOpacity="0.1" />
          </pattern>
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
          formatter={(value: any) => {
            const v = typeof value === 'number' ? value : Number(value)
            return [tooltipFormatter ? tooltipFormatter(v) : v.toFixed(1), '']
          }}
        />
        {gaps.map((g, i) => (
          <ReferenceArea key={i} x1={g.start} x2={g.end} fill="url(#gapStripes)" />
        ))}
        <Area type="monotone" dataKey="v" stroke={color} fill={`url(#grad_${dataKey})`} strokeWidth={2} dot={false} isAnimationActive={true} animationDuration={100} connectNulls={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}


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

  const lastHistory = useMemo(() => {
    return history.length > 0 ? history[history.length - 1] : null
  }, [history])

  const serversWithTermix = servers.filter((s) => s.termix_host_id)
  const serverByIp = useMemo(() => {
    const map = new Map<string, Server>()
    for (const s of servers) {
      if (s.ip) map.set(s.ip, s)
    }
    return map
  }, [servers])

  const purposeLabelByValue = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of purposeList) {
      map.set(p.value, p.label)
    }
    return map
  }, [purposeList])

  useEffect(() => {
    if (serversWithTermix.length === 0) return
    const savedId = localStorage.getItem('monitoring_selected_server')
    const match = savedId ? serversWithTermix.find(s => s.id === savedId) : null
    if (match) {
      setSelectedServer(match)
    } else if (!selectedServer) {
      setSelectedServer(serversWithTermix[0])
    }
  }, [serversWithTermix]) // eslint-disable-line react-hooks/exhaustive-deps

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
  const ramSwapData = history.map((h) => ({ t: h.t, ram: h.mem, swap: h.swap }))
  const diskData = history.map((h) => ({ t: h.t, v: h.disk }))

  return (
    <ErrorBoundary>
      <div className="space-y-6">
      {serversWithTermix.length === 0 && servers.length > 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
          <ServerIcon className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm">Нет доступных серверов для мониторинга</p>
          <p className="text-xs text-muted-foreground/60">Добавьте SSH-доступ к серверу в его настройках</p>
        </div>
      ) : serversWithTermix.length === 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-xl border border-border/50 bg-card p-3 animate-pulse">
              <div className="flex items-center gap-1 mb-1">
                <div className="h-3 w-3 rounded bg-muted-foreground/10" />
                <div className="h-[10px] w-12 rounded bg-muted-foreground/10" />
              </div>
              <div className="h-[28px] w-20 rounded bg-muted-foreground/10 mt-2" />
              <div className="h-[12px] w-full rounded bg-muted-foreground/10 mt-3" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
        {(() => {
          const groups: Record<string, Server[]> = {}
          for (const s of serversWithTermix) {
            if (!groups[s.purpose]) groups[s.purpose] = []
            groups[s.purpose].push(s)
          }
          const ordered = purposeList.length > 0
            ? purposeList.filter((p) => groups[p.value]).map((p) => ({
                purpose: p.value,
                label: p.label,
                servers: groups[p.value],
              }))
            : Object.entries(groups).map(([k, v]) => ({
                purpose: k,
                label: k,
                servers: v,
              }))
          return ordered.map((group) => (
            <div key={group.purpose} className="flex items-start gap-1.5 sm:gap-3">
              <span className="mt-1 w-14 shrink-0 rounded border border-border/30 bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:mt-1.5 sm:w-20 sm:px-2 sm:py-1 sm:text-[11px]">{group.label}</span>
              <div className="overflow-x-auto pb-1 -mb-1">
              <div className="flex gap-1.5 min-w-min">
                {group.servers.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { localStorage.setItem('monitoring_selected_server', s.id); setSelectedServer(s); setMetrics(null); setHistory([]) }}
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

      {(loading && !metrics) || (!loading && !metrics && !error) ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-xl border border-border/50 bg-card p-3 animate-pulse">
              <div className="flex items-center gap-1 mb-1">
                <div className="h-3 w-3 rounded bg-muted-foreground/10" />
                <div className="h-[10px] w-12 rounded bg-muted-foreground/10" />
              </div>
              <div className="h-[28px] w-20 rounded bg-muted-foreground/10 mt-2" />
              <div className="h-[12px] w-full rounded bg-muted-foreground/10 mt-3" />
            </div>
          ))}
        </div>
      ) : null}

      {error && !loading && !metrics && (
        <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
          <AlertTriangle className="h-6 w-6 text-amber-400" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {metrics && (
        <div>
          {metrics.lastChecked && (() => {
            const age = (Date.now() - new Date(metrics.lastChecked).getTime()) / 1000
            return age > 120
              ? <div className="flex items-center gap-1.5 mb-3 text-xs text-amber-400"><AlertTriangle className="h-3 w-3" />Данные устарели (сервер не отвечает)</div>
              : null
          })()}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {(metrics.cpu || metrics.load) && (
              <div className="rounded-xl border border-border/50 bg-card p-3">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
                  <Cpu className="h-3 w-3" />
                  <span>Нагрузка</span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <div className="text-xl font-bold tabular-nums">{lastHistory?.cpu != null ? lastHistory.cpu.toFixed(1) + '%' : metrics.cpu?.percent != null ? metrics.cpu.percent.toFixed(1) + '%' : '—'}</div>
                  {metrics.cpu?.cores && <span className="text-[10px] text-muted-foreground/60 shrink-0">{metrics.cpu.cores} ядер</span>}
                </div>
                {metrics.load && (
                  <div className="mt-1.5 pt-1.5 border-t border-border/30 text-[11px] tabular-nums leading-tight text-muted-foreground/80 flex gap-3">
                    <span>1м <strong>{metrics.load['1m']?.toFixed(2) ?? '—'}</strong></span>
                    <span>5м <strong>{metrics.load['5m']?.toFixed(2) ?? '—'}</strong></span>
                    <span>15м <strong>{metrics.load['15m']?.toFixed(2) ?? '—'}</strong></span>
                  </div>
                )}
              </div>
            )}
            {(metrics.memory || metrics.swap) && (
              <div className="rounded-xl border border-border/50 bg-card p-3">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
                  <MemoryStick className="h-3 w-3" />
                  <span>Память</span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <div className="text-xl font-bold tabular-nums">{lastHistory?.mem != null ? lastHistory.mem.toFixed(1) + '%' : metrics.memory?.percent != null ? metrics.memory.percent.toFixed(1) + '%' : '—'}</div>
                  {metrics.memory && <span className="text-[10px] text-muted-foreground/60 shrink-0">{formatGib(metrics.memory.usedGiB)} / {formatGib(metrics.memory.totalGiB)}</span>}
                </div>
                {metrics.swap && (
                  <div className="mt-1.5 pt-1.5 border-t border-border/30 text-[11px] text-muted-foreground/80 flex items-center gap-2">
                    <span>Swap</span>
                    <strong className="tabular-nums">{metrics.swap.percent != null ? metrics.swap.percent.toFixed(1) + '%' : '—'}</strong>
                    {metrics.swap.totalGiB > 0 && <span className="text-[10px] text-muted-foreground/60">{formatGib(metrics.swap.usedGiB)} / {formatGib(metrics.swap.totalGiB)}</span>}
                  </div>
                )}
              </div>
            )}
            {(metrics.disk || metrics.diskio) && (
              <div className="rounded-xl border border-border/50 bg-card p-3">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
                  <HardDrive className="h-3 w-3" />
                  <span>Диск</span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <div className="text-xl font-bold tabular-nums">{lastHistory?.disk != null ? lastHistory.disk.toFixed(1) + '%' : metrics.disk?.percent != null ? metrics.disk.percent.toFixed(1) + '%' : '—'}</div>
                  {metrics.disk && <span className="text-[10px] text-muted-foreground/60 shrink-0">{metrics.disk.usedHuman} / {metrics.disk.totalHuman}</span>}
                </div>
                {metrics.diskio && (
                  <div className="mt-1.5 pt-1.5 border-t border-border/30 text-[11px] text-muted-foreground/80 space-y-0.5">
                    <div className="flex gap-3">
                      <span>R <strong className="tabular-nums">{metrics.diskio.readMbPerSec != null ? formatBytes(metrics.diskio.readMbPerSec * 1024 * 1024) + '/с' : metrics.diskio.readMb != null ? metrics.diskio.readMb.toFixed(1) + ' MB' : '—'}</strong></span>
                      <span>W <strong className="tabular-nums">{metrics.diskio.writeMbPerSec != null ? formatBytes(metrics.diskio.writeMbPerSec * 1024 * 1024) + '/с' : metrics.diskio.writeMb != null ? metrics.diskio.writeMb.toFixed(1) + ' MB' : '—'}</strong></span>
                    </div>
                    <div className="flex gap-3">
                      <span>IOPS R <strong className="tabular-nums">{metrics.diskio.readIops != null ? metrics.diskio.readIops.toFixed(0) : '—'}</strong></span>
                      <span>W <strong className="tabular-nums">{metrics.diskio.writeIops != null ? metrics.diskio.writeIops.toFixed(0) : '—'}</strong></span>
                    </div>
                    <div className="flex gap-3">
                      <span>Утил. <strong className="tabular-nums">{metrics.diskio.utilizationPercent != null ? metrics.diskio.utilizationPercent.toFixed(1) + '%' : '—'}</strong></span>
                      <span>Очередь <strong className="tabular-nums">{metrics.diskio.iopsInProgress ?? '—'}</strong></span>
                    </div>
                  </div>
                )}
              </div>
            )}
            {(metrics.netstat || (metrics.traffic_speed?.length ?? 0) > 0) && (
              <div className="rounded-xl border border-border/50 bg-card p-3">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
                  <Wifi className="h-3 w-3" />
                  <span>Сеть</span>
                </div>
                {metrics.netstat && (
                  <div className="text-xs tabular-nums leading-tight text-muted-foreground/80">
                    <span>EST <strong className="font-bold">{metrics.netstat.established ?? '—'}</strong></span>
                    <span className="ml-3">TW <strong className="font-bold">{metrics.netstat.timeWait ?? '—'}</strong></span>
                  </div>
                )}
                {(metrics.traffic_speed?.length ?? 0) > 0 && (() => {
                  const mainIface = metrics.traffic_speed!.find(n => !n.name.startsWith('lo') && !n.name.startsWith('veth') && !n.name.startsWith('br') && !n.name.startsWith('docker')) || metrics.traffic_speed![0]
                  if (!mainIface) return null
                  return (
                    <div className={`${metrics.netstat ? 'mt-1.5 pt-1.5 border-t border-border/30' : ''} text-[11px] tabular-nums text-muted-foreground/80 flex gap-3`}>
                      <span title={mainIface.name}>↓ RX <strong>{formatBytes(mainIface.rxBytesPerSec)}/с</strong></span>
                      <span title={mainIface.name}>↑ TX <strong>{formatBytes(mainIface.txBytesPerSec)}/с</strong></span>
                    </div>
                  )
                })()}
              </div>
            )}
            {metrics.uptime && (
              <div className="rounded-xl border border-border/50 bg-card p-3">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
                  <ServerIcon className="h-3 w-3" />
                  <span>Система</span>
                </div>
                <div className="text-lg font-bold tabular-nums text-emerald-400 leading-tight">{metrics.uptime.formatted}</div>
                {metrics.system?.hostname && <div className="text-[10px] text-muted-foreground/60 mt-0.5 truncate">{metrics.system.hostname}</div>}
                <div className="mt-1.5 pt-1.5 border-t border-border/30 text-[10px] text-muted-foreground/70 space-y-0.5">
                  {metrics.system?.os && <div className="truncate">{metrics.system.os}</div>}
                  <div className="flex flex-wrap gap-x-2">
                    {metrics.cpu?.cores && <span>{metrics.cpu.cores} ядер</span>}
                    {metrics.memory?.totalGiB && <span>{formatGib(metrics.memory.totalGiB)} RAM</span>}
                    {metrics.disk?.totalHuman && <span>{metrics.disk.totalHuman} диск</span>}
                  </div>
                </div>
              </div>
            )}
            {metrics.docker && (
              <div className="rounded-xl border border-border/50 bg-card p-3">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
                  <Layers className="h-3 w-3" />
                  <span>Docker</span>
                </div>
                <div className="text-xl font-bold tabular-nums">{metrics.docker.running ?? '—'}<span className="text-sm text-muted-foreground/60">/{metrics.docker.total ?? '—'}</span></div>
                <div className="text-[10px] text-muted-foreground/60">контейнеров</div>
                {metrics.docker.containers && metrics.docker.containers.length > 0 && (
                  <div className="max-h-24 overflow-y-auto space-y-0.5 border-t border-border/30 pt-1.5 mt-1">
                    {metrics.docker.containers.map((c: {name: string, state: string, status: string, health?: string | null}, i: number) => (
                      <div key={i} className="flex items-center gap-1 text-[10px] leading-tight">
                        <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          c.state === 'running' ? (c.health === 'healthy' ? 'bg-green-500' : c.health === 'unhealthy' ? 'bg-red-500' : 'bg-emerald-400')
                          : c.state === 'exited' ? 'bg-gray-400'
                          : c.state === 'paused' ? 'bg-amber-400'
                          : 'bg-red-400'
                        }`} />
                        <span className="truncate text-muted-foreground/80">{c.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
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
            {ramSwapData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={ramSwapData} margin={{ top: 2, right: 4, bottom: 2, left: 0 }}>
                  <defs>
                    <linearGradient id="grad_ram" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.ram} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={CHART_COLORS.ram} stopOpacity={0} />
                    </linearGradient>
                    <pattern id="gapStripes" patternUnits="userSpaceOnUse" width="20" height="20" patternTransform="rotate(45)">
                      <rect width="20" height="20" fill="hsl(var(--muted-foreground))" fillOpacity="0.03" />
                      <circle cx="10" cy="10" r="2" fill="hsl(var(--muted-foreground))" fillOpacity="0.1" />
                    </pattern>
                  </defs>
                  <XAxis dataKey="t" tickFormatter={(v) => formatTime(v, timeRange)} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={40} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={(v) => v + '%'} width={36} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }} labelFormatter={(label) => formatTimeFull(label as string)} formatter={(value: any, name: any) => [typeof value === 'number' ? value.toFixed(1) + '%' : '—', name === 'ram' ? 'RAM' : 'Swap']} />
                  {findGaps(ramSwapData, ['ram', 'swap']).map((g, i) => (
                    <ReferenceArea key={i} x1={g.start} x2={g.end} fill="url(#gapStripes)" />
                  ))}
                  <Area type="monotone" dataKey="ram" stroke={CHART_COLORS.ram} fill="url(#grad_ram)" strokeWidth={2} dot={false} isAnimationActive={true} animationDuration={100} connectNulls={false} />
                  <Area type="monotone" dataKey="swap" stroke="#a78bfa" fill="none" strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={true} animationDuration={100} connectNulls={false} />
                </AreaChart>
              </ResponsiveContainer>
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
          {metrics.traffic && metrics.traffic.length > 0 && (
            <div className="rounded-xl border border-border/50 bg-card p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                <Activity className="h-3.5 w-3.5" />
                <span>Сеть</span>
              </div>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {metrics.traffic.map((iface, i) => {
                  const speed = metrics.traffic_speed?.find((s) => s.name === iface.name)
                  return (
                    <div key={i} className="rounded-lg bg-muted/50 px-3 py-2 text-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                          <span className="font-medium truncate">{iface.name}</span>
                        </div>
                        <div className="flex items-center gap-3 text-muted-foreground tabular-nums">
                          <span title="Всего получено">↓ {formatBytes(iface.rxBytes)}</span>
                          <span title="Всего отправлено">↑ {formatBytes(iface.txBytes)}</span>
                        </div>
                      </div>
                      {speed && (
                        <div className="flex items-center justify-end gap-3 text-[10px] text-muted-foreground/60 tabular-nums mt-0.5">
                          <span title="Скорость приёма">↓ {formatBytes(speed.rxBytesPerSec)}/с</span>
                          <span title="Скорость передачи">↑ {formatBytes(speed.txBytesPerSec)}/с</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {metrics.processes?.top && metrics.processes.top.length > 0 && (
            <div className="rounded-xl border border-border/50 bg-card p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <Cpu className="h-3.5 w-3.5" />
                <span>Процессы (топ {Math.min(metrics.processes.top.length, 20)})</span>
              </div>
              <div className="max-h-56 overflow-y-auto text-[11px]">
                <table className="w-full">
                  <thead>
                    <tr className="text-muted-foreground/50 border-b border-border/30">
                      <th className="text-left py-1 pr-2 font-medium">USER</th>
                      <th className="text-right py-1 px-2 font-medium w-12">CPU%</th>
                      <th className="text-right py-1 px-2 font-medium w-12">MEM%</th>
                      <th className="text-left py-1 pl-2 font-medium">CMD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.processes.top.slice(0, 20).map((p, i) => (
                      <tr key={i} className="border-b border-border/20 hover:bg-muted/30">
                        <td className="py-1 pr-2 text-muted-foreground/70 truncate max-w-16">{p.user}</td>
                        <td className="py-1 px-2 text-right tabular-nums font-medium">{parseFloat(p.cpu as string).toFixed(1)}</td>
                        <td className="py-1 px-2 text-right tabular-nums text-muted-foreground/80">{parseFloat(p.mem as string).toFixed(1)}</td>
                        <td className="py-1 pl-2 truncate max-w-48" title={p.command}>{p.command}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {metrics.sshsessions && metrics.sshsessions.total > 0 && (
            <div className="rounded-xl border border-border/50 bg-card p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <Users className="h-3.5 w-3.5" />
                <span>SSH-сессии ({metrics.sshsessions.total})</span>
              </div>
              <div className="text-[11px] space-y-1">
                <div className="text-[10px] text-muted-foreground/50 font-medium mb-0.5">← Входящие</div>
                {metrics.sshsessions.users.map((s, i) => (
                  <div key={`u${i}`} className="flex items-center gap-2 py-1 border-b border-border/20">
                    <span className="font-medium text-emerald-400">{s.user}</span>
                    <span className="text-muted-foreground/50">{s.terminal}</span>
                    {s.host && s.host !== ':0' && <span className="text-muted-foreground/60 ml-auto tabular-nums">{s.host}</span>}
                  </div>
                ))}
                {metrics.sshsessions.connections.filter(c => c.direction === 'in').map((c, i) => {
                  const srv = serverByIp.get(c.ip)
                  return (
                    <div key={`in${i}`} className="group relative flex items-center gap-1.5 py-1 border-b border-border/20 last:border-0">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${c.monitor ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                      <span className="text-muted-foreground/60 tabular-nums">{c.ip}</span>
                      {srv && (
                        <>
                          {flagImg(srv.country) && <img src={flagImg(srv.country)!} alt="" className="h-2.5 w-3.5 shrink-0 rounded object-cover" />}
                          {hostingLogoMap[srv.hosting] && <img src={hostingLogoMap[srv.hosting]} alt="" className="h-3 w-3 shrink-0 rounded object-contain" />}
                          <span className="text-[10px] text-muted-foreground/50 truncate max-w-20">{purposeLabelByValue.get(srv.purpose) || srv.purpose}</span>
                          <div className="invisible group-hover:visible absolute left-0 top-full z-50 mt-1 w-56 rounded-lg border border-border/50 bg-popover px-3 py-2 text-[11px] text-popover-foreground shadow-lg">
                            <div className="font-medium mb-1">{purposeLabelByValue.get(srv.purpose) || srv.purpose}</div>
                            <div className="space-y-0.5 text-muted-foreground">
                              <div className="flex items-center gap-1">{flagImg(srv.country) && <img src={flagImg(srv.country)!} alt="" className="h-2.5 w-3.5 rounded object-cover" />}{countryName(srv.country)}</div>
                              <div>{srv.hosting}</div>
                              <div className="tabular-nums">{srv.ip}</div>
                              <div className={srv.status === 'active' ? 'text-emerald-400' : 'text-muted-foreground/50'}>{srv.status}</div>
                              {srv.notes && <div className="italic text-muted-foreground/50 truncate">{srv.notes}</div>}
                            </div>
                          </div>
                        </>
                      )}
                      <span className="text-muted-foreground/40 text-[10px] ml-auto">{c.monitor ? 'мониторинг' : 'без логина'}</span>
                    </div>
                  )
                })}
                {(metrics.sshsessions.connections.some(c => c.direction === 'out')) && (
                  <>
                    <div className="text-[10px] text-muted-foreground/50 font-medium mt-2 mb-0.5">→ Исходящие</div>
                    {metrics.sshsessions.connections.filter(c => c.direction === 'out').map((c, i) => {
                      const srv = serverByIp.get(c.ip)
                      return (
                        <div key={`out${i}`} className="group relative flex items-center gap-1.5 py-1 last:border-0">
                          <span className="h-2 w-2 rounded-full shrink-0 bg-muted-foreground/30" />
                          <span className="text-muted-foreground/60 tabular-nums">{c.ip}</span>
                          {srv && (
                            <>
                              {flagImg(srv.country) && <img src={flagImg(srv.country)!} alt="" className="h-2.5 w-3.5 shrink-0 rounded object-cover" />}
                              {hostingLogoMap[srv.hosting] && <img src={hostingLogoMap[srv.hosting]} alt="" className="h-3 w-3 shrink-0 rounded object-contain" />}
                              <span className="text-[10px] text-muted-foreground/50 truncate max-w-20">{purposeLabelByValue.get(srv.purpose) || srv.purpose}</span>
                              <div className="invisible group-hover:visible absolute left-0 top-full z-50 mt-1 w-56 rounded-lg border border-border/50 bg-popover px-3 py-2 text-[11px] text-popover-foreground shadow-lg">
                                <div className="font-medium mb-1">{purposeLabelByValue.get(srv.purpose) || srv.purpose}</div>
                                <div className="space-y-0.5 text-muted-foreground">
                                  <div className="flex items-center gap-1">{flagImg(srv.country) && <img src={flagImg(srv.country)!} alt="" className="h-2.5 w-3.5 rounded object-cover" />}{countryName(srv.country)}</div>
                                  <div>{srv.hosting}</div>
                                  <div className="tabular-nums">{srv.ip}</div>
                                  <div className={srv.status === 'active' ? 'text-emerald-400' : 'text-muted-foreground/50'}>{srv.status}</div>
                                  {srv.notes && <div className="italic text-muted-foreground/50 truncate">{srv.notes}</div>}
                                </div>
                              </div>
                            </>
                          )}
                          <span className="text-muted-foreground/40 text-[10px] ml-auto">порт 22</span>
                        </div>
                      )
                    })}
                  </>
                )}
              </div>
            </div>
          )}

          {history.length > 1 && history.some((h) => h.traffic_speed) && (
            <div className="rounded-xl border border-border/50 bg-card p-4 col-span-1 lg:col-span-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                <Activity className="h-3.5 w-3.5" />
                <span>Скорость сети</span>
              </div>
              <div className="h-48">
                {(() => {
                  const ifaceNames = [...new Set(history.filter(h => h.traffic_speed).flatMap(h => h.traffic_speed || []).map(i => i.name))]
                  const mainIface = ifaceNames.find(n => !n.startsWith('lo') && !n.startsWith('veth') && !n.startsWith('br') && !n.startsWith('docker')) || ifaceNames[0]
                  if (!mainIface) return <div className="flex items-center justify-center h-full text-xs text-muted-foreground/60">Нет данных</div>
                  const merged = history.map(h => ({
                    t: h.t,
                    rx: h.traffic_speed?.find(i => i.name === mainIface)?.rxBytesPerSec ?? null,
                    tx: h.traffic_speed?.find(i => i.name === mainIface)?.txBytesPerSec ?? null,
                  }))
                  const netGaps = findGaps(merged, ['rx', 'tx'])
                  return (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={merged} margin={{ top: 2, right: 4, bottom: 2, left: 0 }}>
                        <defs>
                          <pattern id="gapStripes" patternUnits="userSpaceOnUse" width="20" height="20" patternTransform="rotate(45)">
                            <rect width="20" height="20" fill="hsl(var(--muted-foreground))" fillOpacity="0.03" />
                            <circle cx="10" cy="10" r="2" fill="hsl(var(--muted-foreground))" fillOpacity="0.1" />
                          </pattern>
                        </defs>
                        <XAxis dataKey="t" tickFormatter={(v) => formatTime(v, timeRange)} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={40} />
                        <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatBytes(v)} width={64} />
                        <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }} labelFormatter={(label) => formatTimeFull(label as string)} formatter={(value: any, name: any) => [formatBytes(value) + '/с', name === 'rx' ? `↓ ${mainIface}` : `↑ ${mainIface}`]} />
                        {netGaps.map((g, i) => (
                          <ReferenceArea key={i} x1={g.start} x2={g.end} fill="url(#gapStripes)" />
                        ))}
                        <Area type="monotone" dataKey="rx" stroke="#22c55e" fill="none" strokeWidth={2} dot={false} isAnimationActive={true} animationDuration={100} connectNulls={false} />
                        <Area type="monotone" dataKey="tx" stroke="#3b82f6" fill="none" strokeWidth={2} strokeDasharray="4 3" dot={false} isAnimationActive={true} animationDuration={100} connectNulls={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  )
                })()}
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
