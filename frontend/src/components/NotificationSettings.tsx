import { useState, useEffect } from 'react'
import { settingsApi, telegramApi } from '@/api/client'

const DEFAULT_UP_TEMPLATE = '✅ <b>{name}</b>\nМониторинг аптайма: сервер доступен'
const DEFAULT_DOWN_TEMPLATE = '❌ <b>{name}</b>\nМониторинг аптайма: недоступен\n{error}'

export function NotificationSettings() {
  const [chatId, setChatId] = useState('')
  const [topicId, setTopicId] = useState('')
  const [notifyOnDown, setNotifyOnDown] = useState(true)
  const [notifyOnUp, setNotifyOnUp] = useState(true)
  const [downTemplate, setDownTemplate] = useState('')
  const [upTemplate, setUpTemplate] = useState('')
  const [templateOpen, setTemplateOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    settingsApi.getAll().then((data) => {
      setChatId(data['uptime_notify_chat_id'] || '')
      setTopicId(data['uptime_notify_topic_id'] || '')
      setNotifyOnDown(data['uptime_notify_on_down'] !== '0')
      setNotifyOnUp(data['uptime_notify_on_up'] !== '0')
      setDownTemplate(data['uptime_notify_down_template'] || DEFAULT_DOWN_TEMPLATE)
      setUpTemplate(data['uptime_notify_up_template'] || DEFAULT_UP_TEMPLATE)
    }).catch(() => {
      setToast({ message: 'Ошибка загрузки настроек', type: 'error' })
    })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await settingsApi.update({
        'uptime_notify_chat_id': chatId,
        'uptime_notify_topic_id': topicId,
        'uptime_notify_on_down': notifyOnDown ? '1' : '0',
        'uptime_notify_on_up': notifyOnUp ? '1' : '0',
        'uptime_notify_down_template': downTemplate,
        'uptime_notify_up_template': upTemplate,
      })
      setToast({ message: 'Настройки уведомлений сохранены', type: 'success' })
    } catch {
      setToast({ message: 'Ошибка при сохранении', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    try {
      const result = await telegramApi.testNotify({
        chat_id: chatId,
        topic_id: topicId,
        down_text: downTemplate.replace('{name}', 'Test Server').replace('{error}', 'тестовая ошибка'),
        up_text: '',
      })
      if (result.ok) {
        setToast({ message: 'Тестовое уведомление отправлено', type: 'success' })
      } else {
        setToast({ message: 'Ошибка: ' + (result.error || 'неизвестная'), type: 'error' })
      }
    } catch {
      setToast({ message: 'Ошибка отправки тестового уведомления', type: 'error' })
    } finally {
      setTesting(false)
    }
  }

  function ToggleSwitch({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background/50 p-4">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">{label}</p>
          {description && <p className="text-xs text-muted-foreground/60">{description}</p>}
        </div>
        <button
          type="button"
          onClick={() => onChange(!checked)}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
            checked ? 'bg-primary' : 'bg-border'
          }`}
        >
          <span
            className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
              checked ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className={'rounded-lg px-4 py-3 text-sm flex items-center justify-between ' + (toast.type === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500')}>
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 text-base leading-none">&times;</button>
        </div>
      )}

      <div>
        <h2 className="text-2xl font-semibold">Уведомления</h2>
        <p className="mt-1 text-sm text-muted-foreground">Настройка оповещений через Telegram бота</p>
      </div>

      <div className="rounded-lg border border-border/50 bg-card p-5 space-y-5">
        <h3 className="text-lg font-medium">Аптайм</h3>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Chat ID</label>
            <input
              type="text"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="Например: -1001234567890"
              className="w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm outline-none focus:border-primary/50"
            />
            <p className="mt-1 text-xs text-muted-foreground/60">ID чата или канала для получения уведомлений</p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Topic ID (необязательно)</label>
            <input
              type="text"
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
              placeholder="ID топика в группе"
              className="w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm outline-none focus:border-primary/50"
            />
            <p className="mt-1 text-xs text-muted-foreground/60">ID топика для отправки в обсуждение группы</p>
          </div>

          <div className="space-y-2">
            <ToggleSwitch
              checked={notifyOnDown}
              onChange={setNotifyOnDown}
              label="Сервер недоступен"
              description="Уведомлять когда сервер перестаёт отвечать"
            />
            <ToggleSwitch
              checked={notifyOnUp}
              onChange={setNotifyOnUp}
              label="Сервер снова доступен"
              description="Уведомлять когда сервер восстанавливается"
            />
          </div>

          <div className="rounded-lg border border-border/50">
            <button
              type="button"
              onClick={() => setTemplateOpen(!templateOpen)}
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium transition-colors hover:bg-accent/30"
            >
              <span>Шаблоны уведомлений</span>
              <span className={'transition-transform ' + (templateOpen ? 'rotate-180' : '')}>{'\u25BC'}</span>
            </button>
            {templateOpen && (
              <div className="space-y-4 border-t border-border/50 p-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Шаблон: сервер недоступен</label>
                  <textarea
                    value={downTemplate}
                    onChange={(e) => setDownTemplate(e.target.value)}
                    rows={3}
                    className="w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 font-mono"
                  />
                  <p className="mt-1 text-xs text-muted-foreground/60">{'{name}'} — имя сервера, {'{error}'} — текст ошибки</p>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Шаблон: сервер доступен</label>
                  <textarea
                    value={upTemplate}
                    onChange={(e) => setUpTemplate(e.target.value)}
                    rows={3}
                    className="w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 font-mono"
                  />
                  <p className="mt-1 text-xs text-muted-foreground/60">{'{name}'} — имя сервера</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button
              onClick={handleTest}
              disabled={testing}
              className="rounded-md border border-border/50 px-4 py-2 text-sm font-medium transition-colors hover:bg-accent/30 disabled:opacity-50"
            >
              {testing ? 'Отправка...' : 'Тестовое уведомление'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
