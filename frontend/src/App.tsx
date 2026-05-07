import { useState, useEffect } from 'react'
import { serversApi, activityApi, settingsApi } from '@/api/client'
import type { Server, ServerCreate, ActivityLog, PurposeItem } from '@/types'
import { DEFAULT_PURPOSES } from '@/types'
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
import { AppearanceSettings } from '@/components/AppearanceSettings'
import { GeneralSettings } from '@/components/GeneralSettings'
import { HostingManager } from '@/components/HostingManager'
import { BillingPage } from '@/components/BillingPage'
import { IntegrationsSettings } from '@/components/IntegrationsSettings'
import { Plus, RefreshCw, Zap, Loader2, LayoutDashboard, X, Server as ServerIcon } from 'lucide-react'
import { countryName } from '@/lib/flags'

type View = 'dashboard' | 'servers' | 'billing' | 'activity' | 'settings'
type SettingsTab = 'general' | 'appearance' | 'hostings' | 'integrations'

const DEFAULT_ORDER = ['PANEL', 'NODE', 'SERVICES']

export default function App() {
  const [servers, setServers] = useState<Server[]>([])
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [purposeOrder, setPurposeOrder] = useState<string[]>(DEFAULT_ORDER)
  const [purposes, setPurposes] = useState<PurposeItem[]>(DEFAULT_PURPOSES)
  const [activeView, setActiveView] = useState<View>('servers')
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('general')
  const [deleteServerId, setDeleteServerId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [gradientBg, setGradientBg] = useState(() => {
    try {
      const saved = localStorage.getItem('skadik-theme-settings')
      if (saved) {
        const settings = JSON.parse(saved)
        return settings.gradientBg !== false
      }
    } catch {}
    return true
  })

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail && typeof detail.gradientBg === 'boolean') {
        setGradientBg(detail.gradientBg)
      }
    }
    window.addEventListener('theme-changed', handler)
    return () => window.removeEventListener('theme-changed', handler)
  }, [])

  const addActivity = async (text: string) => {
    const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    try {
      await activityApi.create(text, time)
      loadActivities()
    } catch {
      setActivities((prev) => [
        { id: crypto.randomUUID(), text, time, created_at: new Date().toISOString() },
        ...prev.slice(0, 49),
      ])
    }
  }

  const loadActivities = async () => {
    try {
      const data = await activityApi.getAll()
      setActivities(data)
    } catch {
      console.error('Failed to load activities')
    }
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
    loadActivities()
    settingsApi.getAll().then((s) => {
      if (s.purpose_order) {
        try { setPurposeOrder(JSON.parse(s.purpose_order)) } catch {}
      }
      if (s.purposes) {
        try { setPurposes(JSON.parse(s.purposes)) } catch {}
      }
    }).catch(() => {})
  }, [])

  const handleSaveServer = async (id: string, data: Partial<Server>) => {
    setSaving(true)
    try {
      const cleanedData = {
        ...data,
        traffic: data.traffic || undefined,
        next_payment: data.next_payment || undefined,
        notes: data.notes || undefined,
      }
      await serversApi.update(id, cleanedData)
      setToast({ message: 'Сервер обновлён', type: 'success' })
      addActivity('Обновлён сервер: ' + (data.purpose || '') + ' [' + countryName(data.country || '') + '] ' + (data.hosting || ''))
      loadServers()
    } catch (error) {
      setToast({ message: 'Ошибка при обновлении сервера', type: 'error' })
      console.error('Failed to update server:', error)
      throw error
    } finally {
      setSaving(false)
    }
  }

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
      addActivity('Добавлен сервер: ' + data.purpose + ' [' + countryName(data.country) + '] ' + data.hosting)
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
      const result = await serversApi.sync(id)
      const errors: string[] = []
      if (result.termix && !result.termix.success) errors.push('Termix: ' + (result.termix.error || 'неизвестная ошибка'))
      if (result.google_drive && !result.google_drive.success) errors.push('Google Drive: ' + (result.google_drive.error || 'неизвестная ошибка'))
      if (errors.length > 0) {
        setToast({ message: errors.join('; '), type: 'error' })
      } else {
        setToast({ message: 'Синхронизация завершена', type: 'success' })
      }
      const server = servers.find((s) => s.id === id)
      if (server) addActivity('Синхронизация: ' + server.purpose + ' [' + countryName(server.country) + '] ' + server.hosting)
      loadServers()
    } catch (error) {
      setToast({ message: 'Ошибка синхронизации', type: 'error' })
      console.error('Failed to sync server:', error)
    } finally {
      setSyncingId(null)
    }
  }

  const handleDeleteActivity = async (id: string) => {
    try {
      await activityApi.delete(id)
      setActivities((prev) => prev.filter((a) => a.id !== id))
    } catch {
      setToast({ message: 'Ошибка при удалении', type: 'error' })
    }
  }

  const handleDelete = async (id: string) => {
    setDeleting(true)
    try {
      const server = servers.find((s) => s.id === id)
      await serversApi.delete(id)
      setToast({ message: 'Сервер удалён', type: 'success' })
      if (server) addActivity('Удалён сервер: ' + server.purpose + ' [' + countryName(server.country) + '] ' + server.hosting)
      setDeleteServerId(null)
      loadServers()
    } catch (error) {
      setToast({ message: 'Ошибка при удалении сервера', type: 'error' })
      console.error('Failed to delete server:', error)
    } finally {
      setDeleting(false)
    }
  }

  const activeCount = servers.filter((s) => s.status === 'active').length

  return (
    <div className={'flex min-h-screen ' + (gradientBg ? 'bg-background' : 'bg-background')}>
      {gradientBg && (
        <div className="gradient-bg">
          <div className="gradient-orb" />
          <div className="gradient-orb" />
          <div className="gradient-orb" />
        </div>
      )}
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
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border/50 bg-background/80 px-6 backdrop-blur">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold">
              {activeView === 'dashboard' && 'Дашборд'}
              {activeView === 'servers' && 'Серверы'}
              {activeView === 'billing' && 'Биллинг'}
              {activeView === 'activity' && 'Активность'}
              {activeView === 'settings' && 'Настройки'}
            </h1>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Zap className="h-3 w-3 text-primary" />
              <span>{activeCount} активных</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeView === 'servers' && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadServers}
                  disabled={loading}
                >
                  <RefreshCw className={'h-4 w-4' + (loading ? ' animate-spin' : '')} />
                </Button>
                <Button
                  size="sm"
                  onClick={() => setShowAddDialog(true)}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Добавить сервер
                </Button>
              </>
            )}
            {activeView === 'activity' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={loadActivities}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
          </div>
        </header>

        <main className="flex-1 p-6">
          {activeView === 'dashboard' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-lg border border-border/50 bg-card p-5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ServerIcon className="h-4 w-4" />
                  <span>Всего серверов</span>
                </div>
                <p className="mt-2 text-3xl font-bold">{servers.length}</p>
              </div>
              <div className="rounded-lg border border-border/50 bg-card p-5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Zap className="h-4 w-4" />
                  <span>Активных</span>
                </div>
                <p className="mt-2 text-3xl font-bold text-emerald-400">{activeCount}</p>
              </div>
              <div className="rounded-lg border border-border/50 bg-card p-5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <LayoutDashboard className="h-4 w-4" />
                  <span>Событий</span>
                </div>
                <p className="mt-2 text-3xl font-bold">{activities.length}</p>
              </div>
            </div>
          )}

          {activeView === 'servers' && (
            <>
              {activities.length > 0 && (
                <div className="mb-4 rounded-lg border border-border/50 bg-card/50 px-4 py-2">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Последние действия:</span>
                    {activities.slice(0, 3).map((item) => (
                      <span key={item.id} className="flex items-center gap-1.5">
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
                    onSave={handleSaveServer}
                    purposeOrder={purposeOrder}
                    purposes={purposes}
                  />
              )}
            </>
          )}

          {activeView === 'billing' && (
            <BillingPage servers={servers} />
          )}

          {activeView === 'activity' && (
            <div className="space-y-2">
              {activities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <p className="text-sm">Нет активности</p>
                </div>
              ) : (
                activities.map((item) => (
                  <div
                    key={item.id}
                    className="group flex items-center gap-4 rounded-lg border border-border/50 bg-card px-4 py-3 transition-colors hover:bg-accent/30"
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                    <span className="flex-1 text-sm">{item.text}</span>
                    <span className="text-xs text-muted-foreground/60">{item.time}</span>
                    <button
                      onClick={() => handleDeleteActivity(item.id)}
                      className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {activeView === 'settings' && (
            <div>
              <div className="mb-6 flex gap-1 rounded-lg border border-border/50 bg-card p-1">
                {(['general', 'appearance', 'hostings', 'integrations'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setSettingsTab(tab)}
                    className={'flex-1 rounded-md px-3 py-2 text-sm transition-colors ' + (settingsTab === tab
                      ? 'bg-accent text-foreground'
                      : 'text-muted-foreground hover:text-foreground')}
                  >
                    {tab === 'general' && 'Общее'}
                    {tab === 'appearance' && 'Внешний вид'}
                    {tab === 'hostings' && 'Хостинги'}
                    {tab === 'integrations' && 'Интеграции'}
                  </button>
                ))}
              </div>

              {settingsTab === 'general' && <GeneralSettings onPurposesChange={setPurposes} />}
              {settingsTab === 'appearance' && <AppearanceSettings />}
              {settingsTab === 'hostings' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-semibold">Хостинги</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Управление хостинг-провайдерами
                    </p>
                  </div>
                  <HostingManager />
                </div>
              )}
              {settingsTab === 'integrations' && <IntegrationsSettings />}
            </div>
          )}
        </main>
      </div>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Добавить сервер</DialogTitle>
            <DialogDescription>
              Заполните информацию о сервере для синхронизации
            </DialogDescription>
          </DialogHeader>
          <ServerForm
            key="add"
            onSubmit={handleAddServer}
            onCancel={() => setShowAddDialog(false)}
            loading={saving}
            purposes={purposes}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={deleteServerId !== null} onOpenChange={(open) => !open && setDeleteServerId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Удалить сервер</DialogTitle>
            <DialogDescription>
              Вы уверены, что хотите удалить сервер? Это действие нельзя отменить.
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
