import { useState } from 'react'
import { ServerCreate, PURPOSES, COUNTRIES, CURRENCIES, CYCLES, HOSTING_SUGGESTIONS } from '@/types'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'

interface ServerFormProps {
  onSubmit: (data: ServerCreate) => void
  onCancel?: () => void
  loading?: boolean
}

export function ServerForm({ onSubmit, onCancel, loading }: ServerFormProps) {
  const [formData, setFormData] = useState<ServerCreate>({
    purpose: 'NODE',
    hosting: '',
    country: '🇵🇱 Poland',
    ip: '',
    ssh_port: 22,
    ssh_username: 'root',
    ssh_password: '',
    traffic: '',
    cost: undefined,
    currency: 'USD',
    cycle: 'monthly',
    created: new Date().toISOString().split('T')[0],
    next_payment: '',
    notes: '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  const updateField = (field: keyof ServerCreate, value: string | number | undefined) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Назначение *</label>
          <Select
            value={formData.purpose}
            onValueChange={(v) => updateField('purpose', v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PURPOSES.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Страна</label>
          <Select
            value={formData.country}
            onValueChange={(v) => updateField('country', v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Хостинг *</label>
          <Input
            value={formData.hosting}
            onChange={(e) => updateField('hosting', e.target.value)}
            placeholder="Введите название или выберите"
            list="hosting-suggestions"
            required
          />
          <datalist id="hosting-suggestions">
            {HOSTING_SUGGESTIONS.map((h) => (
              <option key={h} value={h} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">IP адрес *</label>
          <Input
            value={formData.ip}
            onChange={(e) => updateField('ip', e.target.value)}
            placeholder="185.23.114.77"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">SSH порт</label>
          <Input
            type="number"
            value={formData.ssh_port}
            onChange={(e) => updateField('ssh_port', parseInt(e.target.value))}
            placeholder="22"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">SSH логин</label>
          <Input
            value={formData.ssh_username}
            onChange={(e) => updateField('ssh_username', e.target.value)}
            placeholder="root"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">SSH пароль</label>
        <Input
          type="password"
          value={formData.ssh_password}
          onChange={(e) => updateField('ssh_password', e.target.value)}
          placeholder="Пароль"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Стоимость</label>
          <Input
            type="number"
            step="0.01"
            value={formData.cost || ''}
            onChange={(e) => updateField('cost', e.target.value ? parseFloat(e.target.value) : undefined)}
            placeholder="6.99"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Валюта</label>
          <Select
            value={formData.currency}
            onValueChange={(v) => updateField('currency', v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Трафик</label>
          <Input
            value={formData.traffic}
            onChange={(e) => updateField('traffic', e.target.value)}
            placeholder="Безлимит"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Дата аренды</label>
          <Input
            type="date"
            value={formData.created}
            onChange={(e) => updateField('created', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Следующая оплата</label>
          <Input
            type="date"
            value={formData.next_payment}
            onChange={(e) => updateField('next_payment', e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Заметки</label>
        <Textarea
          value={formData.notes}
          onChange={(e) => updateField('notes', e.target.value)}
          placeholder="Заметки о сервере..."
        />
      </div>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Отмена
          </Button>
        )}
        <Button type="submit" disabled={loading}>
          {loading ? 'Сохранение...' : 'Сохранить'}
        </Button>
      </div>
    </form>
  )
}