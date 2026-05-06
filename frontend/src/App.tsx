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
import { Toast } from '@/components/ui/toast'
import { ServerTable } from '@/components/ServerTable'
import { ServerForm } from '@/components/ServerForm'
import { ServerCard } from '@/components/ServerCard'
import { Plus, Server as ServerIcon, RefreshCw } from 'lucide-react'

export default function App() {
  const [servers, setServers] = useState<Server[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

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
    setSaving(true)
    try {
      const cleanedData = {
        ...data,
        traffic: data.traffic || undefined,
        next_payment: data.next_payment || undefined,
        notes: data.notes || undefined,
      }
      await serversApi.create(cleanedData)
      setShowAddDialog(false)
      setToast({ message: 'Сервер успешно добавлен', type: 'success' })
      loadServers()
    } catch (error) {
      setToast({ message: 'Ошибка при добавлении сервера', type: 'error' })
      console.error('Failed to create server:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleSync = async (id: string) => {
    setSyncingId(id)
    try {
      await serversApi.sync(id)
      setToast({ message: 'Синхронизация завершена', type: 'success' })
      loadServers()
    } catch (error) {
      setToast({ message: 'Ошибка синхронизации', type: 'error' })
      console.error('Failed to sync server:', error)
    } finally {
      setSyncingId(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm('Удалить сервер?')) {
      try {
        await serversApi.delete(id)
        setToast({ message: 'Сервер удалён', type: 'success' })
        loadServers()
      } catch (error) {
        setToast({ message: 'Ошибка при удалении сервера', type: 'error' })
        console.error('Failed to delete server:', error)
      }
    }
  }

  return (
    <div className="min-h-screen bg-background p-8">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
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
                  loading={saving}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent" />
            <p className="mt-2 text-muted-foreground">Загрузка...</p>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <ServerTable servers={servers} onSync={handleSync} syncingId={syncingId} />
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
                      syncing={syncingId === server.id}
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
