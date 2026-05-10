import { useState, useEffect } from 'react'
import { hostingApi } from '@/api/client'
import type { Hosting, PurposeItem, ServerCreate } from '@/types'
import { DEFAULT_PURPOSES, CURRENCIES, CYCLES } from '@/types'

import { Button } from './ui/button'
import { CountryCombobox } from './CountryCombobox'
import { HostingCombobox } from './HostingCombobox'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import { Loader2 } from 'lucide-react'

interface ServerFormProps {
  onSubmit: (data: ServerCreate) => void
  onCancel?: () => void
  loading?: boolean
  initialData?: ServerCreate
  purposes?: PurposeItem[]
}

const defaultFormData = (initial?: ServerCreate): ServerCreate => initial ?? {
  purpose: 'NODE',
  hosting: '',
  country: '',
  ip: '',
  ssh_port: 22,
  ssh_username: 'root',
  ssh_password: '',
  cost: undefined,
  currency: 'USD',
  cycle: 'monthly',
  created: new Date().toISOString().split('T')[0],
  next_payment: '',
  notes: '',
}

export function ServerForm({ onSubmit, onCancel, loading, initialData, purposes }: ServerFormProps) {
  const purposeOptions = purposes ?? DEFAULT_PURPOSES
  const [formData, setFormData] = useState<ServerCreate>(() => defaultFormData(initialData))
  const [hostings, setHostings] = useState<Hosting[]>([])

  useEffect(() => {
    hostingApi.getAll().then(setHostings).catch(() => {})
  }, [])

  useEffect(() => {
    if (formData.created && formData.cycle) {
      const date = new Date(formData.created)
      switch (formData.cycle) {
        case 'daily': date.setDate(date.getDate() + 1); break
        case 'weekly': date.setDate(date.getDate() + 7); break
        case 'monthly': date.setMonth(date.getMonth() + 1); break
        case 'yearly': date.setFullYear(date.getFullYear() + 1); break
      }
      const next = date.toISOString().split('T')[0]
      setFormData((prev) => ({ ...prev, next_payment: next }))
    }
  }, [formData.created, formData.cycle])

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
            disabled={loading}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {purposeOptions.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Страна</label>
          <CountryCombobox
            value={formData.country}
            onChange={(v) => updateField('country', v)}
            disabled={loading}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Хостинг *</label>
          <HostingCombobox
            value={formData.hosting}
            onChange={(v) => updateField('hosting', v)}
            hostings={hostings}
            onHostingsChange={() => hostingApi.getAll().then(setHostings).catch(() => {})}
            disabled={loading}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">IP адрес *</label>
          <Input
            value={formData.ip}
            onChange={(e) => updateField('ip', e.target.value)}
            placeholder="185.23.114.77"
            required
            disabled={loading}
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
            disabled={loading}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">SSH логин</label>
          <Input
            value={formData.ssh_username}
            onChange={(e) => updateField('ssh_username', e.target.value)}
            placeholder="root"
            disabled={loading}
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
          disabled={loading}
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
            disabled={loading}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Валюта</label>
          <Select
            value={formData.currency}
            onValueChange={(v) => updateField('currency', v)}
            disabled={loading}
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
          <label className="block text-sm font-medium mb-1">Цикл аренды</label>
          <Select
            value={formData.cycle}
            onValueChange={(v) => updateField('cycle', v)}
            disabled={loading}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CYCLES.map((c) => (
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
          <label className="block text-sm font-medium mb-1">Дата аренды</label>
          <Input
            type="date"
            value={formData.created}
            onChange={(e) => updateField('created', e.target.value)}
            disabled={loading}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Следующая оплата</label>
          <Input
            type="date"
            value={formData.next_payment}
            onChange={(e) => updateField('next_payment', e.target.value)}
            disabled={loading}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Заметки</label>
          <Textarea
            value={formData.notes}
            onChange={(e) => updateField('notes', e.target.value)}
            placeholder="Заметки о сервере..."
            disabled={loading}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Отмена
          </Button>
        )}
        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Сохранение...
            </>
          ) : (
            'Сохранить'
          )}
        </Button>
      </div>
    </form>
  )
}
