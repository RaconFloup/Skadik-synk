import { Server } from '@/types'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card'
import { Loader2 } from 'lucide-react'

interface ServerCardProps {
  server: Server
  onSync: (id: string) => void
  onEdit?: (server: Server) => void
  onDelete?: (id: string) => void
  syncing?: boolean
}

export function ServerCard({ server, onSync, onEdit, onDelete, syncing }: ServerCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {server.purpose} {server.country && `[${server.country}]`}
        </CardTitle>
        <CardDescription>{server.hosting}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">IP:</span>
            <span className="font-mono">{server.ip}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Статус:</span>
            <span className={server.status === 'active' ? 'text-green-600' : 'text-gray-600'}>
              {server.status === 'active' ? 'Активен' : 'Неактивен'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Стоимость:</span>
            <span>{server.cost} {server.currency}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">След. оплата:</span>
            <span>{server.next_payment || '-'}</span>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Button size="sm" onClick={() => onSync(server.id)} disabled={syncing}>
            {syncing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Синхронизация...
              </>
            ) : (
              'Синхронизация'
            )}
          </Button>
          {onEdit && (
            <Button size="sm" variant="outline" onClick={() => onEdit(server)}>
              Изменить
            </Button>
          )}
          {onDelete && (
            <Button size="sm" variant="destructive" onClick={() => onDelete(server.id)}>
              Удалить
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
