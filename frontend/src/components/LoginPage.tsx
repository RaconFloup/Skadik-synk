import { useState } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Loader2, ServerIcon } from 'lucide-react'

interface LoginPageProps {
  onLogin: (token: string) => void
  appLogo?: string
  appName?: string
}

export function LoginPage({ onLogin, appLogo, appName }: LoginPageProps) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (res.ok) {
        const data = await res.json()
        onLogin(data.token)
      } else {
        setError('Неверный пароль')
      }
    } catch {
      setError('Ошибка подключения')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="gradient-bg">
        <div className="gradient-orb" />
        <div className="gradient-orb" />
        <div className="gradient-orb" />
      </div>
      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-sm rounded-xl border border-border/50 bg-card p-8 shadow-lg"
      >
        <div className="mb-6 flex flex-col items-center gap-3">
          <div className="rounded-full bg-accent/50 p-3">
            {appLogo ? (
              <img src={appLogo} alt="" className="h-8 w-8 rounded object-contain" />
            ) : (
              <ServerIcon className="h-8 w-8 text-primary" />
            )}
          </div>
          <h1 className="text-xl font-semibold">{appName || 'Skadik Synk'}</h1>
          <p className="text-sm text-muted-foreground">Введите пароль для входа</p>
        </div>

        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Пароль"
          autoFocus
        />

        {error && (
          <p className="mt-2 text-sm text-destructive">{error}</p>
        )}

        <Button type="submit" className="mt-4 w-full" disabled={loading || !password}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Вход...
            </>
          ) : (
            'Войти'
          )}
        </Button>
      </form>
    </div>
  )
}
