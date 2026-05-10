import { useState, useRef, useEffect } from 'react'
import { ChevronDown, ServerIcon, Plus, Loader2 } from 'lucide-react'
import { hostingApi } from '@/api/client'
import type { Hosting } from '@/types'
import { cn } from '@/lib/utils'

interface HostingComboboxProps {
  value: string
  onChange: (value: string) => void
  hostings: Hosting[]
  onHostingsChange?: () => void
  disabled?: boolean
  className?: string
}

export function HostingCombobox({ value, onChange, hostings, onHostingsChange, disabled, className }: HostingComboboxProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const filtered = hostings.filter((h) =>
    h.name.toLowerCase().includes(search.toLowerCase())
  )

  const showAdd = search.trim().length > 0 && !hostings.some((h) => h.name.toLowerCase() === search.trim().toLowerCase())

  useEffect(() => {
    if (!open) setSearch('')
  }, [open])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node))
        setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleAdd = async () => {
    if (!search.trim() || adding) return
    setAdding(true)
    try {
      await hostingApi.create({ name: search.trim() })
      onChange(search.trim())
      setOpen(false)
      onHostingsChange?.()
    } catch {} finally {
      setAdding(false)
    }
  }

  const selected = hostings.find((h) => h.name === value)

  return (
    <div ref={containerRef} className="relative">
      <div
        className={cn(
          'flex h-10 w-full cursor-pointer items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
          disabled && 'cursor-not-allowed opacity-50',
          className
        )}
        onClick={() => {
          if (disabled) return
          if (!open) setOpen(true)
        }}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {selected?.logo_url ? (
            <img src={selected.logo_url} alt="" className="h-4 w-4 shrink-0 rounded object-contain" />
          ) : value ? (
            <ServerIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : null}
          <span className={cn('truncate', !value && 'text-muted-foreground')}>
            {value || 'Выберите хостинг'}
          </span>
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="p-1">
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                if (!e.target.value) onChange('')
              }}
              placeholder="Поиск..."
              className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              autoFocus
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {filtered.map((h) => {
              const isSelected = h.name === value
              return (
                <div
                  key={h.id}
                  className={cn(
                    'relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-xs outline-none transition-colors hover:bg-accent hover:text-accent-foreground',
                    isSelected && 'bg-accent/50'
                  )}
                  onClick={() => { onChange(h.name); setOpen(false) }}
                >
                  {h.logo_url ? (
                    <img src={h.logo_url} alt="" className="h-4 w-4 shrink-0 rounded object-contain" />
                  ) : (
                    <ServerIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="truncate">{h.name}</span>
                </div>
              )
            })}
            {showAdd && (
              <div
                className="relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-xs outline-none transition-colors hover:bg-accent hover:text-accent-foreground border-t border-border/50 mt-1 pt-2"
                onClick={handleAdd}
              >
                {adding ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 shrink-0" />
                )}
                <span>Добавить «{search.trim()}»</span>
              </div>
            )}
            {filtered.length === 0 && !showAdd && (
              <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                Ничего не найдено
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
