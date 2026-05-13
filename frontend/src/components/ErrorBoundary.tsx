import { Component, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
          <AlertTriangle className="h-10 w-10 text-amber-400" />
          <p className="text-sm">Ошибка при загрузке данных</p>
          <p className="text-xs text-muted-foreground/60 max-w-md text-center">
            {this.state.error?.message || 'Неизвестная ошибка'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: undefined })}
            className="text-xs text-primary hover:underline"
          >
            Попробовать снова
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
