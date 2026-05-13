import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { serversApi, activityApi, settingsApi, brandingApi, uptimeApi, getAuthToken, setAuthToken, setAuthFailureCallback } from '@/api/client'
import type { Server, ServerCreate, ActivityLog, PurposeItem, UptimeMonitorWithStatus } from '@/types'
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
import { MonitoringPage } from '@/components/MonitoringPage'
import { AppearanceSettings } from '@/components/AppearanceSettings'
import { GeneralSettings } from '@/components/GeneralSettings'
import { HostingManager } from '@/components/HostingManager'
import { BillingPage } from '@/components/BillingPage'
import { IntegrationsSettings } from '@/components/IntegrationsSettings'
import { LoginPage } from '@/components/LoginPage'
import { FAQPage } from '@/components/FAQPage'
import { UptimePage } from '@/components/UptimePage'
import { UptimeSettings } from '@/components/UptimeSettings'
import { NotificationSettings } from '@/components/NotificationSettings'
import { MonitoringSettings } from '@/components/MonitoringSettings'
import { Plus, RefreshCw, Zap, Loader2, LayoutDashboard, X, Server as ServerIcon, Wifi, Menu } from 'lucide-react'
import { countryName } from '@/lib/flags'
import { updateFavicon } from '@/config/themes'

type View = 'dashboard' | 'servers' | 'billing' | 'uptime' | 'activity' | 'settings' | 'faq' | 'monitoring'
type SettingsTab = 'general' | 'appearance' | 'hostings' | 'integrations' | 'uptime' | 'notifications' | 'monitoring'

const DEFAULT_ORDER = ['PANEL', 'NODE', 'SERVICES']

