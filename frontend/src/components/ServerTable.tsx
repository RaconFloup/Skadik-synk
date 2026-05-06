import { Server } from '@/types'
import { Button } from './ui/button'

interface ServerTableProps {
  servers: Server[]
  onSync: (id: string) => void
}

export function ServerTable({ servers, onSync }: ServerTableProps) {
  return (
    <div className="rounded-md border">
      <table className="w-full">
        <thead className="bg-muted">
          <tr>
            <th className="p-4 text-left font-medium">Назначение</th>
            <th className="p-4 text-left font-medium">Страна</th>
            <th className="p-4 text-left font-medium">Хостинг</th>
            <th className="p-4 text-left font-medium">IP</th>
            <th className="p-4 text-left font-medium">Статус</th>
            <th className="p-4 text-left font-medium">Стоимость</th>
            <th className="p-4 text-left font-medium">След. оплата</th>
            <th className="p-4 text-left font-medium">Действия</th>
          </tr>
        </thead>
        <tbody>
          {servers.map((server) => (
            <tr key={server.id} className="border-t">
              <td className="p-4">{server.purpose}</td>
              <td className="p-4">{server.country}</td>
              <td className="p-4">{server.hosting}</td>
              <td className="p-4 font-mono text-sm">{server.ip}</td>
              <td className="p-4">
                <span
                  className={`inline-flex rounded-full px-2 py-1 text-xs ${
                    server.status === 'active'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {server.status === 'active' ? 'Активен' : 'Неактивен'}
                </span>
              </td>
              <td className="p-4">
                {server.cost} {server.currency}
              </td>
              <td className="p-4">{server.next_payment || '-'}</td>
              <td className="p-4">
                <Button size="sm" variant="outline" onClick={() => onSync(server.id)}>
                  Синхр
                </Button>
              </td>
            </tr>
          ))}
          {servers.length === 0 && (
            <tr>
              <td colSpan={8} className="p-8 text-center text-muted-foreground">
                Нет серверов. Добавьте первый сервер.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}