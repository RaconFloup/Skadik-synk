import { useState } from 'react'
import { Server, ChevronLeft, ChevronRight, Globe, Settings, Activity, LayoutDashboard, CreditCard } from 'lucide-react'

interface SidebarProps {
  activeView: 'dashboard' | 'servers' | 'activity' | 'settings' | 'billing'
  onViewChange: (view: 'dashboard' | 'servers' | 'activity' | 'settings' | 'billing') => void
  serverCount: number
}

export function Sidebar({ activeView, onViewChange, serverCount }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)

  const navItems = [
    { id: 'dashboard' as const, icon: LayoutDashboard, label: 'Дашборд' },
    { id: 'servers' as const, icon: Server, label: 'Серверы', count: serverCount },
    { id: 'billing' as const, icon: CreditCard, label: 'Биллинг' },
    { id: 'activity' as const, icon: Activity, label: 'Активность' },
    { id: 'settings' as const, icon: Settings, label: 'Настройки' },
  ]

  return (
    <div
      className={`sticky top-0 h-screen shrink-0 border-r border-border/50 bg-card transition-all duration-300 flex flex-col ${
        collapsed ? 'w-16' : 'w-56'
      }`}
    >
      <div className="flex h-14 items-center justify-between border-b border-border/50 px-4">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <span className="font-semibold text-foreground">Skadik</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      <nav className="flex flex-col gap-1 p-2 flex-1">
        {navItems.map(({ id, icon: Icon, label, count }) => (
          <button
            key={id}
            onClick={() => onViewChange(id)}
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
    </div>
  )
}
