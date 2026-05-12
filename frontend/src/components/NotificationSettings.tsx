import { useState } from 'react'
import UptimeSection from './UptimeSection'
import BillingSection from './BillingSection'

export function NotificationSettings() {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showToast = (message: string, type: 'success' | 'error') => setToast({ message, type })

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

      <UptimeSection showToast={showToast} />
      <BillingSection showToast={showToast} />
    </div>
  )
}
