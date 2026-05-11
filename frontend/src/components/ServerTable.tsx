import { useState, useEffect } from 'react'
import type { Server, PurposeItem } from '@/types'
import { DEFAULT_PURPOSES, CURRENCIES, CYCLES } from '@/types'
import { hostingApi } from '@/api/client'
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
import { Loader2, Pencil, Trash2, RefreshCw, X, Check, Eye, EyeOff, ServerIcon, Zap } from 'lucide-react'

import { flagImg, countryName } from '@/lib/flags'
import { CountryCombobox } from './CountryCombobox'

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

function DaysBadge({ date }: { date: string }) {
  const days = daysRemaining(date)
  if (days === null) return null
  if (days < 0) return <span className="text-destructive">-{Math.abs(days)}д</span>
  if (days === 0) return <span className="text-amber-400">сегодня</span>
  return <span className="text-muted-foreground/60">{days}д</span>
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
  const [hostingLogoMap, setHostingLogoMap] = useState<Record<string, string>>({})

  useEffect(() => {
    hostingApi.getAll().then((hostings) => {
      const map: Record<string, string> = {}
      hostings.forEach((h) => { if (h.name) map[h.name] = h.logo_url || '' })
      setHostingLogoMap(map)
    }).catch(() => {})
  }, [])

  const groups = order
    .map((p) => ({ purpose: p, servers: servers.filter((s) => s.purpose === p) }))
    .filter((g) => g.servers.length > 0)

  const other = servers.filter((s) => !order.includes(s.purpose))
  if (other.length > 0) groups.push({ purpose: '', servers: other })

  if (groups.length === 0 && servers.length > 0) {
    groups.push({ purpose: '', servers })
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block rounded-lg border border-border/50 bg-card overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="border-b border-border/50">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Сервер</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">IP</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Статус</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Стоимость</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Оплата</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {groups.map((group) => (
              <DesktopGroupSection
                key={group.purpose || '_'}
                purpose={group.purpose}
                servers={group.servers}
                onSync={onSync}
                syncingId={syncingId}
                onDelete={onDelete}
                onSave={onSave}
                purposeList={purposeList}
                hostingLogoMap={hostingLogoMap}
              />
            ))}
            {groups.length === 0 && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-muted-foreground">Нет серверов. Добавьте первый сервер.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="block md:hidden space-y-3">
        {groups.map((group) => (
          <MobileGroupSection
            key={group.purpose || '_'}
            purpose={group.purpose}
            servers={group.servers}
            onSync={onSync}
            syncingId={syncingId}
            onDelete={onDelete}
            onSave={onSave}
            purposeList={purposeList}
            hostingLogoMap={hostingLogoMap}
          />
        ))}
        {groups.length === 0 && (
          <div className="rounded-lg border border-border/50 bg-card py-12 text-center text-muted-foreground">
            Нет серверов. Добавьте первый сервер.
          </div>
        )}
      </div>
    </>
  )
}

function DesktopGroupSection({
  purpose, servers, onSync, syncingId, onDelete, onSave, purposeList, hostingLogoMap,
}: {
  purpose: string; servers: Server[]; onSync: (id: string) => void; syncingId: string | null
  onDelete: (id: string) => void; onSave: (id: string, data: Partial<Server>) => Promise<void>
  purposeList: PurposeItem[]; hostingLogoMap: Record<string, string>
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
        <DesktopRow
          key={server.id}
          server={server}
          onSync={onSync}
          syncingId={syncingId}
          onDelete={onDelete}
          onSave={onSave}
          purposeList={purposeList}
          hostingLogoMap={hostingLogoMap}
        />
      ))}
    </>
  )
}

