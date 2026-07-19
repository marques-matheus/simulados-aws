/**
 * AuthContext — gerencia estado de autenticação via Cognito.
 *
 * - Lê o token de `sessionStorage` na montagem
 * - Decodifica claims do JWT para extrair sub, email, papel
 * - Expõe `login(token)` e `logout()` para toda a árvore de componentes
 */
import { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react'
import { decodeJwt, getPapel, isTokenExpired, type JwtClaims } from '../utils/jwt'
import type { AuthState, Papel } from '../types'

const SESSION_KEY = 'aws_mentoria_token'

// ─── Action Types ────────────────────────────────────────────────────────────

type AuthAction =
  | { type: 'LOGIN'; payload: { token: string; claims: JwtClaims } }
  | { type: 'LOGOUT' }

// ─── Context Value ───────────────────────────────────────────────────────────

interface AuthContextValue extends AuthState {
  login: (token: string) => void
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

// ─── Reducer ─────────────────────────────────────────────────────────────────

const initialState: AuthState = {
  token: null,
  sub: null,
  papel: null,
  email: null,
}

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'LOGIN': {
      const { token, claims } = action.payload
      return {
        token,
        sub: claims.sub ?? null,
        email: claims.email ?? null,
        papel: getPapel(claims) as Papel,
      }
    }
    case 'LOGOUT':
      return { ...initialState }
    default:
      return state
  }
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState)

  // Na montagem, tenta restaurar o token do sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_KEY)
    if (stored) {
      const claims = decodeJwt(stored)
      if (claims && !isTokenExpired(claims)) {
        dispatch({ type: 'LOGIN', payload: { token: stored, claims } })
      } else {
        // Token inválido ou expirado — limpa
        sessionStorage.removeItem(SESSION_KEY)
      }
    }
  }, [])

  function login(token: string) {
    const claims = decodeJwt(token)
    if (!claims) {
      console.error('Token JWT inválido — não foi possível decodificar.')
      return
    }
    sessionStorage.setItem(SESSION_KEY, token)
    dispatch({ type: 'LOGIN', payload: { token, claims } })
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY)
    dispatch({ type: 'LOGOUT' })
  }

  const value: AuthContextValue = {
    ...state,
    login,
    logout,
    isAuthenticated: state.token !== null,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  }
  return ctx
}
