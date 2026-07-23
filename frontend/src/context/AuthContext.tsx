/**
 * AuthContext — gerencia estado de autenticação via Cognito.
 *
 * - Lê o token de `sessionStorage` na montagem
 * - Decodifica claims do JWT para extrair sub, email, papel
 * - Expõe `login(token)` e `logout()` para toda a árvore de componentes
 */
import { createContext, useContext, useReducer, type ReactNode } from 'react'
import { decodeJwt, getPapel, isTokenExpired, type JwtClaims } from '../utils/jwt'
import type { AuthState, Papel } from '../types'

const SESSION_KEY = 'aws_mentoria_token'

// ─── Action Types ────────────────────────────────────────────────────────────

type AuthAction =
  | { type: 'LOGIN'; payload: { token: string; claims: JwtClaims } }
  | { type: 'LOGOUT' }
  | { type: 'UPDATE_NOME'; payload: string }

// ─── Context Value ───────────────────────────────────────────────────────────

interface AuthContextValue extends AuthState {
  login: (token: string) => void
  logout: () => void
  updateNome: (nome: string) => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

// ─── Reducer ─────────────────────────────────────────────────────────────────

const stored = typeof window !== 'undefined' ? sessionStorage.getItem(SESSION_KEY) : null
let initialToken = null
let initialSub = null
let initialPapel = null
let initialEmail = null
let initialNome = null

if (stored) {
  const claims = decodeJwt(stored)
  if (claims && !isTokenExpired(claims)) {
    initialToken = stored
    initialSub = claims.sub ?? null
    initialEmail = claims.email ?? null
    const savedName = typeof window !== 'undefined' ? localStorage.getItem('aws_mentoria_nome') : null
    initialNome = savedName || (claims.name as string) || (claims.given_name as string) || (claims.nickname as string) || (claims.preferred_username as string) || null
    initialPapel = getPapel(claims) as Papel
  } else {
    if (typeof window !== 'undefined') sessionStorage.removeItem(SESSION_KEY)
  }
}

const initialState: AuthState = {
  token: initialToken,
  sub: initialSub,
  papel: initialPapel,
  email: initialEmail,
  nome: initialNome,
}

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'LOGIN': {
      const { token, claims } = action.payload
      return {
        token,
        sub: claims.sub ?? null,
        email: claims.email ?? null,
        nome: (typeof window !== 'undefined' ? localStorage.getItem('aws_mentoria_nome') : null) || (claims.name as string) || (claims.given_name as string) || (claims.nickname as string) || (claims.preferred_username as string) || null,
        papel: getPapel(claims) as Papel,
      }
    }
    case 'LOGOUT':
      return {
        token: null,
        sub: null,
        papel: null,
        email: null,
        nome: null,
      }
    case 'UPDATE_NOME':
      return { ...state, nome: action.payload }
    default:
      return state
  }
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState)

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
    if (typeof window !== 'undefined') localStorage.removeItem('aws_mentoria_nome')
    dispatch({ type: 'LOGOUT' })
  }

  function updateNome(nome: string) {
    if (typeof window !== 'undefined') localStorage.setItem('aws_mentoria_nome', nome)
    dispatch({ type: 'UPDATE_NOME', payload: nome })
  }

  const value: AuthContextValue = {
    ...state,
    login,
    logout,
    updateNome,
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
