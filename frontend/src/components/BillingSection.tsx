import { useState, useEffect } from 'react'
import { settingsApi, telegramApi } from '@/api/client'
import ToggleSwitch from './ToggleSwitch'

const DEFAULT_BILLING_TEMPLATE = '📅 Статус аренды: {date}\n{groups}\n---\n💰 Итого: {total}'

const inputClass = 'w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm outline-none focus:border-primary/50'

export default function BillingSection({ showToast }: { showToast: (msg: string, type: 'success' | 'error') => void }) {
  const [chatId, setChatId] = useState('')
  const [topicId, setTopicId] = useState('')
  const [enabled, setEnabled] = useState(false)
  const [time, setTime] = useState('09:00')
  const [template, setTemplate] = useState('')
  const [nickname, setNickname] = useState('')
  const [templateOpen, setTemplateOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    settingsApi.getAll().then((data) => {
      setChatId(data['billing_notify_chat_id'] || '')
      setTopicId(data['billing_notify_topic_id'] || '')
      setEnabled(data['billing_notify_enabled'] === '1')
      setTime(data['billing_notify_time'] || '09:00')
      setTemplate(data['billing_notify_template'] || DEFAULT_BILLING_TEMPLATE)
      setNickname(data['billing_notify_nickname'] || '')
    }).catch(() => showToast('Ошибка загрузки настроек', 'error'))
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      await settingsApi.update({
        'billing_notify_chat_id': chatId,
        'billing_notify_topic_id': topicId,
        'billing_notify_enabled': enabled ? '1' : '0',
        'billing_notify_time': time,
        'billing_notify_template': template,
        'billing_notify_nickname': nickname,
      })
      showToast('Настройки биллинга сохранены', 'success')
    } catch {
      showToast('Ошибка при сохранении биллинга', 'error')
    } finally {
      setSaving(false)
    }
  }

  const test = async () => {
    setTesting(true)
    try {
      const result = await telegramApi.testNotifyBilling({
        chat_id: chatId,
        topic_id: topicId,
        template: template,
      })
      showToast(result.ok ? 'Отчёт отправлен' : 'Ошибка: ' + (result.error || 'неизвестная'), result.ok ? 'success' : 'error')
    } catch {
      showToast('Ошибка отправки отчёта', 'error')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="rounded-lg border border-border/50 bg-card p-5 space-y-5">
      <h3 className="text-lg font-medium">Биллинг</h3>
      <div className="space-y-4">
        <ToggleSwitch checked={enabled} onChange={setEnabled}
          label="Ежедневный отчёт" description="Автоматическая отправка сводки по аренде серверов" />

        <div>
          <label className="mb-1.5 block text-sm font-medium">Chat ID</label>
          <input type="text" value={chatId} onChange={(e) => setChatId(e.target.value)}
            placeholder="Например: -1001234567890" className={inputClass} />
          <p className="mt-1 text-xs text-muted-foreground/60">ID чата или канала для получения отчёта</p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Topic ID (необязательно)</label>
          <input type="text" value={topicId} onChange={(e) => setTopicId(e.target.value)}
            placeholder="ID топика в группе" className={inputClass} />
          <p className="mt-1 text-xs text-muted-foreground/60">ID топика для отправки в обсуждение группы</p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Время отправки</label>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
            className={inputClass + ' w-32'} />
          <p className="mt-1 text-xs text-muted-foreground/60">Ежедневно в указанное время</p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Ник для оплаты</label>
          <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)}
            placeholder="example_nickname" className={inputClass + ' max-w-xs'} />
          <p className="mt-1 text-xs text-muted-foreground/60">Добавляется в отчёт, если до оплаты остался 1 день</p>
        </div>

        <div className="rounded-lg border border-border/50">
          <button type="button" onClick={() => setTemplateOpen(!templateOpen)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium transition-colors hover:bg-accent/30">
            <span>Шаблон отчёта</span>
            <span className={'transition-transform ' + (templateOpen ? 'rotate-180' : '')}>{'\u25BC'}</span>
          </button>
          {templateOpen && (
            <div className="space-y-3 border-t border-border/50 p-4">
              <textarea value={template} onChange={(e) => setTemplate(e.target.value)} rows={8}
                className="w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 font-mono"
                placeholder="Оставьте пустым для стандартного шаблона" />
              <p className="text-xs text-muted-foreground/60">
                {'{date}'} — текущая дата, {'{groups}'} — список серверов по группам, {'{total}'} — итоговая сумма
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button onClick={save} disabled={saving}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50">
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
          <button onClick={test} disabled={testing}
            className="rounded-md border border-border/50 px-4 py-2 text-sm font-medium transition-colors hover:bg-accent/30 disabled:opacity-50">
            {testing ? 'Отправка...' : 'Тестовый отчёт'}
          </button>
        </div>
      </div>
    </div>
  )
}