export default function App() {
  const [authenticated, setAuthenticated] = useState(() => !!getAuthToken())
  const [servers, setServers] = useState<Server[]>([])
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [syncingAll, setSyncingAll] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [purposeOrder, setPurposeOrder] = useState<string[]>(DEFAULT_ORDER)
  const [purposes, setPurposes] = useState<PurposeItem[]>(DEFAULT_PURPOSES)
  const navigate = useNavigate()
  const location = useLocation()

  const viewFromPath = location.pathname === '/' ? 'servers' : location.pathname.split('/')[1]
  const activeView = (['dashboard', 'servers', 'billing', 'uptime', 'activity', 'settings', 'faq', 'monitoring'].includes(viewFromPath) ? viewFromPath : 'servers') as View
  const rawTab = location.pathname.split('/')[2]
  const settingsTab = (rawTab === 'appearance' || rawTab === 'hostings' || rawTab === 'integrations' || rawTab === 'uptime' || rawTab === 'notifications' || rawTab === 'monitoring' ? rawTab : 'general') as SettingsTab
  const [deleteServerId, setDeleteServerId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [gradientBg, setGradientBg] = useState(() => {
    try {
      const saved = localStorage.getItem('skadik-theme-settings')
      if (saved) {
        const settings = JSON.parse(saved)
        return settings.gradientBg === true
      }
    } catch {}
    return true
  })
  const [appLogo, setAppLogo] = useState<string | undefined>(() => localStorage.getItem('skadik-brand-logo') || undefined)
  const [appName, setAppName] = useState<string | undefined>(() => localStorage.getItem('skadik-brand-name') || undefined)

  const [uptimeData, setUptimeData] = useState<UptimeMonitorWithStatus[]>([])

  useEffect(() => {
    brandingApi.get().then((data) => {
      if (data.app_logo) {
        setAppLogo(data.app_logo)
        localStorage.setItem('skadik-brand-logo', data.app_logo)
        updateFavicon(data.app_logo)
      }
      if (data.app_name) {
        setAppName(data.app_name)
        localStorage.setItem('skadik-brand-name', data.app_name)
        document.title = data.app_name
      }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    setAuthFailureCallback(() => setAuthenticated(false))
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail && typeof detail.gradientBg === 'boolean') {
        setGradientBg(detail.gradientBg)
      }
      if (detail && 'appLogo' in detail) {
        setAppLogo(detail.appLogo)
      }
      if (detail && 'appName' in detail) {
        setAppName(detail.appName)
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
    if (!authenticated) return
    loadServers()
    loadActivities()
    uptimeApi.getAll().then(setUptimeData).catch(() => {})
    settingsApi.getAll().then((s) => {
      if (s.purpose_order) {
        try { setPurposeOrder(JSON.parse(s.purpose_order)) } catch {}
      }
      if (s.purposes) {
        try { setPurposes(JSON.parse(s.purposes)) } catch {}
      }
    }).catch(() => {})
  }, [authenticated])

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

  const handleSyncAll = async () => {
    const toSync = servers.filter((s) => s.needs_sync)
    if (toSync.length === 0) {
      setToast({ message: 'Нет серверов, требующих синхронизации', type: 'success' })
      return
    }
    setSyncingAll(true)
    let successCount = 0
    let errorCount = 0
    for (const server of toSync) {
      try {
        const result = await serversApi.sync(server.id)
        const hasError = (result.termix && !result.termix.success) || (result.google_drive && !result.google_drive.success)
        if (hasError) {
          errorCount++
        } else {
          successCount++
          addActivity('Синхронизация: ' + server.purpose + ' [' + countryName(server.country) + '] ' + server.hosting)
        }
      } catch {
        errorCount++
      }
    }
    loadServers()
    if (errorCount === 0) {
      setToast({ message: `Синхронизировано ${successCount} серверов`, type: 'success' })
    } else {
      setToast({ message: `Синхронизировано ${successCount}, ошибок ${errorCount}`, type: 'error' })
    }
    setSyncingAll(false)
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

  if (!authenticated) {
    return <LoginPage onLogin={(token) => { setAuthToken(token); setAuthenticated(true) }} appLogo={appLogo} appName={appName} />
  }

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
        onViewChange={(v) => { navigate('/' + v); setMobileSidebarOpen(false) }}
        serverCount={servers.length}
        appLogo={appLogo}
        appName={appName}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />

      <div className="flex flex-1 flex-col min-w-0">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border/50 bg-background/80 px-4 md:px-6 backdrop-blur">
          <div className="flex items-center gap-2 md:gap-4 min-w-0">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="flex md:hidden h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-base md:text-lg font-semibold truncate">
              {activeView === 'dashboard' && 'Дашборд'}
              {activeView === 'servers' && 'Серверы'}
              {activeView === 'billing' && 'Биллинг'}
              {activeView === 'uptime' && 'Аптайм'}
              {activeView === 'activity' && 'Активность'}
              {activeView === 'settings' && 'Настройки'}
              {activeView === 'monitoring' && 'Мониторинг'}
              {activeView === 'faq' && 'FAQ'}
            </h1>
            <div className="hidden md:flex items-center gap-1 text-xs text-muted-foreground">
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
                  onClick={handleSyncAll}
                  disabled={syncingAll}
                  title="Синхронизировать все"
                  className={servers.some((s) => s.needs_sync) && !syncingAll ? 'text-amber-500' : ''}
                >
                  <RefreshCw className={'h-4 w-4' + (syncingAll ? ' animate-spin' : '')} />
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

        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {activeView === 'dashboard' && (
            <div key="dashboard" className="animate-view-enter">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              <div className="rounded-lg border border-border/50 bg-card p-5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Wifi className="h-4 w-4" />
                  <span>Мониторы</span>
                </div>
                <p className="mt-2 text-3xl font-bold">
                  {uptimeData.filter((m) => m.last_check?.is_up).length}/{uptimeData.length}
                </p>
              </div>
            </div>
            </div>
          )}

          {activeView === 'servers' && (
            <div key="servers" className="animate-view-enter">
              {activities.length > 0 && (
                <div className="mb-4 rounded-lg border border-border/50 bg-card/50 px-3 py-1.5 md:px-4 md:py-2">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground shrink-0">Последние действия:</span>
                    <span className="hidden md:contents">
                      {activities.slice(0, 3).map((item) => (
                        <span key={item.id} className="flex items-center gap-1.5">
                          <span className="h-1 w-1 rounded-full bg-primary/60 shrink-0" />
                          <span className="truncate max-w-[200px]">{item.text}</span>
                          <span className="opacity-50 shrink-0">{item.time}</span>
                        </span>
                      ))}
                    </span>
                    {activities.slice(0, 1).map((item) => (
                      <span key={item.id} className="flex md:hidden items-center gap-1.5 min-w-0">
                        <span className="h-1 w-1 rounded-full bg-primary/60 shrink-0" />
                        <span className="truncate">{item.text}</span>
                        <span className="opacity-50 shrink-0">{item.time}</span>
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
            </div>
          )}

          {activeView === 'billing' && (
            <div key="billing" className="animate-view-enter">
              <BillingPage servers={servers} onServersChange={loadServers} />
            </div>
          )}

          {activeView === 'uptime' && (
            <div key="uptime" className="animate-view-enter">
              <UptimePage />
            </div>
          )}

          {activeView === 'activity' && (
            <div key="activity" className="animate-view-enter">
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
            </div>
          )}

          {activeView === 'settings' && (
            <div key="settings" className="animate-view-enter">
            <div>
              <div className="mb-6 flex gap-1 overflow-x-auto rounded-lg border border-border/50 bg-card p-1 [&::-webkit-scrollbar]:hidden">
                {(['general', 'appearance', 'hostings', 'integrations', 'uptime', 'notifications', 'monitoring'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => navigate('/settings/' + tab)}
                    className={'shrink-0 rounded-md px-3 py-2 text-sm transition-colors ' + (settingsTab === tab
                      ? 'bg-accent text-foreground'
                      : 'text-muted-foreground hover:text-foreground')}
                  >
                    {tab === 'general' && 'Общее'}
                    {tab === 'appearance' && 'Внешний вид'}
                    {tab === 'hostings' && 'Хостинги'}
                    {tab === 'integrations' && 'Интеграции'}
                    {tab === 'uptime' && 'Аптайм'}
                    {tab === 'notifications' && 'Уведомления'}
                    {tab === 'monitoring' && 'Мониторинг'}
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
              {settingsTab === 'integrations' && <IntegrationsSettings onViewChange={(v) => navigate('/' + v)} />}
              {settingsTab === 'uptime' && <UptimeSettings />}
              {settingsTab === 'notifications' && <NotificationSettings />}
              {settingsTab === 'monitoring' && <MonitoringSettings />}
            </div>
            </div>
          )}

          {activeView === 'monitoring' && (
            <div key="monitoring" className="animate-view-enter">
              <MonitoringPage servers={servers} />
            </div>
          )}

          {activeView === 'faq' && (
            <div key="faq" className="animate-view-enter">
              <FAQPage />
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
