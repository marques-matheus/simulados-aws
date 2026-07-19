/**
 * useApi — hook de fetch com Bearer token automático.
 *
 * Centraliza todas as chamadas à API, injetando o token JWT
 * do AuthContext em cada requisição.
 */
import { useAuth } from '../context/AuthContext'

const API_BASE = import.meta.env.VITE_API_URL

export function useApi() {
  const { token } = useAuth()

  async function apiFetch<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> ?? {}),
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    })

    if (res.status === 401 || res.status === 403) {
      // Token expirado ou inválido
      sessionStorage.removeItem('aws_mentoria_token')
      throw new Error(`Sessão expirada (${res.status}). Faça login novamente.`)
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Erro na API (${res.status}): ${text}`)
    }

    return res.json() as Promise<T>
  }

  return { apiFetch }
}
