/**
 * Utilidades para decodificação de JWT do Cognito.
 *
 * O frontend NÃO valida a assinatura do JWT — isso é responsabilidade
 * do API Gateway (JWT Authorizer). Aqui apenas decodificamos o payload
 * Base64 para extrair claims como `sub`, `email` e `cognito:groups`.
 */

export interface JwtClaims {
  sub: string
  email: string
  'cognito:groups'?: string | string[]
  exp?: number
  iat?: number
  [key: string]: unknown
}

/**
 * Decodifica o payload (segunda parte) de um JWT sem verificar assinatura.
 * Retorna null se o token for malformado.
 */
export function decodeJwt(token: string): JwtClaims | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    // Base64url → Base64 → decode
    const payload = parts[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/')

    const decoded = atob(payload)
    return JSON.parse(decoded) as JwtClaims
  } catch {
    return null
  }
}

/**
 * Extrai a lista de grupos do Cognito dos claims do JWT.
 */
export function getGroups(claims: JwtClaims): string[] {
  const groups = claims['cognito:groups']
  if (Array.isArray(groups)) return groups
  if (typeof groups === 'string') {
    return groups.split(',').map((g: string) => g.trim()).filter(Boolean)
  }
  return []
}

/**
 * Deriva o papel do usuário a partir dos grupos do Cognito.
 * - Se pertence ao grupo "Mentores" → Mentor
 * - Caso contrário → Aluno
 */
export function getPapel(claims: JwtClaims): 'Aluno' | 'Mentor' {
  return getGroups(claims).includes('Mentores') ? 'Mentor' : 'Aluno'
}

/**
 * Verifica se o token JWT está expirado.
 */
export function isTokenExpired(claims: JwtClaims): boolean {
  if (!claims.exp) return false
  return Date.now() >= claims.exp * 1000
}
