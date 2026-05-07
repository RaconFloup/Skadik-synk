import { useState, useEffect } from 'react'
import { settingsApi } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, MessageCircle, CheckCircle2, XCircle } from 'lucide-react'

export function IntegrationsSettings() {
  const [botToken, setBotToken] = useState('')
  const [storedToken, setStoredToken] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'ok' | 'fail' | null>(null)

  useEffect(() => {
    settingsApi.getAll().then((s) => {
      const token = s.telegram_bot_token || ''
      setBotToken(token)
      setStoredToken(token)
    }).finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await settingsApi.update({ telegram_bot_token: botToken })
      setStoredToken(botToken)
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/telegram/test-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: botToken || storedToken }),
      })
      setTestResult(res.ok ? 'ok' : 'fail')
    } catch {
      setTestResult('fail')
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-r-transparent" />
      </div>
    )
  }

  const isConfigured = !!storedToken

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Интеграции</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Настройка внешних сервисов
        </p>
      </div>

      <div className="rounded-xl border border-border/50 bg-card p-5 shadow-sm max-w-md">
        <div className="flex items-center gap-2 mb-2">
          <MessageCircle className="h-5 w-5 text-sky-400" />
          <label className="text-sm font-medium">Telegram Bot</label>
          {isConfigured ? (
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Настроен
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <XCircle className="h-3.5 w-3.5" />
              Не настроен
            </span>
          )}
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Токен используется для загрузки аватаров Telegram-ботов и для уведомлений
        </p>
        <label className="block text-xs font-medium mb-1">Bot Token</label>
        <Input
          value={botToken}
          onChange={(e) => setBotToken(e.target.value)}
          placeholder="1234567890:ABCdefGHIjklmNOPqrSTUvwXYZ"
          type="password"
        />
        <div className="mt-4 flex items-center gap-2">
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Сохранить
          </Button>
          <Button size="sm" variant="outline" onClick={handleTest} disabled={testing || !storedToken}>
            {testing ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : testResult === 'ok' ? (
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
            ) : testResult === 'fail' ? (
              <XCircle className="mr-1.5 h-3.5 w-3.5 text-destructive" />
            ) : null}
            Проверить
          </Button>
        </div>
      </div>
    </div>
  )
}
