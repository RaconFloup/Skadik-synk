import { useState, useEffect } from 'react'
import { settingsApi } from '@/api/client'
import api from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, MessageCircle, CheckCircle2, XCircle, Terminal, HardDrive, HelpCircle } from 'lucide-react'

interface IntegrationCardProps {
  icon: React.ReactNode
  title: string
  description: string
  fields: { key: string; label: string; placeholder?: string; type?: string }[]
  stored: Record<string, string>
  values: Record<string, string>
  onChange: (key: string, value: string) => void
  onSave: () => void
  saving: boolean
  actions?: React.ReactNode
  onHelp?: () => void
}

function IntegrationCard({ icon, title, description, fields, stored, values, onChange, onSave, saving, actions, onHelp }: IntegrationCardProps) {
  const isConfigured = fields.some((f) => !!stored[f.key])

  return (
    <div className="flex flex-col rounded-xl border border-border/50 bg-card p-5 shadow-sm h-full">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <label className="text-sm font-medium">{title}</label>
        {onHelp && (
          <button
            onClick={onHelp}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Открыть инструкцию"
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        )}
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
      <p className="mb-3 text-xs text-muted-foreground">{description}</p>
      <div className="flex-1 space-y-3">
        {fields.map((f) => (
          <div key={f.key}>
            <label className="block text-xs font-medium mb-1">{f.label}</label>
            <Input
              value={values[f.key] || ''}
              onChange={(e) => onChange(f.key, e.target.value)}
              placeholder={f.placeholder}
              type={f.type || 'text'}
            />
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-2 flex-wrap">
        <Button size="sm" onClick={onSave} disabled={saving}>
          {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Сохранить
        </Button>
        {actions}
      </div>
    </div>
  )
}

interface TestResult { ok: boolean; error?: string }

export function IntegrationsSettings({ onViewChange }: { onViewChange?: (view: string) => void }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  const [tgToken, setTgToken] = useState('')
  const [tgStored, setTgStored] = useState('')
  const [testingTg, setTestingTg] = useState(false)
  const [testResultTg, setTestResultTg] = useState<TestResult | null>(null)

  const [tmUrl, setTmUrl] = useState('')
  const [tmUser, setTmUser] = useState('')
  const [tmPass, setTmPass] = useState('')
  const [tmStored, setTmStored] = useState<Record<string, string>>({})
  const [testingTm, setTestingTm] = useState(false)
  const [testResultTm, setTestResultTm] = useState<TestResult | null>(null)

  const [gdUrl, setGdUrl] = useState('')
  const [gdFolder, setGdFolder] = useState('')
  const [gdStored, setGdStored] = useState<Record<string, string>>({})
  const [testingGd, setTestingGd] = useState(false)
  const [testResultGd, setTestResultGd] = useState<TestResult | null>(null)

  const load = () => {
    settingsApi.getAll().then((s) => {
      const t = s.telegram_bot_token || ''
      setTgToken(t)
      setTgStored(t)

      const termixUrl = s.termix_url || ''
      const termixUsername = s.termix_username || ''
      const termixPassword = s.termix_password || ''
      setTmUrl(termixUrl)
      setTmUser(termixUsername)
      setTmPass(termixPassword)
      setTmStored({ url: termixUrl, username: termixUsername, password: termixPassword })

      const gdScriptUrl = s.google_script_url || ''
      const gdFolderId = s.google_folder_id || ''
      setGdUrl(gdScriptUrl)
      setGdFolder(gdFolderId)
      setGdStored({ script_url: gdScriptUrl, folder_id: gdFolderId })
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleSaveTelegram = async () => {
    setSaving('telegram')
    try {
      await settingsApi.update({ telegram_bot_token: tgToken })
      setTgStored(tgToken)
    } finally { setSaving(null) }
  }

  const handleSaveTermix = async () => {
    setSaving('termix')
    try {
      await settingsApi.update({ termix_url: tmUrl, termix_username: tmUser, termix_password: tmPass })
      setTmStored({ url: tmUrl, username: tmUser, password: tmPass })
    } finally { setSaving(null) }
  }

  const handleSaveGoogle = async () => {
    setSaving('google')
    try {
      await settingsApi.update({ google_script_url: gdUrl, google_folder_id: gdFolder })
      setGdStored({ script_url: gdUrl, folder_id: gdFolder })
    } finally { setSaving(null) }
  }

  const handleTestTg = async () => {
    setTestingTg(true)
    setTestResultTg(null)
    try {
      await api.post('/telegram/test-token', { token: tgToken || tgStored })
      setTestResultTg({ ok: true })
    } catch (err: any) {
      setTestResultTg({ ok: false, error: err?.response?.data?.detail || 'Ошибка' })
    } finally {
      setTestingTg(false)
    }
  }

  const handleTestTm = async () => {
    setTestingTm(true)
    setTestResultTm(null)
    try {
      const res = await api.post('/telegram/test-termix')
      setTestResultTm({ ok: res.data.ok, error: res.data.error })
    } catch (err: any) {
      setTestResultTm({ ok: false, error: err?.response?.data?.detail || 'Ошибка' })
    } finally {
      setTestingTm(false)
    }
  }

  const handleTestGd = async () => {
    setTestingGd(true)
    setTestResultGd(null)
    try {
      const res = await api.post('/telegram/test-google')
      setTestResultGd({ ok: res.data.ok, error: res.data.error })
    } catch (err: any) {
      setTestResultGd({ ok: false, error: err?.response?.data?.detail || 'Ошибка' })
    } finally {
      setTestingGd(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-r-transparent" />
      </div>
    )
  }

  const TestButton = ({ testing, result, onClick, disabled }: { testing: boolean; result: TestResult | null; onClick: () => void; disabled: boolean }) => (
    <Button size="sm" variant="outline" onClick={onClick} disabled={testing || disabled}>
      {testing ? (
        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
      ) : result?.ok ? (
        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
      ) : result ? (
        <XCircle className="mr-1.5 h-3.5 w-3.5 text-destructive" />
      ) : null}
      Проверить
    </Button>
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Интеграции</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Настройка внешних сервисов
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <IntegrationCard
          icon={<MessageCircle className="h-5 w-5 text-sky-400" />}
          title="Telegram Bot"
          description="Токен используется для загрузки аватаров Telegram-ботов"
          fields={[{ key: 'bot_token', label: 'Bot Token', placeholder: '1234567890:ABCdefGHIjklmNOPqrSTUvwXYZ', type: 'password' }]}
          stored={{ bot_token: tgStored }}
          values={{ bot_token: tgToken }}
          onChange={(_, v) => setTgToken(v)}
          onSave={handleSaveTelegram}
          saving={saving === 'telegram'}
          actions={<TestButton testing={testingTg} result={testResultTg} onClick={handleTestTg} disabled={!tgStored} />}
          onHelp={() => onViewChange?.('faq')}
        />

        <IntegrationCard
          icon={<Terminal className="h-5 w-5 text-amber-400" />}
          title="Termix"
          description="SSH-терминал для управления серверами"
          fields={[
            { key: 'url', label: 'URL', placeholder: 'https://termix.example.com' },
            { key: 'username', label: 'Логин', placeholder: 'admin' },
            { key: 'password', label: 'Пароль', type: 'password' },
          ]}
          stored={tmStored}
          values={{ url: tmUrl, username: tmUser, password: tmPass }}
          onChange={(key, v) => {
            if (key === 'url') setTmUrl(v)
            else if (key === 'username') setTmUser(v)
            else if (key === 'password') setTmPass(v)
          }}
          onSave={handleSaveTermix}
          saving={saving === 'termix'}
          actions={<TestButton testing={testingTm} result={testResultTm} onClick={handleTestTm} disabled={!tmUrl || !tmUser} />}
          onHelp={() => onViewChange?.('faq')}
        />

        <IntegrationCard
          icon={<HardDrive className="h-5 w-5 text-blue-400" />}
          title="Google Drive"
          description="Резервное копирование данных серверов"
          fields={[
            { key: 'script_url', label: 'Script URL', placeholder: 'https://script.google.com/.../exec' },
            { key: 'folder_id', label: 'Folder ID', placeholder: '1ABCxyz...' },
          ]}
          stored={gdStored}
          values={{ script_url: gdUrl, folder_id: gdFolder }}
          onChange={(key, v) => {
            if (key === 'script_url') setGdUrl(v)
            else if (key === 'folder_id') setGdFolder(v)
          }}
          onSave={handleSaveGoogle}
          saving={saving === 'google'}
          actions={<TestButton testing={testingGd} result={testResultGd} onClick={handleTestGd} disabled={!gdUrl || !gdFolder} />}
          onHelp={() => onViewChange?.('faq')}
        />
      </div>
    </div>
  )
}