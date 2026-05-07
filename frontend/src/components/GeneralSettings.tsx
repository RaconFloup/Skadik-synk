import { useState, useEffect } from 'react'
import { settingsApi } from '@/api/client'
import { CURRENCIES } from '@/types'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

export function GeneralSettings() {
  const [baseCurrency, setBaseCurrency] = useState('RUB')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    settingsApi.getAll().then((s) => {
      if (s.base_currency) setBaseCurrency(s.base_currency)
    }).finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await settingsApi.update({ base_currency: baseCurrency })
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
        <h2 className="text-2xl font-semibold">Общие настройки</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Основная валюта и конвертация
        </p>
      </div>

      <div className="rounded-xl border border-border/50 bg-card p-5 shadow-sm max-w-md">
        <label className="block text-sm font-medium mb-2">Основная валюта</label>
        <p className="mb-3 text-xs text-muted-foreground">
          Все стоимости будут конвертироваться и отображаться в этой валюте
        </p>
        <select
          value={baseCurrency}
          onChange={(e) => setBaseCurrency(e.target.value)}
          className="w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm"
        >
          {CURRENCIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <Button className="mt-4" size="sm" onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Сохранить
        </Button>
      </div>
    </div>
  )
}
