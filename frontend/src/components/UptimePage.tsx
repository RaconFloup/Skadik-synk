import { useState, useEffect, useCallback } from 'react'
import { uptimeApi } from '@/api/client'
import type { UptimeMonitorWithStatus } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Plus, Loader2, Wifi, WifiOff, RefreshCw } from 'lucide-react'

function formatMs(ms: number | null | undefined): string {
  if (ms == null) return '—'
  return `${ms}ms`
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
  const load = useCallback(async () => {
    try {
      const data = await uptimeApi.getAll()
      setMonitors(data)
    } catch {} finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

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
        <div className="grid grid-cols-2 gap-3">
          {monitors.map(({ monitor, last_check, recent_checks, uptime_24h, uptime_7d }) => {
            const isUp = last_check?.is_up
            const statusColor = isUp === true ? 'bg-emerald-500' : isUp === false ? 'bg-red-500' : 'bg-muted-foreground'
            const downtime = recent_checks.filter(c => !c.is_up).length
            return (
              <div key={monitor.id} className="group relative rounded-xl border border-border/50 bg-card overflow-hidden transition-shadow hover:shadow-md">
                <div className={'h-1 w-full ' + statusColor} />

                <div className="p-4 pt-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className={'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ' + (isUp === true ? 'bg-emerald-500/15 text-emerald-400' : isUp === false ? 'bg-red-500/15 text-red-400' : 'bg-accent text-muted-foreground')}>
                        {isUp === true ? (
                          <Wifi className="h-4 w-4" />
                        ) : (
                          <WifiOff className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate leading-tight">{monitor.name}</p>
                        <p className="text-xs text-muted-foreground/70 truncate mt-0.5 font-mono">{monitor.host}:{monitor.port}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleToggle(monitor.id, monitor.is_active)}
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
                      <span className="text-muted-foreground">отклик</span>
                      <span className="font-semibold tabular-nums">{formatMs(last_check?.response_time_ms)}</span>
                    </div>
                  </div>

                  <div className="mt-3 h-6 rounded-md bg-accent/20 overflow-hidden flex">
                    {recent_checks.length > 0 ? (
                      recent_checks.map((c) => (
                        <div
                          key={c.id}
                          className={'flex-1 cursor-pointer transition-opacity hover:opacity-80 ' + (c.is_up ? 'bg-emerald-500/60' : 'bg-red-500/60')}
                          title={`${c.is_up ? '✓ Доступен' : '✗ Ошибка'}${c.response_time_ms ? ` (${c.response_time_ms}ms)` : ''}\n${c.error || ''}\n${new Date(c.checked_at).toLocaleString('ru-RU')}`}
                        />
                      ))
                    ) : (
                      Array.from({ length: 24 }).map((_, idx) => (
                        <div key={idx} className="flex-1 bg-accent/30" />
                      ))
                    )}
                  </div>

                  <div className="mt-2.5 flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2 text-muted-foreground/60">
                      {last_check ? (
                        <>
                          <span className={isUp ? 'text-emerald-400' : 'text-red-400'}>{isUp ? 'Доступен' : 'Недоступен'}</span>
                          <span>·</span>
                          <span>{new Date(last_check.checked_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                        </>
                      ) : (
                        <span>Ожидает проверки</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground/40">
                      {downtime > 0 && <span className="text-red-400/60">{downtime} сбоев</span>}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
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
