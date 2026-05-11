import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Server, ChevronLeft, ChevronRight, Globe, Settings, Activity, LayoutDashboard, CreditCard, HelpCircle, LogOut, Wifi, X } from 'lucide-react'
import { logout } from '@/api/client'

interface SidebarProps {
  activeView: 'dashboard' | 'servers' | 'activity' | 'settings' | 'billing' | 'faq' | 'uptime'
  onViewChange: (view: 'dashboard' | 'servers' | 'activity' | 'settings' | 'billing' | 'faq' | 'uptime') => void
  serverCount: number
  appLogo?: string
  appName?: string
  mobileOpen?: boolean
  onMobileClose?: () => void
}

export function Sidebar({ activeView, onViewChange, serverCount, appLogo, appName, mobileOpen, onMobileClose }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()

  const navItems = [
    { id: 'dashboard' as const, icon: LayoutDashboard, label: 'Дашборд' },
    { id: 'servers' as const, icon: Server, label: 'Серверы', count: serverCount },
    { id: 'billing' as const, icon: CreditCard, label: 'Биллинг' },
    { id: 'uptime' as const, icon: Wifi, label: 'Аптайм' },
    { id: 'activity' as const, icon: Activity, label: 'Активность' },
    { id: 'settings' as const, icon: Settings, label: 'Настройки' },
    { id: 'faq' as const, icon: HelpCircle, label: 'FAQ' },
  ]

  const handleNav = (id: string) => {
    onViewChange(id as any)
    onMobileClose?.()
  }

  const sidebarContent = (
    <>
      <div className="flex h-14 items-center justify-between border-b border-border/50 px-4">
        {!collapsed && (
          <div className="flex items-center gap-2 min-w-0">
            {appLogo ? (
              <img src={appLogo} alt="" className="h-6 w-6 shrink-0 rounded object-contain" />
            ) : (
              <Globe className="h-5 w-5 shrink-0 text-primary" />
            )}
            <span className="font-semibold text-foreground truncate">{appName || 'Skadik Synk'}</span>
          </div>
        )}
        <div className="flex items-center gap-1">
          {onMobileClose && (
            <button
              onClick={onMobileClose}
              className="flex md:hidden h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden md:flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      <nav className="flex flex-col gap-1 p-2 flex-1">
        {navItems.map(({ id, icon: Icon, label, count }) => (
          <button
            key={id}
            onClick={() => handleNav(id)}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
              activeView === id
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && (
              <div className="flex flex-1 items-center justify-between">
                <span>{label}</span>
                {count !== undefined && (
                  <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs text-primary">
                    {count}
                  </span>
                )}
              </div>
            )}
          </button>
        ))}
      </nav>

      <div className="border-t border-border/50 p-2">
        <button
          onClick={() => { logout(); navigate('/'); onMobileClose?.() }}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Выйти</span>}
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Mobile drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-56 bg-card border-r border-border/50 transform transition-transform duration-300 md:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </div>

      {/* Desktop sidebar */}
      <div
        className={`hidden md:flex sticky top-0 h-screen shrink-0 border-r border-border/50 bg-card transition-all duration-300 flex-col ${
          collapsed ? 'w-16' : 'w-56'
        }`}
      >
        {sidebarContent}
      </div>
    </>
  )
}
