import { useState, useEffect } from 'react'
import { serversApi } from '@/api/client'
import type { Server, ServerCreate } from '@/types'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ServerTable } from '@/components/ServerTable'
import { ServerForm } from '@/components/ServerForm'
import { ServerCard } from '@/components/ServerCard'
import { Plus, Server as ServerIcon, RefreshCw } from 'lucide-react'

export default function App() {
  const [servers, setServers] = useState<Server[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [syncingId, setSyncingId] = useState<string | null>(null)

  const loadServers = async () => {
    try {
      const data = await serversApi.getAll()
      setServers(data)
    } catch (error) {
      console.error('Failed to load servers:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadServers()
  }, [])

  const handleAddServer = async (data: ServerCreate) => {
    try {
      await serversApi.create(data)
      setShowAddDialog(false)
      loadServers()
    } catch (error) {
      console.error('Failed to create server:', error)
    }
  }

  const handleSync = async (id: string) => {
    setSyncingId(id)
    try {
      await serversApi.sync(id)
      loadServers()
    } catch (error) {
      console.error('Failed to sync server:', error)
    } finally {
      setSyncingId(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm('Удалить сервер?')) {
      try {
        await serversApi.delete(id)
        loadServers()
      } catch (error) {
        console.error('Failed to delete server:', error)
      }
    }
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Skadik Synk</h1>
            <p className="text-muted-foreground">Управление серверами</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadServers}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Обновить
            </Button>
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Добавить сервер
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Добавить сервер</DialogTitle>
                  <DialogDescription>
                    Заполните информацию о сервере для синхронизации
                  </DialogDescription>
                </DialogHeader>
                <ServerForm
                  onSubmit={handleAddServer}
                  onCancel={() => setShowAddDialog(false)}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8">Загрузка...</div>
        ) : (
          <>
            <div className="mb-8">
              <ServerTable servers={servers} onSync={handleSync} />
            </div>

            {servers.length > 0 && (
              <div>
                <h2 className="mb-4 text-xl font-semibold">Карточки серверов</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {servers.map((server) => (
                    <ServerCard
                      key={server.id}
                      server={server}
                      onSync={handleSync}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}