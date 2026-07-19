/**
 * LoadingSpinner — indicador de carregamento reutilizável.
 */

interface LoadingSpinnerProps {
  /** Mensagem exibida abaixo do spinner */
  message?: string
  /** Se true, exibe como overlay fullscreen */
  overlay?: boolean
}

export default function LoadingSpinner({ message, overlay = false }: LoadingSpinnerProps) {
  if (overlay) {
    return (
      <div className="loading-overlay" id="loading-overlay">
        <div className="loading-content">
          <div className="spinner" />
          {message && <p className="loading-message">{message}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="loading-inline">
      <div className="spinner" />
      {message && <p className="loading-message">{message}</p>}
    </div>
  )
}
