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
} from '@/components/ui/dialog'
import { Toast } from '@/components/ui/toast'
import { ServerTable } from '@/components/ServerTable'
import { ServerForm } from '@/components/ServerForm'
import { Sidebar } from '@/components/Sidebar'
import { Plus, RefreshCw, Zap, Loader2 } from 'lucide-react'

export default function App() {
  const [servers, setServers] = useState<Server[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [activeView, setActiveView] = useState<'servers' | 'activity' | 'settings'>('servers')
  const [recentActivity, setRecentActivity] = useState<{ text: string; time: string }[]>([])
  const [deleteServerId, setDeleteServerId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const addActivity = (text: string) => {
    setRecentActivity((prev) => [
      { text, time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) },
      ...prev.slice(0, 9),
    ])
  }

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
      addActivity(`Добавлен сервер: ${data.purpose} [${data.country}]`)
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
      const server = servers.find((s) => s.id === id)
      if (server) addActivity(`Синхронизация: ${server.purpose}`)
      loadServers()
    } catch (error) {
      setToast({ message: 'Ошибка синхронизации', type: 'error' })
      console.error('Failed to sync server:', error)
    } finally {
      setSyncingId(null)
    }
  }

  const handleDelete = async (id: string) => {
    setDeleting(true)
    try {
      const server = servers.find((s) => s.id === id)
      await serversApi.delete(id)
      setToast({ message: 'Сервер удалён', type: 'success' })
      if (server) addActivity(`Удалён сервер: ${server.purpose}`)
      setDeleteServerId(null)
      loadServers()
    } catch (error) {
      setToast({ message: 'Ошибка при удалении сервера', type: 'error' })
      console.error('Failed to delete server:', error)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <Sidebar
        activeView={activeView}
        onViewChange={setActiveView}
        serverCount={servers.length}
      />

      <div className="flex flex-1 flex-col">
        {/* Header */}
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border/50 bg-background/80 px-6 backdrop-blur">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold">
              {activeView === 'servers' && 'Серверы'}
              {activeView === 'activity' && 'Активность'}
              {activeView === 'settings' && 'Настройки'}
            </h1>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Zap className="h-3 w-3 text-primary" />
              <span>{servers.filter((s) => s.status === 'active').length} активных</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={loadServers}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              size="sm"
              onClick={() => setShowAddDialog(true)}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Добавить сервер
            </Button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-6">
          {activeView === 'servers' && (
            <>
              {/* Activity Bar */}
              {recentActivity.length > 0 && (
                <div className="mb-4 rounded-lg border border-border/50 bg-card/50 px-4 py-2">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Последние действия:</span>
                    {recentActivity.slice(0, 3).map((item, i) => (
                      <span key={i} className="flex items-center gap-1.5">
                        <span className="h-1 w-1 rounded-full bg-primary/60" />
                        {item.text}
                        <span className="opacity-50">{item.time}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-r-transparent" />
                    <p className="text-sm text-muted-foreground">Загрузка серверов...</p>
                  </div>
                </div>
              ) : servers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="rounded-full bg-accent/50 p-4">
                    <Zap className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="mt-4 text-lg font-medium">Нет серверов</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Добавьте первый сервер для начала работы
                  </p>
                  <Button className="mt-4" onClick={() => setShowAddDialog(true)}>
                    <Plus className="mr-1.5 h-4 w-4" />
                    Добавить сервер
                  </Button>
                </div>
              ) : (
                <ServerTable
                  servers={servers}
                  onSync={handleSync}
                  syncingId={syncingId}
                  onDelete={(id) => setDeleteServerId(id)}
                />
              )}
            </>
          )}

          {activeView === 'activity' && (
            <div className="space-y-2">
              {recentActivity.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <p className="text-sm">Нет активности</p>
                </div>
              ) : (
                recentActivity.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-4 rounded-lg border border-border/50 bg-card px-4 py-3 transition-colors hover:bg-accent/30"
                  >
                    <span className="h-2 w-2 rounded-full bg-primary" />
                    <span className="flex-1 text-sm">{item.text}</span>
                    <span className="text-xs text-muted-foreground/60">{item.time}</span>
                  </div>
                ))
              )}
            </div>
          )}

          {activeView === 'settings' && (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <p className="text-sm">Настройки в разработке</p>
            </div>
          )}
        </main>
      </div>

      {/* Add Server Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteServerId !== null} onOpenChange={(open) => !open && setDeleteServerId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Удалить сервер</DialogTitle>
            <DialogDescription>
              {deleteServerId && (() => {
                const server = servers.find((s) => s.id === deleteServerId)
                return server ? `Вы уверены, что хотите удалить "${server.purpose}"? Это действие нельзя отменить.` : 'Вы уверены?'
              })()}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteServerId(null)}>
              Отмена
            </Button>
            <Button variant="destructive" disabled={deleting} onClick={() => deleteServerId && handleDelete(deleteServerId)}>
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Удаление...
                </>
              ) : (
                'Удалить'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
