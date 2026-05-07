import { useState, useEffect, useMemo } from 'react'
import { hostingApi } from '@/api/client'
import type { Hosting, PurposeItem, ServerCreate } from '@/types'
import { DEFAULT_PURPOSES, COUNTRIES, CURRENCIES, CYCLES, HOSTING_SUGGESTIONS } from '@/types'
import { flagImg, countryName } from '@/lib/flags'
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
import { Loader2, ServerIcon } from 'lucide-react'

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
  country: 'pl Poland',
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
}

export function ServerForm({ onSubmit, onCancel, loading, initialData, purposes }: ServerFormProps) {
  const purposeOptions = purposes ?? DEFAULT_PURPOSES
  const [formData, setFormData] = useState<ServerCreate>(() => defaultFormData(initialData))
  const [hostings, setHostings] = useState<Hosting[]>([])

  const hostingOptions = useMemo(() => {
    const list: Hosting[] = hostings.length > 0
      ? hostings
      : HOSTING_SUGGESTIONS.map((n) => ({ id: n, name: n } as Hosting))

    const names = new Set(list.map((h) => h.name))

    if (formData.hosting && !names.has(formData.hosting)) {
      list.push({ id: formData.hosting, name: formData.hosting } as Hosting)
    }

    return list
  }, [hostings, formData.hosting])

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
          <Select
            value={formData.country}
            onValueChange={(v) => updateField('country', v)}
            disabled={loading}
          >
            <SelectTrigger>
              <SelectValue>
                {formData.country && (() => {
                  const url = flagImg(formData.country)
                  return url ? (
                    <span className="flex items-center gap-1.5">
                      <img src={url} alt="" className="h-4 w-5 rounded object-cover" />
                      {countryName(formData.country)}
                    </span>
                  ) : (
                    countryName(formData.country)
                  )
                })()}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((c) => {
                const url = flagImg(c.value)
                return (
                  <SelectItem key={c.value} value={c.value}>
                    <span className="flex items-center gap-1.5">
                      {url && <img src={url} alt="" className="h-4 w-5 rounded object-cover" />}
                      {c.label}
                    </span>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Хостинг *</label>
          <Select
            value={formData.hosting}
            onValueChange={(v) => updateField('hosting', v)}
            disabled={loading}
          >
            <SelectTrigger>
              {formData.hosting ? (
                <div className="flex items-center gap-2">
                  {(() => {
                    const h = hostings.find((x) => x.name === formData.hosting)
                    return h?.logo_url ? (
                      <img src={h.logo_url} alt="" className="h-4 w-4 rounded object-contain" />
                    ) : (
                      <ServerIcon className="h-4 w-4 text-muted-foreground" />
                    )
                  })()}
                  <span>{formData.hosting}</span>
                </div>
              ) : (
                <span className="text-muted-foreground">Выберите хостинг</span>
              )}
            </SelectTrigger>
            <SelectContent>
              {hostingOptions.map((h) => (
                <SelectItem key={h.id} value={h.name}>
                  <div className="flex items-center gap-2">
                    {(h as Hosting).logo_url ? (
                      <img src={(h as Hosting).logo_url!} alt="" className="h-4 w-4 rounded object-contain" />
                    ) : (
                      <ServerIcon className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span>{h.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          <label className="block text-sm font-medium mb-1">Трафик</label>
          <Input
            value={formData.traffic}
            onChange={(e) => updateField('traffic', e.target.value)}
            placeholder="Безлимит"
            disabled={loading}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Дата аренды</label>
          <Input
            type="date"
            value={formData.created}
            onChange={(e) => updateField('created', e.target.value)}
            disabled={loading}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Следующая оплата</label>
          <Input
            type="date"
            value={formData.next_payment}
            onChange={(e) => updateField('next_payment', e.target.value)}
            disabled={loading}
          />
        </div>
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
