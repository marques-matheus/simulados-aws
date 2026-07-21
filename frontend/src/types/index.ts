// ─── Questões e Simulado ─────────────────────────────────────────────────────

export interface Questao {
  PK: string
  SK: string
  pergunta: string
  opcoes: string[]
  num_respostas_corretas: number
  temas: string[]
  // Preenchido pelo backend após POST /corrigir
  correct?: number | number[]
  explicacao?: string
}

export interface DetalheQuestao {
  id: string
  status: 'correta' | 'errada' | 'pulada'
  resposta_usuario: number[] | null
  resposta_correta: number[]
  explicacao: string
}

export interface Resultado {
  score: number
  total: number
  corretas: number
  erradas: number
  puladas: number
  detalhes: DetalheQuestao[]
}

export interface ExamConfig {
  cert: string
  qty: number
  trainingMode: boolean
  theme: string
}

// ─── Histórico ───────────────────────────────────────────────────────────────

export interface RegistroHistorico {
  id: string           // SK do DynamoDB
  certificacao: string
  score: number
  corretas: number
  erradas: number
  puladas: number
  total: number
  tempo_segundos: number | null
  data_iso: string
  dominios: Record<string, number>
}

// ─── Dashboard de Mentores ────────────────────────────────────────────────────

export interface CertResumida {
  cert: string
  ultimo_score: number
  tendencia: 'melhorando' | 'piorando' | 'estavel'
  total_simulados: number
}

export interface AlunoResumido {
  aluno_id: string
  email: string
  nome?: string
  score_medio: number
  total_simulados: number
  certificacoes: CertResumida[]
}

export interface RankingItem {
  aluno_id: string
  email: string
  nome?: string
  score_medio: number
}

export interface DominioFraco {
  dominio: string
  media_acerto: number
}

export interface DashboardTurma {
  turma_id: string
  nome_turma: string
  codigo_convite?: string
  total_membros: number
  alunos: AlunoResumido[]
  ranking: RankingItem[]
  dominios_fracos: DominioFraco[]
}

// ─── Turmas ───────────────────────────────────────────────────────────────────

export interface Turma {
  turma_id: string
  nome: string        // ou nome_turma dependendo do endpoint
  nome_turma?: string
  codigo_convite?: string
  data_criacao?: string
  mentor_id?: string
  mentor_email?: string
}

export interface MembroTurma {
  aluno_id: string
  email: string
  data_entrada: string
}

export interface TurmaDetalhe extends Turma {
  alunos: MembroTurma[]
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export type Papel = 'Aluno' | 'Mentor'

export interface AuthState {
  token: string | null
  sub: string | null
  papel: Papel | null
  email: string | null
}
