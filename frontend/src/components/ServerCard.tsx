import { Server } from '@/types'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card'

interface ServerCardProps {
  server: Server
  onSync: (id: string) => void
  onEdit?: (server: Server) => void
  onDelete?: (id: string) => void
}

export function ServerCard({ server, onSync, onEdit, onDelete }: ServerCardProps) {
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
          <Button size="sm" onClick={() => onSync(server.id)}>
            Синхронизация
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