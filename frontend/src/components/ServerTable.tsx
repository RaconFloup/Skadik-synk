import { Server } from '@/types'
import { Button } from './ui/button'
import { StatusBadge } from './StatusBadge'
import { Loader2, MoreHorizontal, Pencil, Trash2, RefreshCw } from 'lucide-react'
import { useState } from 'react'

interface ServerTableProps {
  servers: Server[]
  onSync: (id: string) => void
  syncingId: string | null
  onDelete: (id: string) => void
  onEdit: (server: Server) => void
}

export function ServerTable({ servers, onSync, syncingId, onDelete, onEdit }: ServerTableProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

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
          {servers.map((server) => (
            <tr
              key={server.id}
              className="group transition-colors hover:bg-accent/20"
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  {server.needs_sync && (
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                    </span>
                  )}
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-foreground">{server.purpose}</span>
                    <span className="text-xs text-muted-foreground">
                      {server.hosting} • {server.country}
                    </span>
                  </div>
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
                {server.next_payment || '—'}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1">
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

                  <div className="relative">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={() => setOpenMenuId(openMenuId === server.id ? null : server.id)}
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>

                    {openMenuId === server.id && (
                      <div className="absolute right-0 top-8 z-50 w-36 rounded-lg border border-border/50 bg-card p-1 shadow-lg">
                        <button
                          onClick={() => {
                            onEdit(server)
                            setOpenMenuId(null)
                          }}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Редактировать
                        </button>
                        <button
                          onClick={() => {
                            onDelete(server.id)
                            setOpenMenuId(null)
                          }}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-destructive transition-colors hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Удалить
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </td>
            </tr>
          ))}

          {servers.length === 0 && (
            <tr>
              <td colSpan={6} className="py-12 text-center text-muted-foreground">
                Нет серверов. Добавьте первый сервер.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
