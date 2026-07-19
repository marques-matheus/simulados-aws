/**
 * Lógica anti-repeat de questões.
 * Mantém histórico dos últimos N simulados por certificação no localStorage
 * para evitar que as mesmas questões apareçam em simulados consecutivos.
 *
 * Migrado do `app.js` original.
 */

const COOLDOWN_EXAMS = 5

function getHistoryKey(cert: string): string {
  return 'exam_history_' + cert
}

/** Retorna o histórico de IDs de questões dos últimos simulados. */
export function getExamHistory(cert: string): string[][] {
  try {
    const raw = localStorage.getItem(getHistoryKey(cert))
    return raw ? (JSON.parse(raw) as string[][]) : []
  } catch {
    return []
  }
}

/** Salva os IDs do simulado atual no histórico. */
export function saveExamToHistory(cert: string, questionIds: string[]): void {
  const history = getExamHistory(cert)
  history.push(questionIds)
  while (history.length > COOLDOWN_EXAMS) history.shift()
  localStorage.setItem(getHistoryKey(cert), JSON.stringify(history))
}

/** Retorna o set de IDs usados recentemente (para evitar repetição). */
export function getRecentlyUsedIds(cert: string): Set<string> {
  const history = getExamHistory(cert)
  const ids = new Set<string>()
  history.forEach(examIds => examIds.forEach(id => ids.add(id)))
  return ids
}

// --- Performance History (histórico local de scores) ---

export interface PerformanceRecord {
  date: string
  score: number
  correct: number
  wrong: number
  skipped: number
  total: number
  timeTaken: number
}

export function getPerformanceHistory(cert: string): PerformanceRecord[] {
  try {
    const raw = localStorage.getItem('performance_history_' + cert)
    return raw ? (JSON.parse(raw) as PerformanceRecord[]) : []
  } catch {
    return []
  }
}

export function savePerformanceHistory(cert: string, record: PerformanceRecord): void {
  const history = getPerformanceHistory(cert)
  history.push(record)
  localStorage.setItem('performance_history_' + cert, JSON.stringify(history))
}
