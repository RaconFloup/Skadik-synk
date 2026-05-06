import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  status: 'active' | 'inactive'
  size?: 'sm' | 'md'
}

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
        status === 'active'
          ? 'bg-emerald-500/10 text-emerald-400'
          : 'bg-muted/50 text-muted-foreground',
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          status === 'active' ? 'bg-emerald-400' : 'bg-muted-foreground',
        )}
      />
      {status === 'active' ? 'Активен' : 'Неактивен'}
    </span>
  )
}
