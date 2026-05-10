import { useState } from 'react'
import type { Server, PurposeItem } from '@/types'
import { DEFAULT_PURPOSES, COUNTRIES, CURRENCIES, CYCLES } from '@/types'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { StatusBadge } from './StatusBadge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import { Loader2, Pencil, Trash2, RefreshCw, X, Check, Eye, EyeOff, Wifi, CheckCircle, XCircle } from 'lucide-react'
import { uptimeApi } from '@/api/client'
import { flagImg, countryName } from '@/lib/flags'

const DEFAULT_PURPOSE_ORDER = ['PANEL', 'NODE', 'SERVICES']

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  if (!y || !m || !d) return dateStr
  return `${d}-${m}-${y}`
}

function daysRemaining(dateStr: string): number | null {
  if (!dateStr) return null
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return null
  const target = new Date(y, m - 1, d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  return diff
}

interface ServerTableProps {
  servers: Server[]
  onSync: (id: string) => void
  syncingId: string | null
  onDelete: (id: string) => void
  onSave: (id: string, data: Partial<Server>) => Promise<void>
  purposeOrder?: string[]
  purposes?: PurposeItem[]
}

export function ServerTable({ servers, onSync, syncingId, onDelete, onSave, purposeOrder, purposes }: ServerTableProps) {
  const order = purposeOrder ?? DEFAULT_PURPOSE_ORDER
  const purposeList = purposes ?? DEFAULT_PURPOSES
  const [monitorToast, setMonitorToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const groups = order
    .map((p) => ({ purpose: p, servers: servers.filter((s) => s.purpose === p) }))
    .filter((g) => g.servers.length > 0)

  const other = servers.filter((s) => !order.includes(s.purpose))
  if (other.length > 0) groups.push({ purpose: '', servers: other })

  if (groups.length === 0 && servers.length > 0) {
    groups.push({ purpose: '', servers })
  }

  return (
    <div className="rounded-lg border border-border/50 bg-card">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border/50">
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Сервер
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              IP
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Статус
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Стоимость
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Оплата
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Действия
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/30">
          {groups.map((group) => (
            <GroupSection
              key={group.purpose || '_'}
              purpose={group.purpose}
              servers={group.servers}
              onSync={onSync}
              syncingId={syncingId}
              onDelete={onDelete}
              onSave={onSave}
              purposeList={purposeList}
              onMonitorToast={setMonitorToast}
            />
          ))}

    {groups.length === 0 && (
            <tr>
              <td colSpan={6} className="py-12 text-center text-muted-foreground">
                Нет серверов. Добавьте первый сервер.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {monitorToast && (
        <div className="fixed bottom-4 left-4 z-[100] flex items-center gap-2 rounded-lg border px-3 py-2 text-xs shadow-lg"
          style={{
            borderColor: monitorToast.type === 'success' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
            backgroundColor: monitorToast.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            color: monitorToast.type === 'success' ? 'rgb(34,197,94)' : 'rgb(239,68,68)',
          }}
        >
          {monitorToast.type === 'success' ? <CheckCircle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
          {monitorToast.message}
        </div>
      )}
    </div>
  )
}

function GroupSection({
  purpose, servers, onSync, syncingId, onDelete, onSave, purposeList, onMonitorToast,
}: {
  purpose: string
  servers: Server[]
  onSync: (id: string) => void
  syncingId: string | null
  onDelete: (id: string) => void
  onSave: (id: string, data: Partial<Server>) => Promise<void>
  purposeList: PurposeItem[]
  onMonitorToast: (toast: { message: string; type: 'success' | 'error' } | null) => void
}) {
  const purposeLabel = purposeList.find((p) => p.value === purpose)?.label || purpose
  return (
    <>
      <tr className="bg-accent/5">
        <td colSpan={6} className="px-4 py-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">{purposeLabel}</span>
        </td>
      </tr>
      {servers.map((server) => (
        <ExpandRow
          key={server.id}
          server={server}
          onSync={onSync}
          syncingId={syncingId}
          onDelete={onDelete}
          onSave={onSave}
          purposeList={purposeList}
          onMonitorToast={onMonitorToast}
        />
      ))}
    </>
  )
}

function ExpandRow({
  server, onSync, syncingId, onDelete, onSave, purposeList, onMonitorToast,
}: {
  server: Server
  onSync: (id: string) => void
  syncingId: string | null
  onDelete: (id: string) => void
  onSave: (id: string, data: Partial<Server>) => Promise<void>
  purposeList: PurposeItem[]
  onMonitorToast: (toast: { message: string; type: 'success' | 'error' } | null) => void
}) {
  const purposeOptions = purposeList ?? DEFAULT_PURPOSES
  const [expanded, setExpanded] = useState(false)
  const [editData, setEditData] = useState<Partial<Server>>({})
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [addingMonitor, setAddingMonitor] = useState(false)

  const handleAddMonitor = async () => {
    setAddingMonitor(true)
    try {
      await uptimeApi.create({
        name: `${server.purpose} [${countryName(server.country)}] ${server.hosting}`,
        host: server.ip,
        port: server.ssh_port || 22,
        server_id: server.id,
      })
      onMonitorToast({ message: 'Монитор добавлен', type: 'success' })
    } catch {
      onMonitorToast({ message: 'Ошибка при добавлении монитора', type: 'error' })
    } finally {
      setAddingMonitor(false)
      setTimeout(() => onMonitorToast(null), 3000)
    }
  }

  const handleCancel = () => {
    setExpanded(false)
    setEditData({})
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(server.id, editData)
      setExpanded(false)
      setEditData({})
    } catch {
      console.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const edit = (field: string, value: unknown) => {
    setEditData((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <>
      <tr className="group transition-colors hover:bg-accent/20">
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {server.needs_sync && (
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
              </span>
            )}
            <span className="font-medium text-foreground">
              {server.purpose} [{flagImg(server.country) && <img src={flagImg(server.country)!} alt="" className="inline-block h-3.5 w-5 rounded align-text-bottom mr-0.5" />}{countryName(server.country)}] {server.hosting}
            </span>
          </div>
        </td>
        <td className="px-4 py-3">
          <code className="rounded bg-muted/50 px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
            {server.ip}
          </code>
        </td>
        <td className="px-4 py-3">
          <StatusBadge status={server.status as 'active' | 'inactive'} />
        </td>
        <td className="px-4 py-3 text-sm">
          {server.cost} {server.currency}
        </td>
        <td className="px-4 py-3 text-sm text-muted-foreground">
          {server.next_payment ? (
            <span className="flex items-center gap-1.5">
              <span>{formatDate(server.next_payment)}</span>
              {(() => {
                const days = daysRemaining(server.next_payment)
                if (days === null) return null
                if (days < 0) return <span className="text-destructive">-{Math.abs(days)}д</span>
                if (days === 0) return <span className="text-amber-400">сегодня</span>
                return <span className="text-muted-foreground/60">{days}д</span>
              })()}
            </span>
          ) : '—'}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-emerald-400/50 opacity-0 transition-all duration-200 hover:text-emerald-400 group-hover:opacity-100"
              onClick={handleAddMonitor}
              disabled={addingMonitor}
              title="Добавить монитор аптайма"
            >
              {addingMonitor ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Wifi className="h-3.5 w-3.5" />
              )}
            </Button>

            <Button
              size="sm"
              variant={server.needs_sync ? 'default' : 'ghost'}
              className={'h-7 w-7 p-0 ' + (server.needs_sync ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20' : '')}
              onClick={() => onSync(server.id)}
              disabled={syncingId === server.id}
            >
              {syncingId === server.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
            </Button>

            <Button
              size="sm"
              variant={expanded ? 'secondary' : 'ghost'}
              className={'h-7 w-7 p-0 transition-all duration-200 ' + (expanded ? '' : 'opacity-0 group-hover:opacity-100')}
              onClick={() => {
                if (expanded) {
                  handleCancel()
                } else {
                  setEditData({
                    purpose: server.purpose,
                    hosting: server.hosting,
                    country: server.country,
                    ip: server.ip,
                    ssh_port: server.ssh_port,
                    ssh_username: server.ssh_username,
                    ssh_password: server.ssh_password,
                    cost: server.cost,
                    currency: server.currency,
                    cycle: server.cycle,
                    created: server.created,
                    next_payment: server.next_payment,
                    notes: server.notes,
                  })
                  setExpanded(true)
                  setShowPassword(false)
                }
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-destructive/70 opacity-0 transition-all duration-200 hover:text-destructive group-hover:opacity-100"
              onClick={() => onDelete(server.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </td>
      </tr>

      {expanded && (
        <tr className="animate-expand-in bg-accent/10">
          <td colSpan={6} className="px-4 py-4">
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Назначение</label>
                  <Select value={editData.purpose || ''} onValueChange={(v) => edit('purpose', v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {purposeOptions.map((p) => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Хостинг</label>
                  <Input value={editData.hosting || ''} onChange={(e) => edit('hosting', e.target.value)} className="h-8 text-xs" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Страна</label>
                  <Select value={editData.country || ''} onValueChange={(v) => edit('country', v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">IP</label>
                  <Input value={editData.ip || ''} onChange={(e) => edit('ip', e.target.value)} className="h-8 text-xs" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">SSH порт</label>
                  <Input type="number" value={editData.ssh_port || 22} onChange={(e) => edit('ssh_port', parseInt(e.target.value))} className="h-8 text-xs" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">SSH логин</label>
                  <Input value={editData.ssh_username || ''} onChange={(e) => edit('ssh_username', e.target.value)} className="h-8 text-xs" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">SSH пароль</label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={editData.ssh_password || ''}
                      onChange={(e) => edit('ssh_password', e.target.value)}
                      className="h-8 text-xs pr-8"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Стоимость</label>
                  <Input type="number" step="0.01" value={editData.cost || ''} onChange={(e) => edit('cost', e.target.value ? parseFloat(e.target.value) : undefined)} className="h-8 text-xs" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Валюта</label>
                  <Select value={editData.currency || 'USD'} onValueChange={(v) => edit('currency', v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Цикл</label>
                  <Select value={editData.cycle || 'monthly'} onValueChange={(v) => edit('cycle', v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CYCLES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">След. оплата</label>
                  <Input type="date" value={editData.next_payment || ''} onChange={(e) => edit('next_payment', e.target.value)} className="h-8 text-xs" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Заметки</label>
                <Textarea value={editData.notes || ''} onChange={(e) => edit('notes', e.target.value)} className="h-16 text-xs" />
              </div>

              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={handleCancel} disabled={saving}>
                  <X className="h-3.5 w-3.5 mr-1" />
                  Отмена
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5 mr-1" />
                  )}
                  Сохранить
                </Button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
