import { useState, useEffect } from 'react'
import { settingsApi, uptimeApi } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, RefreshCw } from 'lucide-react'

export function UptimeSettings() {
  const [interval, setInterval] = useState('60')
  const [retryCount, setRetryCount] = useState('3')
  const [retentionDays, setRetentionDays] = useState('90')
  const [timeout, setTimeout_] = useState('5')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [restarting, setRestarting] = useState(false)

  useEffect(() => {
    settingsApi.getAll().then((s) => {
      if (s.uptime_check_interval) setInterval(s.uptime_check_interval)
      if (s.uptime_retry_count) setRetryCount(s.uptime_retry_count)
      if (s.uptime_retention_days) setRetentionDays(s.uptime_retention_days)
      if (s.uptime_check_timeout) setTimeout_(s.uptime_check_timeout)
    }).finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await settingsApi.update({
        uptime_check_interval: interval,
        uptime_retry_count: retryCount,
        uptime_retention_days: retentionDays,
        uptime_check_timeout: timeout,
      })
      await uptimeApi.restartScheduler()
    } finally {
      setSaving(false)
    }
  }

  const handleRestart = async () => {
    setRestarting(true)
    try {
      const result = await uptimeApi.restartScheduler()
      setInterval(String(result.interval))
      setRetentionDays(String(result.retention_days))
      setTimeout_(String(result.timeout))
    } finally {
      setRestarting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-r-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Настройки аптайма</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Интервал проверки, таймаут, количество повторных попыток и срок хранения статистики
        </p>
      </div>

      <div className="rounded-xl border border-border/50 bg-card p-5 shadow-sm max-w-md">
        <label className="block text-sm font-medium mb-2">Интервал проверки (секунды)</label>
        <p className="mb-3 text-xs text-muted-foreground">
          Как часто выполняется TCP-проверка доступности
        </p>
        <Input
          type="number"
          min={10}
          value={interval}
          onChange={(e) => setInterval(e.target.value)}
          className="w-32"
        />
      </div>

      <div className="rounded-xl border border-border/50 bg-card p-5 shadow-sm max-w-md">
        <label className="block text-sm font-medium mb-2">Таймаут проверки (секунды)</label>
        <p className="mb-3 text-xs text-muted-foreground">
          Время ожидания ответа от сервера. Если сервер не отвечает за это время — проверка считается неудачной.
        </p>
        <Input
          type="number"
          min={1}
          max={120}
          value={timeout}
          onChange={(e) => setTimeout_(e.target.value)}
          className="w-32"
        />
      </div>

      <div className="rounded-xl border border-border/50 bg-card p-5 shadow-sm max-w-md">
        <label className="block text-sm font-medium mb-2">Количество повторных проверок</label>
        <p className="mb-3 text-xs text-muted-foreground">
          Если сервер недоступен, будет сделано указанное количество неудачных попыток, прежде чем будет выдан статус «Недоступен». Пока выполняются эти попытки, применяется статус «Ожидание».
        </p>
        <Input
          type="number"
          min={0}
          max={20}
          value={retryCount}
          onChange={(e) => setRetryCount(e.target.value)}
          className="w-32"
        />
      </div>

      <div className="rounded-xl border border-border/50 bg-card p-5 shadow-sm max-w-md">
        <label className="block text-sm font-medium mb-2">Срок хранения статистики (дней)</label>
        <p className="mb-3 text-xs text-muted-foreground">
          Через сколько дней удалять устаревшие записи проверок. Чем больше дней, тем дольше отображается история на графиках.
        </p>
        <Input
          type="number"
          min={1}
          max={365}
          value={retentionDays}
          onChange={(e) => setRetentionDays(e.target.value)}
          className="w-32"
        />
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
          Сохранить
        </Button>
        <Button variant="outline" onClick={handleRestart} disabled={restarting}>
          <RefreshCw className={'mr-1.5 h-4 w-4' + (restarting ? ' animate-spin' : '')} />
          Перезапустить планировщик
        </Button>
      </div>
    </div>
  )
}
