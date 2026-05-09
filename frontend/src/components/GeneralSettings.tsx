import { useState, useEffect } from 'react'
import { settingsApi } from '@/api/client'
import { DEFAULT_PURPOSES, CURRENCIES } from '@/types'
import type { PurposeItem } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, ChevronUp, ChevronDown, Plus, Pencil, Trash2, X, Check } from 'lucide-react'

interface GeneralSettingsProps {
  onPurposesChange?: (purposes: PurposeItem[]) => void
}

export function GeneralSettings({ onPurposesChange }: GeneralSettingsProps) {
  const [baseCurrency, setBaseCurrency] = useState('RUB')
  const [purposes, setPurposes] = useState<PurposeItem[]>(DEFAULT_PURPOSES)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editLabel, setEditLabel] = useState('')
  const [newValue, setNewValue] = useState('')
  const [newLabel, setNewLabel] = useState('')

  useEffect(() => {
    settingsApi.getAll().then((s) => {
      if (s.base_currency) setBaseCurrency(s.base_currency)
      if (s.purposes) {
        try {
          const parsed: PurposeItem[] = JSON.parse(s.purposes)
          setPurposes(parsed)
        } catch {}
      }
    }).finally(() => setLoading(false))
  }, [])

  const savePurposes = async (updated: PurposeItem[]) => {
    setSaving(true)
    try {
      const order = updated.map((p) => p.value)
      await settingsApi.update({
        purposes: JSON.stringify(updated),
        purpose_order: JSON.stringify(order),
      })
      setPurposes(updated)
      onPurposesChange?.(updated)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveCurrency = async () => {
    setSaving(true)
    try {
      await settingsApi.update({ base_currency: baseCurrency })
    } finally {
      setSaving(false)
    }
  }

  const moveUp = (index: number) => {
    if (index === 0) return
    const next = [...purposes]
    ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
    savePurposes(next)
  }

  const moveDown = (index: number) => {
    if (index === purposes.length - 1) return
    const next = [...purposes]
    ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
    savePurposes(next)
  }

  const handleAdd = () => {
    const value = newValue.trim().toUpperCase()
    const label = newLabel.trim() || value
    if (!value) return
    if (purposes.some((p) => p.value === value)) return
    savePurposes([...purposes, { value, label }])
    setNewValue('')
    setNewLabel('')
  }

  const handleDelete = (value: string) => {
    savePurposes(purposes.filter((p) => p.value !== value))
  }

  const startEdit = (index: number) => {
    setEditingIndex(index)
    setEditValue(purposes[index].value)
    setEditLabel(purposes[index].label)
  }

  const cancelEdit = () => {
    setEditingIndex(null)
    setEditValue('')
    setEditLabel('')
  }

  const saveEdit = () => {
    if (editingIndex === null) return
    const updated = [...purposes]
    updated[editingIndex] = {
      value: editValue.trim().toUpperCase() || updated[editingIndex].value,
      label: editLabel.trim() || editValue.trim().toUpperCase() || updated[editingIndex].label,
    }
    savePurposes(updated)
    cancelEdit()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-r-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Общие настройки</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Основная валюта и управление назначениями
        </p>
      </div>

      <div className="rounded-xl border border-border/50 bg-card p-5 shadow-sm max-w-md">
        <label className="block text-sm font-medium mb-2">Основная валюта</label>
        <p className="mb-3 text-xs text-muted-foreground">
          Все стоимости будут конвертироваться и отображаться в этой валюте
        </p>
        <select
          value={baseCurrency}
          onChange={(e) => setBaseCurrency(e.target.value)}
          className="w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm"
        >
          {CURRENCIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <Button className="mt-4" size="sm" onClick={handleSaveCurrency} disabled={saving}>
          {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Сохранить
        </Button>
      </div>

      <div className="rounded-xl border border-border/50 bg-card p-5 shadow-sm max-w-md">
        <label className="block text-sm font-medium mb-2">Назначения</label>
        <p className="mb-3 text-xs text-muted-foreground">
          Серверы в списке будут сгруппированы в этом порядке. Можно добавлять, редактировать и удалять назначения.
        </p>

        <div className="space-y-1">
          {purposes.map((p, index) => (
            <div
              key={p.value}
              className="flex items-center justify-between rounded-lg border border-border/50 bg-background px-3 py-2"
            >
              {editingIndex === index ? (
                <div className="flex flex-1 items-center gap-2">
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    placeholder="VALUE"
                    className="h-7 w-24 text-xs uppercase"
                  />
                  <Input
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    placeholder="Label"
                    className="h-7 w-28 text-xs"
                  />
                  <button onClick={saveEdit} className="rounded p-0.5 text-emerald-400 hover:text-emerald-300">
                    <Check className="h-4 w-4" />
                  </button>
                  <button onClick={cancelEdit} className="rounded p-0.5 text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <span className="text-sm font-medium">
                    <span className="text-muted-foreground">{p.value}</span>
                    {p.label !== p.value && <span className="ml-1.5 text-xs text-muted-foreground/60">({p.label})</span>}
                  </span>
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => moveUp(index)}
                      disabled={index === 0 || saving}
                      className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => moveDown(index)}
                      disabled={index === purposes.length - 1 || saving}
                      className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => startEdit(index)}
                      className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(p.value)}
                      className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Input
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="VALUE"
            className="h-8 w-24 text-xs uppercase"
          />
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Label"
            className="h-8 w-28 text-xs"
          />
          <Button size="sm" variant="outline" onClick={handleAdd} disabled={!newValue.trim() || saving}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Добавить
          </Button>
        </div>
      </div>
    </div>
  )
}
