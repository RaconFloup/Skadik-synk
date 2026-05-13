import { useState, useEffect } from 'react'
import { settingsApi } from '@/api/client'
import ToggleSwitch from '@/components/ToggleSwitch'
import { Loader2 } from 'lucide-react'

const METRICS = [
  { key: 'cpu',     label: 'CPU',        description: 'Загрузка процессора, количество ядер, нагрузка (top -bn1)' },
  { key: 'memory',  label: 'Память',     description: 'Использование RAM, общий объём (free -m)' },
  { key: 'disk',    label: 'Диск',       description: 'Заполненность корневого раздела (df -h /)' },
  { key: 'uptime',  label: 'Аптайм',     description: 'Время работы сервера (/proc/uptime)' },
  { key: 'system',  label: 'Система',    description: 'Имя хоста, версия ядра, ОС (uname -a)' },
]

export function MonitoringSettings() {
  const [enabled, setEnabled] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    settingsApi.getAll().then((s) => {
      if (s.monitoring_metrics) {
        try {
          const parsed = JSON.parse(s.monitoring_metrics)
          if (Array.isArray(parsed)) {
            setEnabled(parsed)
            return
          }
        } catch {}
      }
      setEnabled(['cpu', 'memory', 'disk', 'uptime', 'system'])
    }).finally(() => setLoading(false))
  }, [])

  const toggle = async (key: string) => {
    const next = enabled.includes(key)
      ? enabled.filter((k) => k !== key)
      : [...enabled, key]
    setEnabled(next)

    setSaving(true)
    try {
      await settingsApi.update({ monitoring_metrics: JSON.stringify(next) })
    } finally {
      setSaving(false)
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
        <h2 className="text-2xl font-semibold">Мониторинг</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Какие метрики собирать с серверов через SSH
        </p>
      </div>

      <div className="max-w-md space-y-3">
        {METRICS.map((m) => (
          <ToggleSwitch
            key={m.key}
            checked={enabled.includes(m.key)}
            onChange={() => toggle(m.key)}
            label={m.label}
            description={m.description}
          />
        ))}
      </div>

      {saving && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Сохранение...
        </div>
      )}
    </div>
  )
}
