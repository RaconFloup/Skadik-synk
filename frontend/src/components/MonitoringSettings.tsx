import { useState, useEffect } from 'react'
import { settingsApi } from '@/api/client'
import ToggleSwitch from '@/components/ToggleSwitch'
import { Loader2 } from 'lucide-react'

const LIGHT_METRICS = [
  { key: 'cpu',       label: 'CPU',             description: 'Загрузка и количество ядер' },
  { key: 'memory',    label: 'Память',          description: 'Использование RAM и Swap' },
  { key: 'disk',      label: 'Диск',            description: 'Заполненность корневого раздела' },
  { key: 'uptime',    label: 'Аптайм',          description: 'Время работы сервера' },
  { key: 'system',    label: 'Система',         description: 'Хост, ядро, версия ОС' },
  { key: 'load',      label: 'Load Average',    description: 'Нагрузка CPU (1/5/15 мин)' },
  { key: 'diskio',    label: 'Диск I/O',        description: 'Скорость чтения/записи, IOPS' },
  { key: 'traffic',   label: 'Трафик',          description: 'RX/TX по интерфейсам' },
]

const HEAVY_METRICS = [
  { key: 'netstat',   label: 'Соединения',      description: 'Активные TCP-соединения' },
  { key: 'processes', label: 'Процессы',        description: 'Топ процессов по CPU и памяти' },
  { key: 'sshsessions', label: 'SSH-сессии',    description: 'Активные подключения по SSH' },
  { key: 'docker',    label: 'Docker',          description: 'Запущенные и остановленные контейнеры' },
]

export function MonitoringSettings() {
  const [enabled, setEnabled] = useState<string[]>([])
  const [lightInterval, setLightInterval] = useState(5)
  const [heavyInterval, setHeavyInterval] = useState(30)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    settingsApi.getAll().then((s) => {
      if (s.monitoring_metrics) {
        try {
          const parsed = JSON.parse(s.monitoring_metrics)
          if (Array.isArray(parsed)) {
            setEnabled(parsed)
          }
        } catch {}
      }
      setLightInterval(Number(s.monitoring_light_interval) || 5)
      setHeavyInterval(Number(s.monitoring_heavy_interval) || 30)
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

  const saveInterval = async (field: string, value: number) => {
    setSaving(true)
    try {
      await settingsApi.update({ [field]: String(value) })
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

      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-2">Лёгкие метрики</h3>
        <p className="text-xs text-muted-foreground/50 mb-3">Собираются каждый опрос: CPU, память, диск, аптайм, система, load average, I/O, трафик</p>
        <div className="max-w-md space-y-3">
          {LIGHT_METRICS.map((m) => (
            <ToggleSwitch
              key={m.key}
              checked={enabled.includes(m.key)}
              onChange={() => toggle(m.key)}
              label={m.label}
              description={m.description}
            />
          ))}
        </div>
        <div className="mt-3 flex items-center gap-3">
          <label className="text-xs text-muted-foreground">Интервал сбора (сек):</label>
          <input
            type="number"
            min={3}
            max={300}
            value={lightInterval}
            onChange={(e) => setLightInterval(Number(e.target.value))}
            onBlur={() => saveInterval('monitoring_light_interval', lightInterval)}
            className="w-20 rounded border border-border/50 bg-card px-2 py-1 text-xs tabular-nums text-foreground"
          />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-2">Тяжёлые метрики</h3>
        <p className="text-xs text-muted-foreground/50 mb-3">Собираются раз в N секунд: TCP-соединения, процессы, Docker, SSH-сессии</p>
        <div className="max-w-md space-y-3">
          {HEAVY_METRICS.map((m) => (
            <ToggleSwitch
              key={m.key}
              checked={enabled.includes(m.key)}
              onChange={() => toggle(m.key)}
              label={m.label}
              description={m.description}
            />
          ))}
        </div>
        <div className="mt-3 flex items-center gap-3">
          <label className="text-xs text-muted-foreground">Интервал сбора (сек):</label>
          <input
            type="number"
            min={5}
            max={600}
            value={heavyInterval}
            onChange={(e) => setHeavyInterval(Number(e.target.value))}
            onBlur={() => saveInterval('monitoring_heavy_interval', heavyInterval)}
            className="w-20 rounded border border-border/50 bg-card px-2 py-1 text-xs tabular-nums text-foreground"
          />
        </div>
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
