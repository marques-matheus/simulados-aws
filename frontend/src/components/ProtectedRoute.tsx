/**
 * ProtectedRoute — guarda de rota por papel.
 *
 * - Sem token: redireciona para o Cognito Hosted UI
 * - Token presente mas papel errado: redireciona para /
 */
import { type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { Papel } from '../types'

const COGNITO_DOMAIN = import.meta.env.VITE_COGNITO_DOMAIN
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID
const CLIENT_ID_MENTOR = import.meta.env.VITE_COGNITO_CLIENT_ID_MENTOR
const REDIRECT_URI = import.meta.env.VITE_REDIRECT_URI

function buildCognitoLoginUrl(papel: 'Aluno' | 'Mentor' = 'Aluno'): string {
  const clientId = papel === 'Mentor' && CLIENT_ID_MENTOR ? CLIENT_ID_MENTOR : CLIENT_ID
  return `${COGNITO_DOMAIN}/login?client_id=${clientId}&response_type=token&scope=email+openid+profile&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`
}

interface ProtectedRouteProps {
  requiredPapel?: Papel
  children: ReactNode
}

export default function ProtectedRoute({ requiredPapel, children }: ProtectedRouteProps) {
  const { token, papel } = useAuth()

  // Sem token → redireciona para Cognito Hosted UI
  if (!token) {
    window.location.href = buildCognitoLoginUrl()
    return null
  }

  // Token presente mas papel errado → volta para home
  if (requiredPapel && papel !== requiredPapel) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

/** Exporta a URL de login do Cognito para uso em outros componentes */
export { buildCognitoLoginUrl }