function DesktopRow({
  server, onSync, syncingId, onDelete, onSave, purposeList, hostingLogoMap,
}: {
  server: Server; onSync: (id: string) => void; syncingId: string | null
  onDelete: (id: string) => void; onSave: (id: string, data: Partial<Server>) => Promise<void>
  purposeList: PurposeItem[]; hostingLogoMap: Record<string, string>
}) {
  const [expanded, setExpanded] = useState(false)
  return (
    <>
      <tr className="group transition-colors hover:bg-accent/20">
        <td className="px-4 py-3">
          <ServerNameCell server={server} hostingLogoMap={hostingLogoMap} purposeList={purposeList} />
        </td>
        <td className="px-4 py-3">
          <code className="rounded bg-muted/50 px-1.5 py-0.5 text-xs font-mono text-muted-foreground">{server.ip}</code>
        </td>
        <td className="px-4 py-3"><StatusBadge status={server.status as 'active' | 'inactive'} /></td>
        <td className="px-4 py-3 text-sm">{server.cost} {server.currency}</td>
        <td className="px-4 py-3 text-sm text-muted-foreground">
          {server.next_payment ? (
            <span className="flex items-center gap-1.5">
              <span>{formatDate(server.next_payment)}</span>
              <DaysBadge date={server.next_payment} />
            </span>
          ) : '—'}
        </td>
        <td className="px-4 py-3">
          <ActionButtons
            server={server}
            syncingId={syncingId}
            onSync={onSync}
            onDelete={onDelete}
            onEdit={() => setExpanded(true)}
            onCancelEdit={() => setExpanded(false)}
            expanded={expanded}
            showOnHover={true}
          />
        </td>
      </tr>
      {expanded && (
        <DesktopEditRow
          server={server}
          onSave={onSave}
          purposeList={purposeList}
          onClose={() => setExpanded(false)}
        />
      )}
    </>
  )
}

function ServerNameCell({ server, hostingLogoMap, purposeList }: { server: Server; hostingLogoMap: Record<string, string>; purposeList: PurposeItem[] }) {
  const purposeLabel = purposeList.find((p) => p.value === server.purpose)?.label || server.purpose
  return (
    <div className="flex items-center gap-2">
      {server.needs_sync && (
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
        </span>
      )}
      <div className="min-w-0">
        <div className="font-medium text-foreground truncate">
          {purposeLabel} [{flagImg(server.country) && <img src={flagImg(server.country)!} alt="" className="inline-block h-3.5 w-5 rounded align-text-bottom mr-0.5" />}{countryName(server.country)}]
        </div>
        <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground/70">
          {hostingLogoMap[server.hosting] ? (
            <img src={hostingLogoMap[server.hosting]} alt="" className="h-3 w-3 shrink-0 rounded object-contain" />
          ) : (
            <ServerIcon className="h-3 w-3 shrink-0" />
          )}
          <span className="truncate">{server.hosting}</span>
        </div>
      </div>
    </div>
  )
}

