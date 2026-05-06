import { Server } from '@/types'
import { Button } from './ui/button'
import { StatusBadge } from './StatusBadge'
import { Loader2, Trash2, RefreshCw, ServerIcon } from 'lucide-react'

interface ServerCardProps {
  server: Server
  onSync: (id: string) => void
  onDelete?: (id: string) => void
  syncing?: boolean
}

export function ServerCard({ server, onSync, onDelete, syncing }: ServerCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-lg border border-border/50 bg-card p-4 transition-all hover:border-primary/30 hover:shadow-sm">
      {/* Status indicator */}
      <div className={`absolute left-0 top-0 h-full w-0.5 ${
        server.status === 'active' ? 'bg-emerald-400' : 'bg-muted'
      }`} />

      <div className="ml-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <ServerIcon className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{server.purpose}</span>
          </div>
          <StatusBadge status={server.status as 'active' | 'inactive'} />
        </div>

        <div className="mt-3 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Хостинг</span>
            <span>{server.hosting}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Страна</span>
            <span>{server.country}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">IP</span>
            <code className="rounded bg-muted/50 px-1.5 py-0.5 font-mono text-xs">
              {server.ip}
            </code>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Стоимость</span>
            <span>{server.cost} {server.currency}</span>
          </div>
          {server.next_payment && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Оплата</span>
              <span>{server.next_payment}</span>
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-end gap-1 border-t border-border/30 pt-3">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => onSync(server.id)}
            disabled={syncing}
          >
            {syncing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <>
                <RefreshCw className="mr-1 h-3 w-3" />
                Синхр
              </>
            )}
          </Button>

          {onDelete && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-destructive opacity-0 transition-opacity group-hover:opacity-100"
              onClick={() => onDelete(server.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
