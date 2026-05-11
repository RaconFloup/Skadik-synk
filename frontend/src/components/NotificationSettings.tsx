import { useState, useEffect } from 'react'
import { settingsApi } from '@/api/client'

export function NotificationSettings() {
  const [chatId, setChatId] = useState('')
  const [topicId, setTopicId] = useState('')
  const [notifyOnDown, setNotifyOnDown] = useState(true)
  const [notifyOnUp, setNotifyOnUp] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    settingsApi.getAll().then((data) => {
      setChatId(data['uptime_notify_chat_id'] || '')
      setTopicId(data['uptime_notify_topic_id'] || '')
      setNotifyOnDown(data['uptime_notify_on_down'] !== '0')
      setNotifyOnUp(data['uptime_notify_on_up'] !== '0')
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
      })
      setToast({ message: 'Настройки уведомлений сохранены', type: 'success' })
    } catch {
      setToast({ message: 'Ошибка при сохранении', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className={'rounded-lg px-4 py-3 text-sm ' + (toast.type === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500')}>
          {toast.message}
          <button onClick={() => setToast(null)} className="ml-2">&times;</button>
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

          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={notifyOnDown}
                onChange={(e) => setNotifyOnDown(e.target.checked)}
                className="h-4 w-4 rounded border-border/50"
              />
              <span className="text-sm">Уведомлять когда сервер недоступен</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={notifyOnUp}
                onChange={(e) => setNotifyOnUp(e.target.checked)}
                className="h-4 w-4 rounded border-border/50"
              />
              <span className="text-sm">Уведомлять когда сервер снова доступен</span>
            </label>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}
