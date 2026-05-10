import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { COUNTRIES } from '@/types'
import { flagImg } from '@/lib/flags'
import { cn } from '@/lib/utils'

interface CountryComboboxProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  className?: string
}

export function CountryCombobox({ value, onChange, disabled, placeholder = 'Введите или выберите страну', className }: CountryComboboxProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const filtered = COUNTRIES.filter((c) =>
    c.label.toLowerCase().includes(search.toLowerCase()) ||
    c.value.toLowerCase().includes(search.toLowerCase())
  )

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

  const selectedCountry = COUNTRIES.find((c) => c.value === value)
  const flagUrl = flagImg(value)

  const handleSelect = (val: string) => {
    onChange(val)
    setOpen(false)
    setEditing(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
          disabled && 'cursor-not-allowed opacity-50',
          className
        )}
        onClick={() => !disabled && !open && setOpen(true)}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {flagUrl ? (
            <img src={flagUrl} alt="" className="h-4 w-5 shrink-0 rounded object-cover" />
          ) : value ? (
            <span className="shrink-0 text-xs">🌐</span>
          ) : null}
          {editing ? (
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                onChange(e.target.value)
              }}
              onBlur={() => setEditing(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setEditing(false)
                if (e.key === 'Escape') { setEditing(false); setOpen(false) }
              }}
              className="min-w-0 flex-1 bg-transparent outline-none text-sm"
              autoFocus
            />
          ) : (
            <span className={cn('truncate', !value && 'text-muted-foreground')}>
              {selectedCountry ? selectedCountry.label : (value || placeholder)}
            </span>
          )}
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </div>

      {open && !editing && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="p-1">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск..."
              className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              autoFocus
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                Ничего не найдено
              </div>
            ) : (
              filtered.map((c) => {
                const url = flagImg(c.value)
                const isSelected = c.value === value
                return (
                  <div
                    key={c.value}
                    className={cn(
                      'relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-xs outline-none transition-colors hover:bg-accent hover:text-accent-foreground',
                      isSelected && 'bg-accent/50'
                    )}
                    onClick={() => handleSelect(c.value)}
                  >
                    {url ? (
                      <img src={url} alt="" className="h-4 w-5 shrink-0 rounded object-cover" />
                    ) : (
                      <span className="shrink-0 text-xs">🌐</span>
                    )}
                    <span className="truncate">{c.label}</span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
