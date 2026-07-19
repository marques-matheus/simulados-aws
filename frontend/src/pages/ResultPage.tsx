import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, Navigate } from 'react-router-dom'
import { CERT_META } from '../utils/certMeta'
import type { ExamConfig, Resultado, Questao } from '../types'

function formatTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0')
}

export default function ResultPage() {
  const location = useLocation()
  const navigate = useNavigate()
  
  const state = location.state as {
    config: ExamConfig
    resultado: Resultado
    examQuestions: Questao[]
    answers: Record<number, number | number[]>
    flagged: Set<number>
    timeTaken: number
  }

  const [dashOffset, setDashOffset] = useState(565)
  const fgRef = useRef<SVGCircleElement>(null)

  useEffect(() => {
    if (state?.resultado) {
      const pct = state.resultado.score
      const circumference = 565 // 2 * Math.PI * 90
      
      // Animate circle
      const timer = setTimeout(() => {
        setDashOffset(circumference - (circumference * pct / 100))
      }, 100)
      
      return () => clearTimeout(timer)
    }
  }, [state])

  if (!state) {
    return <Navigate to="/" replace />
  }

  const { config, resultado, timeTaken, examQuestions } = state
  const passingScore = 70
  const isPassing = resultado.score >= passingScore
  
  const meta = CERT_META[config.cert]

  // Calculate Domain Stats
  const domainStats: Record<string, { total: number, correct: number }> = {}
  
  if (resultado.detalhes) {
    resultado.detalhes.forEach((detalhe, idx) => {
      const q = examQuestions[idx]
      const isCorrect = detalhe.status === 'correta'
      if (q && q.temas && Array.isArray(q.temas)) {
        q.temas.forEach(domain => {
          if (!domainStats[domain]) domainStats[domain] = { total: 0, correct: 0 }
          domainStats[domain].total++
          if (isCorrect) domainStats[domain].correct++
        })
      }
    })
  }

  const domainKeys = Object.keys(domainStats).sort()

  return (
    <div className="page-container" style={{ maxWidth: '600px' }}>
      <div className="result-container" style={{ paddingTop: 0 }}>
        <header className="result-header">
          <div className="result-icon">
            <i className={isPassing ? "ph ph-trophy" : "ph ph-books"} style={{ color: isPassing ? '#22c55e' : '#ef4444' }} />
          </div>
          <h1 className="result-title">{isPassing ? 'Aprovado!' : 'Continue Estudando'}</h1>
          <p className="result-subtitle">
            {isPassing 
              ? `Parabéns! Você atingiu ${resultado.score}% no ${config.cert} (mínimo ${passingScore}%).`
              : `Você atingiu ${resultado.score}% no ${config.cert}. É necessário ${passingScore}% para aprovação.`}
          </p>
        </header>

        <div className="score-circle-wrap">
          <svg className="score-circle" width="180" height="180" viewBox="0 0 200 200">
            <defs>
              <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={meta.color} />
                <stop offset="100%" stopColor={isPassing ? '#22c55e' : '#ef4444'} />
              </linearGradient>
            </defs>
            <circle className="score-bg" cx="100" cy="100" r="90" />
            <circle
              ref={fgRef}
              className="score-fg"
              cx="100" cy="100" r="90"
              style={{ strokeDashoffset: dashOffset }}
            />
          </svg>
          <div className="score-value">{resultado.score}%</div>
        </div>

        <div className="result-stats">
          <div className="stat">
            <span className="stat-num" style={{ color: '#22c55e' }}>{resultado.corretas}</span>
            <span className="stat-label">Corretas</span>
          </div>
          <div className="stat">
            <span className="stat-num" style={{ color: '#ef4444' }}>{resultado.erradas}</span>
            <span className="stat-label">Erradas</span>
          </div>
          <div className="stat">
            <span className="stat-num">{resultado.puladas}</span>
            <span className="stat-label">Puladas</span>
          </div>
          <div className="stat">
            <span className="stat-num" style={{ fontSize: '1.2rem' }}>{formatTime(timeTaken)}</span>
            <span className="stat-label">Tempo</span>
          </div>
        </div>

        <div className="result-actions">
          <button className="btn-primary" onClick={() => navigate('/review', { state })}>
            <i className="ph ph-magnifying-glass" /> Revisar Questões
          </button>
          <button className="btn-secondary" onClick={() => navigate('/progress')}>
            <i className="ph ph-chart-line-up" /> Ver Evolução
          </button>
        </div>

        {domainKeys.length > 0 && (
          <div className="domains-analysis-container">
            <h3><i className="ph ph-chart-polar" /> Desempenho por Domínio</h3>
            <div className="domains-analysis-list">
              {domainKeys.map(domain => {
                const stats = domainStats[domain]
                const domainPct = Math.round((stats.correct / stats.total) * 100)
                const colorClass = domainPct >= 75 ? 'domain-pass' : domainPct >= 50 ? 'domain-warning' : 'domain-fail'
                
                return (
                  <div key={domain} className="domain-analysis-row">
                    <div className="domain-info-row">
                      <span className="domain-name" title={domain}>{domain}</span>
                      <span className={`domain-score-text ${colorClass}`}>
                        {stats.correct}/{stats.total} ({domainPct}%)
                      </span>
                    </div>
                    <div className="domain-bar-container">
                      <div
                        className={`domain-bar ${colorClass}`}
                        style={{ width: `${domainPct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
