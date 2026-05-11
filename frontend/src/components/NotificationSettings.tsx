import { useState, useEffect } from 'react'
import { settingsApi, telegramApi } from '@/api/client'

const DEFAULT_UP_TEMPLATE = '✅ <b>{name}</b>\nМониторинг аптайма: сервер доступен'
const DEFAULT_DOWN_TEMPLATE = '❌ <b>{name}</b>\nМониторинг аптайма: недоступен\n{error}'
const DEFAULT_BILLING_TEMPLATE = '📅 Статус аренды: {date}\n{groups}\n---\n💰 Итого: {total}'

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
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-border'}`}
      >
        <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  )
}

export function NotificationSettings() {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  /* Uptime */
  const [upChatId, setUpChatId] = useState('')
  const [upTopicId, setUpTopicId] = useState('')
  const [notifyOnDown, setNotifyOnDown] = useState(true)
  const [notifyOnUp, setNotifyOnUp] = useState(true)
  const [downTemplate, setDownTemplate] = useState('')
  const [upTemplate, setUpTemplate] = useState('')
  const [upTemplateOpen, setUpTemplateOpen] = useState(false)
  const [upSaving, setUpSaving] = useState(false)
  const [upTesting, setUpTesting] = useState(false)

  /* Billing */
  const [billingChatId, setBillingChatId] = useState('')
  const [billingTopicId, setBillingTopicId] = useState('')
  const [billingEnabled, setBillingEnabled] = useState(false)
  const [billingTime, setBillingTime] = useState('09:00')
  const [billingTemplate, setBillingTemplate] = useState('')
  const [billingNickname, setBillingNickname] = useState('')
  const [billingTemplateOpen, setBillingTemplateOpen] = useState(false)
  const [billingSaving, setBillingSaving] = useState(false)
  const [billingTesting, setBillingTesting] = useState(false)

  const showToast = (message: string, type: 'success' | 'error') => setToast({ message, type })

  useEffect(() => {
    settingsApi.getAll().then((data) => {
      setUpChatId(data['uptime_notify_chat_id'] || '')
      setUpTopicId(data['uptime_notify_topic_id'] || '')
      setNotifyOnDown(data['uptime_notify_on_down'] !== '0')
      setNotifyOnUp(data['uptime_notify_on_up'] !== '0')
      setDownTemplate(data['uptime_notify_down_template'] || DEFAULT_DOWN_TEMPLATE)
      setUpTemplate(data['uptime_notify_up_template'] || DEFAULT_UP_TEMPLATE)

      setBillingChatId(data['billing_notify_chat_id'] || '')
      setBillingTopicId(data['billing_notify_topic_id'] || '')
      setBillingEnabled(data['billing_notify_enabled'] === '1')
      setBillingTime(data['billing_notify_time'] || '09:00')
      setBillingTemplate(data['billing_notify_template'] || DEFAULT_BILLING_TEMPLATE)
      setBillingNickname(data['billing_notify_nickname'] || '')
    }).catch(() => showToast('Ошибка загрузки настроек', 'error'))
  }, [])

  const saveUptime = async () => {
    setUpSaving(true)
    try {
      await settingsApi.update({
        'uptime_notify_chat_id': upChatId,
        'uptime_notify_topic_id': upTopicId,
        'uptime_notify_on_down': notifyOnDown ? '1' : '0',
        'uptime_notify_on_up': notifyOnUp ? '1' : '0',
        'uptime_notify_down_template': downTemplate,
        'uptime_notify_up_template': upTemplate,
      })
      showToast('Настройки аптайма сохранены', 'success')
    } catch {
      showToast('Ошибка при сохранении аптайма', 'error')
    } finally {
      setUpSaving(false)
    }
  }

  const testUptime = async () => {
    setUpTesting(true)
    try {
      const result = await telegramApi.testNotify({
        chat_id: upChatId,
        topic_id: upTopicId,
        down_text: downTemplate.replace('{name}', 'Test Server').replace('{error}', 'тестовая ошибка'),
        up_text: '',
      })
      showToast(result.ok ? 'Тестовое уведомление отправлено' : 'Ошибка: ' + (result.error || 'неизвестная'), result.ok ? 'success' : 'error')
    } catch {
      showToast('Ошибка отправки тестового уведомления', 'error')
    } finally {
      setUpTesting(false)
    }
  }

  const saveBilling = async () => {
    setBillingSaving(true)
    try {
      await settingsApi.update({
        'billing_notify_chat_id': billingChatId,
        'billing_notify_topic_id': billingTopicId,
        'billing_notify_enabled': billingEnabled ? '1' : '0',
        'billing_notify_time': billingTime,
        'billing_notify_template': billingTemplate,
        'billing_notify_nickname': billingNickname,
      })
      showToast('Настройки биллинга сохранены', 'success')
    } catch {
      showToast('Ошибка при сохранении биллинга', 'error')
    } finally {
      setBillingSaving(false)
    }
  }

  const testBilling = async () => {
    setBillingTesting(true)
    try {
      const result = await telegramApi.testNotifyBilling({
        chat_id: billingChatId,
        topic_id: billingTopicId,
        template: billingTemplate,
      })
      showToast(result.ok ? 'Отчёт отправлен' : 'Ошибка: ' + (result.error || 'неизвестная'), result.ok ? 'success' : 'error')
    } catch {
      showToast('Ошибка отправки отчёта', 'error')
    } finally {
      setBillingTesting(false)
    }
  }

  const inputClass = 'w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm outline-none focus:border-primary/50'

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

      {/* Uptime section */}
      <div className="rounded-lg border border-border/50 bg-card p-5 space-y-5">
        <h3 className="text-lg font-medium">Аптайм</h3>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Chat ID</label>
            <input type="text" value={upChatId} onChange={(e) => setUpChatId(e.target.value)}
              placeholder="Например: -1001234567890" className={inputClass} />
            <p className="mt-1 text-xs text-muted-foreground/60">ID чата или канала для получения уведомлений</p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Topic ID (необязательно)</label>
            <input type="text" value={upTopicId} onChange={(e) => setUpTopicId(e.target.value)}
              placeholder="ID топика в группе" className={inputClass} />
            <p className="mt-1 text-xs text-muted-foreground/60">ID топика для отправки в обсуждение группы</p>
          </div>
          <div className="space-y-2">
            <ToggleSwitch checked={notifyOnDown} onChange={setNotifyOnDown}
              label="Сервер недоступен" description="Уведомлять когда сервер перестаёт отвечать" />
            <ToggleSwitch checked={notifyOnUp} onChange={setNotifyOnUp}
              label="Сервер снова доступен" description="Уведомлять когда сервер восстанавливается" />
          </div>
          <div className="rounded-lg border border-border/50">
            <button type="button" onClick={() => setUpTemplateOpen(!upTemplateOpen)}
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium transition-colors hover:bg-accent/30">
              <span>Шаблоны уведомлений</span>
              <span className={'transition-transform ' + (upTemplateOpen ? 'rotate-180' : '')}>{'\u25BC'}</span>
            </button>
            {upTemplateOpen && (
              <div className="space-y-4 border-t border-border/50 p-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Шаблон: сервер недоступен</label>
                  <textarea value={downTemplate} onChange={(e) => setDownTemplate(e.target.value)} rows={3}
                    className="w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 font-mono" />
                  <p className="mt-1 text-xs text-muted-foreground/60">{'{name}'} — имя сервера, {'{error}'} — текст ошибки</p>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Шаблон: сервер доступен</label>
                  <textarea value={upTemplate} onChange={(e) => setUpTemplate(e.target.value)} rows={3}
                    className="w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 font-mono" />
                  <p className="mt-1 text-xs text-muted-foreground/60">{'{name}'} — имя сервера</p>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={saveUptime} disabled={upSaving}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50">
              {upSaving ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button onClick={testUptime} disabled={upTesting}
              className="rounded-md border border-border/50 px-4 py-2 text-sm font-medium transition-colors hover:bg-accent/30 disabled:opacity-50">
              {upTesting ? 'Отправка...' : 'Тестовое уведомление'}
            </button>
          </div>
        </div>
      </div>

      {/* Billing section */}
      <div className="rounded-lg border border-border/50 bg-card p-5 space-y-5">
        <h3 className="text-lg font-medium">Биллинг</h3>
        <div className="space-y-4">
          <ToggleSwitch checked={billingEnabled} onChange={setBillingEnabled}
            label="Ежедневный отчёт" description="Автоматическая отправка сводки по аренде серверов" />

          <div>
            <label className="mb-1.5 block text-sm font-medium">Chat ID</label>
            <input type="text" value={billingChatId} onChange={(e) => setBillingChatId(e.target.value)}
              placeholder="Например: -1001234567890" className={inputClass} />
            <p className="mt-1 text-xs text-muted-foreground/60">ID чата или канала для получения отчёта</p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Topic ID (необязательно)</label>
            <input type="text" value={billingTopicId} onChange={(e) => setBillingTopicId(e.target.value)}
              placeholder="ID топика в группе" className={inputClass} />
            <p className="mt-1 text-xs text-muted-foreground/60">ID топика для отправки в обсуждение группы</p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Время отправки</label>
            <input type="time" value={billingTime} onChange={(e) => setBillingTime(e.target.value)}
              className={inputClass + ' w-32'} />
            <p className="mt-1 text-xs text-muted-foreground/60">Ежедневно в указанное время</p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Ник для оплаты</label>
            <input type="text" value={billingNickname} onChange={(e) => setBillingNickname(e.target.value)}
              placeholder="example_nickname" className={inputClass + ' max-w-xs'} />
            <p className="mt-1 text-xs text-muted-foreground/60">Добавляется в отчёт, если до оплаты остался 1 день</p>
          </div>

          <div className="rounded-lg border border-border/50">
            <button type="button" onClick={() => setBillingTemplateOpen(!billingTemplateOpen)}
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium transition-colors hover:bg-accent/30">
              <span>Шаблон отчёта</span>
              <span className={'transition-transform ' + (billingTemplateOpen ? 'rotate-180' : '')}>{'\u25BC'}</span>
            </button>
            {billingTemplateOpen && (
              <div className="space-y-3 border-t border-border/50 p-4">
                <textarea value={billingTemplate} onChange={(e) => setBillingTemplate(e.target.value)} rows={8}
                  className="w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 font-mono"
                  placeholder="Оставьте пустым для стандартного шаблона" />
                <p className="text-xs text-muted-foreground/60">
                  {'{date}'} — текущая дата, {'{groups}'} — список серверов по группам, {'{total}'} — итоговая сумма
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button onClick={saveBilling} disabled={billingSaving}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50">
              {billingSaving ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button onClick={testBilling} disabled={billingTesting}
              className="rounded-md border border-border/50 px-4 py-2 text-sm font-medium transition-colors hover:bg-accent/30 disabled:opacity-50">
              {billingTesting ? 'Отправка...' : 'Тестовый отчёт'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