function ActionButtons({ server, syncingId, onSync, onDelete, onEdit, onCancelEdit, expanded, showOnHover }: {
  server: Server; syncingId: string | null; onSync: (id: string) => void
  onDelete: (id: string) => void; onEdit: () => void; onCancelEdit: () => void
  expanded: boolean; showOnHover: boolean
}) {
  const hoverClass = showOnHover ? 'opacity-0 group-hover:opacity-100' : ''
  return (
    <div className="flex items-center justify-end gap-1">
      <Button size="sm" variant={server.needs_sync ? 'default' : 'ghost'}
        className={'h-8 w-8 p-0 ' + (server.needs_sync ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20' : '')}
        onClick={() => onSync(server.id)} disabled={syncingId === server.id}>
        {syncingId === server.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
      </Button>
      <Button size="sm" variant={expanded ? 'secondary' : 'ghost'}
        className={'h-8 w-8 p-0 transition-all duration-200 ' + (expanded ? '' : hoverClass)}
        onClick={() => expanded ? onCancelEdit() : onEdit()}>
        <Pencil className="h-4 w-4" />
      </Button>
      <Button size="sm" variant="ghost"
        className={'h-8 w-8 p-0 text-destructive/70 transition-all duration-200 hover:text-destructive ' + hoverClass}
        onClick={() => onDelete(server.id)}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )
}

function DesktopEditRow({ server, onSave, purposeList, onClose }: {
  server: Server; onSave: (id: string, data: Partial<Server>) => Promise<void>
  purposeList: PurposeItem[]; onClose: () => void
}) {
  return <EditFormRow server={server} onSave={onSave} purposeList={purposeList} onClose={onClose} />
}

function EditFormRow({ server, onSave, purposeList, onClose }: {
  server: Server; onSave: (id: string, data: Partial<Server>) => Promise<void>
  purposeList: PurposeItem[]; onClose: () => void
}) {
  const [editData, setEditData] = useState<Partial<Server>>({
    purpose: server.purpose, hosting: server.hosting, country: server.country, ip: server.ip,
    ssh_port: server.ssh_port, ssh_username: server.ssh_username, ssh_password: server.ssh_password,
    cost: server.cost, currency: server.currency, cycle: server.cycle,
    created: server.created, next_payment: server.next_payment, notes: server.notes,
  })
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const purposeOptions = purposeList ?? DEFAULT_PURPOSES

  const edit = (field: string, value: unknown) => setEditData((prev) => ({ ...prev, [field]: value }))

  const handleSave = async () => {
    setSaving(true)
    try { await onSave(server.id, editData); onClose() } catch { console.error('Failed to save') }
    finally { setSaving(false) }
  }

  return (
    <tr className="animate-expand-in bg-accent/10">
      <td colSpan={6} className="px-4 py-4">
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Назначение</label>
              <Select value={editData.purpose || ''} onValueChange={(v) => edit('purpose', v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {purposeOptions.map((p) => (<SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Хостинг</label>
              <Input value={editData.hosting || ''} onChange={(e) => edit('hosting', e.target.value)} className="h-8 text-xs" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Страна</label>
              <CountryCombobox value={editData.country || ''} onChange={(v) => edit('country', v)} placeholder="Введите или выберите" className="h-8 text-xs" />
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
                <Input type={showPassword ? 'text' : 'password'} value={editData.ssh_password || ''} onChange={(e) => edit('ssh_password', e.target.value)} className="h-8 text-xs pr-8" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
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
                <SelectContent>{CURRENCIES.map((c) => (<SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Цикл</label>
              <Select value={editData.cycle || 'monthly'} onValueChange={(v) => edit('cycle', v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{CYCLES.map((c) => (<SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>))}</SelectContent>
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
            <Button size="sm" variant="outline" onClick={onClose} disabled={saving}>
              <X className="h-3.5 w-3.5 mr-1" /> Отмена
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1" />}
              Сохранить
            </Button>
          </div>
        </div>
      </td>
    </tr>
  )
}

/* Mobile card components */

function MobileGroupSection({
  purpose, servers, onSync, syncingId, onDelete, onSave, purposeList, hostingLogoMap,
}: {
  purpose: string; servers: Server[]; onSync: (id: string) => void; syncingId: string | null
  onDelete: (id: string) => void; onSave: (id: string, data: Partial<Server>) => Promise<void>
  purposeList: PurposeItem[]; hostingLogoMap: Record<string, string>
}) {
  const purposeLabel = purposeList.find((p) => p.value === purpose)?.label || purpose
  return (
    <div>
      <div className="px-1 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">{purposeLabel}</span>
      </div>
      <div className="space-y-2">
        {servers.map((server) => (
          <MobileCard
            key={server.id}
            server={server}
            onSync={onSync}
            syncingId={syncingId}
            onDelete={onDelete}
            onSave={onSave}
            purposeList={purposeList}
            hostingLogoMap={hostingLogoMap}
          />
        ))}
      </div>
    </div>
  )
}

function MobileCard({
  server, onSync, syncingId, onDelete, onSave, purposeList, hostingLogoMap,
}: {
  server: Server; onSync: (id: string) => void; syncingId: string | null
  onDelete: (id: string) => void; onSave: (id: string, data: Partial<Server>) => Promise<void>
  purposeList: PurposeItem[]; hostingLogoMap: Record<string, string>
}) {
  const [expanded, setExpanded] = useState(false)
  const [editData, setEditData] = useState<Partial<Server>>({})
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const openEdit = () => {
    setEditData({
      purpose: server.purpose, hosting: server.hosting, country: server.country, ip: server.ip,
      ssh_port: server.ssh_port, ssh_username: server.ssh_username, ssh_password: server.ssh_password,
      cost: server.cost, currency: server.currency, cycle: server.cycle,
      created: server.created, next_payment: server.next_payment, notes: server.notes,
    })
    setExpanded(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try { await onSave(server.id, editData); setExpanded(false); setEditData({}) }
    catch { console.error('Failed to save') }
    finally { setSaving(false) }
  }

  const edit = (field: string, value: unknown) => setEditData((prev) => ({ ...prev, [field]: value }))

  return (
    <div className="rounded-lg border border-border/50 bg-card overflow-hidden">
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0 flex-1">
            {server.needs_sync && (
              <span className="relative flex h-2 w-2 shrink-0 mt-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="font-medium text-foreground text-sm truncate">
                {flagImg(server.country) && <img src={flagImg(server.country)!} alt="" className="inline-block h-3.5 w-5 rounded align-text-bottom mr-1" />}
                {countryName(server.country)}
              </div>
              <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground/70">
                {hostingLogoMap[server.hosting] ? (
                  <img src={hostingLogoMap[server.hosting]} alt="" className="h-3 w-3 shrink-0 rounded object-contain" />
                ) : (
                  <ServerIcon className="h-3 w-3 shrink-0" />
                )}
                <span className="truncate">{server.hosting}</span>
                <span className="mx-1">·</span>
                {server.ip}
              </div>
            </div>
          </div>
          <StatusBadge status={server.status as 'active' | 'inactive'} />
        </div>

        <div className="mt-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <span className="text-foreground font-medium">{server.cost} {server.currency}</span>
            {server.next_payment && (
              <span className="text-muted-foreground flex items-center gap-1">
                <Zap className="h-3 w-3" />
                {formatDate(server.next_payment)}
                <DaysBadge date={server.next_payment} />
              </span>
            )}
          </div>
        </div>

        <div className="mt-2 flex items-center justify-end gap-1">
          <Button size="sm" variant={server.needs_sync ? 'default' : 'ghost'}
            className={'h-8 w-8 p-0 ' + (server.needs_sync ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20' : '')}
            onClick={() => onSync(server.id)} disabled={syncingId === server.id}>
            {syncingId === server.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
          <Button size="sm" variant={expanded ? 'secondary' : 'ghost'} className="h-8 w-8 p-0"
            onClick={openEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive/70 hover:text-destructive"
            onClick={() => onDelete(server.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border/50 bg-accent/10 p-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium mb-1">Назначение</label>
              <Select value={editData.purpose || ''} onValueChange={(v) => edit('purpose', v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(purposeList ?? DEFAULT_PURPOSES).map((p) => (<SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Страна</label>
              <CountryCombobox value={editData.country || ''} onChange={(v) => edit('country', v)} placeholder="" className="h-8 text-xs" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Хостинг</label>
              <Input value={editData.hosting || ''} onChange={(e) => edit('hosting', e.target.value)} className="h-8 text-xs" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">IP</label>
              <Input value={editData.ip || ''} onChange={(e) => edit('ip', e.target.value)} className="h-8 text-xs" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">SSH порт</label>
              <Input type="number" value={editData.ssh_port || 22} onChange={(e) => edit('ssh_port', parseInt(e.target.value))} className="h-8 text-xs" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">SSH логин</label>
              <Input value={editData.ssh_username || ''} onChange={(e) => edit('ssh_username', e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1">SSH пароль</label>
              <div className="relative">
                <Input type={showPassword ? 'text' : 'password'} value={editData.ssh_password || ''} onChange={(e) => edit('ssh_password', e.target.value)} className="h-8 text-xs pr-8" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Стоимость</label>
              <Input type="number" step="0.01" value={editData.cost || ''} onChange={(e) => edit('cost', e.target.value ? parseFloat(e.target.value) : undefined)} className="h-8 text-xs" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Валюта</label>
              <Select value={editData.currency || 'USD'} onValueChange={(v) => edit('currency', v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{CURRENCIES.map((c) => (<SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Цикл</label>
              <Select value={editData.cycle || 'monthly'} onValueChange={(v) => edit('cycle', v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{CYCLES.map((c) => (<SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">След. оплата</label>
              <Input type="date" value={editData.next_payment || ''} onChange={(e) => edit('next_payment', e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1">Заметки</label>
              <Textarea value={editData.notes || ''} onChange={(e) => edit('notes', e.target.value)} className="h-16 text-xs" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button size="sm" variant="outline" onClick={() => { setExpanded(false); setEditData({}) }} disabled={saving} className="h-8 text-xs">
              <X className="h-3.5 w-3.5 mr-1" /> Отмена
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="h-8 text-xs">
              {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1" />}
              Сохранить
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
