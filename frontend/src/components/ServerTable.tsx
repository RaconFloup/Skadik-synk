import { useState, useEffect } from 'react'
import type { Server, PurposeItem } from '@/types'
import { DEFAULT_PURPOSES, CURRENCIES, CYCLES } from '@/types'
import { hostingApi, settingsApi } from '@/api/client'
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
  if (days < 0) return <span className="text-destructive font-medium">-{Math.abs(days)}д</span>
  if (days === 0) return <span className="text-amber-400 font-medium">сегодня</span>
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
  const [mainCurrency, setMainCurrency] = useState('RUB')

  useEffect(() => {
    Promise.all([
      hostingApi.getAll().catch(() => []),
      settingsApi.getAll().catch(() => ({} as Record<string, string>)),
    ]).then(([hostings, settings]) => {
      const map: Record<string, string> = {}
      hostings.forEach((h) => { if (h.name) map[h.name] = h.logo_url || '' })
      setHostingLogoMap(map)
      const s = settings as Record<string, string>
      if (s.main_currency) setMainCurrency(s.main_currency)
    })
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
    <div className="space-y-6">
      {groups.map((group) => (
        <ServerGroupSection
          key={group.purpose || '_'}
          purpose={group.purpose}
          servers={group.servers}
          onSync={onSync}
          syncingId={syncingId}
          onDelete={onDelete}
          onSave={onSave}
          purposeList={purposeList}
          hostingLogoMap={hostingLogoMap}
          mainCurrency={mainCurrency}
        />
      ))}
      {groups.length === 0 && (
        <div className="rounded-lg border border-border/50 bg-card py-12 text-center text-muted-foreground">
          Нет серверов. Добавьте первый сервер.
        </div>
      )}
    </div>
  )
}

function ServerGroupSection({
  purpose, servers, onSync, syncingId, onDelete, onSave, purposeList, hostingLogoMap, mainCurrency,
}: {
  purpose: string; servers: Server[]; onSync: (id: string) => void; syncingId: string | null
  onDelete: (id: string) => void; onSave: (id: string, data: Partial<Server>) => Promise<void>
  purposeList: PurposeItem[]; hostingLogoMap: Record<string, string>; mainCurrency: string
}) {
  const purposeLabel = purposeList.find((p) => p.value === purpose)?.label || purpose
  const count = servers.length
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">{purposeLabel}</span>
        <span className="text-xs text-muted-foreground/40">· {count}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {servers.map((server) => (
          <ServerCard
            key={server.id}
            server={server}
            onSync={onSync}
            syncingId={syncingId}
            onDelete={onDelete}
            onSave={onSave}
            purposeList={purposeList}
            hostingLogoMap={hostingLogoMap}
            mainCurrency={mainCurrency}
          />
        ))}
      </div>
    </div>
  )
}

function ServerCard({
  server, onSync, syncingId, onDelete, onSave, purposeList, hostingLogoMap, mainCurrency,
}: {
  server: Server; onSync: (id: string) => void; syncingId: string | null
  onDelete: (id: string) => void; onSave: (id: string, data: Partial<Server>) => Promise<void>
  purposeList: PurposeItem[]; hostingLogoMap: Record<string, string>; mainCurrency: string
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

  const costInMain = server.costs?.[mainCurrency]
  const CURR_SYMBOLS: Record<string, string> = { RUB: '₽', USD: '$', EUR: '€' }
  const mainSym = CURR_SYMBOLS[mainCurrency] || mainCurrency
  const origSym = CURR_SYMBOLS[server.currency] || server.currency
  const showOrig = costInMain && server.cost && server.currency !== mainCurrency

  return (
    <div className={'rounded-lg border border-border/50 bg-card transition-shadow duration-200 overflow-hidden ' + (expanded ? 'shadow-md' : 'hover:shadow-sm')}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            {server.needs_sync && (
              <span className="relative flex h-2.5 w-2.5 shrink-0 mt-1">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-foreground text-sm truncate flex items-center gap-1.5">
                {flagImg(server.country) && <img src={flagImg(server.country)!} alt="" className="inline-block h-4 w-6 rounded align-text-bottom" />}
                <span className="truncate">{countryName(server.country)}</span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground/70">
                {hostingLogoMap[server.hosting] ? (
                  <img src={hostingLogoMap[server.hosting]} alt="" className="h-3.5 w-3.5 shrink-0 rounded object-contain" />
                ) : (
                  <ServerIcon className="h-3.5 w-3.5 shrink-0" />
                )}
                <span className="truncate">{server.hosting}</span>
              </div>
            </div>
          </div>
          <StatusBadge status={server.status as 'active' | 'inactive'} />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span className="font-medium text-foreground">{costInMain ? mainSym + costInMain.toFixed(2) : (server.cost ?? '—')}</span>
            {showOrig && <span className="text-muted-foreground/60">({origSym}{server.cost})</span>}
            {!costInMain && server.cost && <span>{server.currency}</span>}
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Zap className="h-3 w-3 shrink-0" />
            {server.next_payment ? (
              <span className="flex items-center gap-1">
                {formatDate(server.next_payment)}
                <DaysBadge date={server.next_payment} />
              </span>
            ) : <span>—</span>}
          </div>
          <div className="col-span-2">
            <code className="rounded bg-muted/50 px-1.5 py-0.5 text-xs font-mono text-muted-foreground">{server.ip}</code>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-end gap-1.5 border-t border-border/30 pt-3">
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
        <div className="border-t border-border/50 bg-accent/10 p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">Назначение</label>
              <Select value={editData.purpose || ''} onValueChange={(v) => edit('purpose', v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(purposeList ?? DEFAULT_PURPOSES).map((p) => (<SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">Страна</label>
              <CountryCombobox value={editData.country || ''} onChange={(v) => edit('country', v)} placeholder="" className="h-8 text-xs" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">Хостинг</label>
              <Input value={editData.hosting || ''} onChange={(e) => edit('hosting', e.target.value)} className="h-8 text-xs" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">IP</label>
              <Input value={editData.ip || ''} onChange={(e) => edit('ip', e.target.value)} className="h-8 text-xs" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">SSH порт</label>
              <Input type="number" value={editData.ssh_port || 22} onChange={(e) => edit('ssh_port', parseInt(e.target.value))} className="h-8 text-xs" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">SSH логин</label>
              <Input value={editData.ssh_username || ''} onChange={(e) => edit('ssh_username', e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="col-span-2 sm:col-span-3">
              <label className="block text-xs font-medium mb-1 text-muted-foreground">SSH пароль</label>
              <div className="relative">
                <Input type={showPassword ? 'text' : 'password'} value={editData.ssh_password || ''}
                  onChange={(e) => edit('ssh_password', e.target.value)} className="h-8 text-xs pr-8" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">Стоимость</label>
              <Input type="number" step="0.01" value={editData.cost || ''}
                onChange={(e) => edit('cost', e.target.value ? parseFloat(e.target.value) : undefined)} className="h-8 text-xs" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">Валюта</label>
              <Select value={editData.currency || 'USD'} onValueChange={(v) => edit('currency', v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{CURRENCIES.map((c) => (<SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">Цикл</label>
              <Select value={editData.cycle || 'monthly'} onValueChange={(v) => edit('cycle', v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{CYCLES.map((c) => (<SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">След. оплата</label>
              <Input type="date" value={editData.next_payment || ''} onChange={(e) => edit('next_payment', e.target.value)} className="h-8 text-xs" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1 text-muted-foreground">Заметки</label>
            <Textarea value={editData.notes || ''} onChange={(e) => edit('notes', e.target.value)} className="h-16 text-xs" />
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
