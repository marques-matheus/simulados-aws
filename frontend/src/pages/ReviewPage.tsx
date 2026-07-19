import { useState } from 'react'
import { useLocation, useNavigate, Navigate } from 'react-router-dom'
import { formatText } from '../utils/formatText'
import type { ExamConfig, Resultado, Questao } from '../types'

type FilterType = 'all' | 'correct' | 'wrong' | 'skipped' | 'flagged'

export default function ReviewPage() {
  const location = useLocation()
  const navigate = useNavigate()
  
  const [filter, setFilter] = useState<FilterType>('all')

  const state = location.state as {
    config: ExamConfig
    resultado: Resultado
    examQuestions: Questao[]
    answers: Record<number, number | number[]>
    flagged: Set<number>
  }

  if (!state) {
    return <Navigate to="/" replace />
  }

  const { examQuestions, answers, flagged } = state

  // Helper functions
  function isAnswerEmpty(userAns: any) {
    if (userAns === undefined) return true
    if (Array.isArray(userAns) && userAns.length === 0) return true
    return false
  }

  function isAnswerCorrect(q: Questao, userAns: any) {
    if (userAns === undefined) return false
    if (q.correct === undefined || q.correct === null) return false
    
    if (Array.isArray(q.correct)) {
      if (!Array.isArray(userAns)) return false
      if (userAns.length !== q.correct.length) return false
      const sorted1 = [...userAns].sort((a,b)=>a-b)
      const sorted2 = [...q.correct].sort((a,b)=>a-b)
      return sorted1.every((v, i) => v === sorted2[i])
    }
    
    if (Array.isArray(userAns)) return userAns.length === 1 && userAns[0] === q.correct
    return userAns === q.correct
  }

  const filteredQuestions = examQuestions.map((q, i) => ({ q, i })).filter(({ q, i }) => {
    const userAns = answers[i]
    const correct = isAnswerCorrect(q, userAns)
    const skipped = isAnswerEmpty(userAns)

    if (filter === 'correct' && !correct) return false
    if (filter === 'wrong' && (correct || skipped)) return false
    if (filter === 'skipped' && !skipped) return false
    if (filter === 'flagged' && !flagged.has(i)) return false
    
    return true
  })

  return (
    <div style={{ paddingBottom: '4rem' }}>
      <header className="review-header">
        <h2>Revisão — {state.config.cert}</h2>
        <button className="btn-outline btn-sm" onClick={() => navigate(-1)}>
          Voltar ao Resultado
        </button>
      </header>
      
      <div className="review-filters">
        <button className={`btn-filter ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>Todas</button>
        <button className={`btn-filter ${filter === 'correct' ? 'active' : ''}`} onClick={() => setFilter('correct')}>Corretas</button>
        <button className={`btn-filter ${filter === 'wrong' ? 'active' : ''}`} onClick={() => setFilter('wrong')}>Erradas</button>
        <button className={`btn-filter ${filter === 'skipped' ? 'active' : ''}`} onClick={() => setFilter('skipped')}>Puladas</button>
        <button className={`btn-filter ${filter === 'flagged' ? 'active' : ''}`} onClick={() => setFilter('flagged')}>
          <i className="ph-fill ph-flag" style={{ color: 'var(--orange)' }}></i> Sinalizadas
        </button>
      </div>

      <div className="review-list">
        {filteredQuestions.length === 0 ? (
          <div className="empty-state">
            <i className="ph ph-check-circle" />
            <p>Nenhuma questão encontrada para este filtro.</p>
          </div>
        ) : (
          filteredQuestions.map(({ q, i }) => {
            const userAns = answers[i]
            const correct = isAnswerCorrect(q, userAns)
            const skipped = isAnswerEmpty(userAns)

            const cls = skipped ? 'ri-skipped' : correct ? 'ri-correct' : 'ri-wrong'
            const statusIcon = skipped ? <><i className="ph ph-square"/> Pulada</> : correct ? <><i className="ph ph-check-circle"/> Correta</> : <><i className="ph ph-x-circle"/> Errada</>
            
            const isMulti = Array.isArray(q.correct)
            const correctSet = isMulti ? q.correct as number[] : (q.correct !== undefined ? [q.correct as number] : [])
            const userSet = Array.isArray(userAns) ? userAns : (userAns !== undefined ? [userAns] : [])

            return (
              <div key={i} className={`review-item ${cls}`}>
                <div className="ri-header">
                  <span className="ri-num">Questão {i + 1}</span>
                  <span style={{ fontSize: '.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {flagged.has(i) && <i className="ph-fill ph-flag" style={{ color: 'var(--orange)', marginRight: '4px' }}></i>}
                    {statusIcon}
                  </span>
                </div>
                
                <p className="ri-question" dangerouslySetInnerHTML={{ __html: formatText(q.pergunta) }} />
                
                <div className="ri-options">
                  {q.opcoes.map((opt, oi) => {
                    const letters = ['A','B','C','D','E','F']
                    let optCls = ''
                    if (correctSet.includes(oi)) optCls = 'is-correct'
                    else if (userSet.includes(oi) && !correct) optCls = 'is-wrong'
                    
                    return (
                      <div key={oi} className={`ri-opt ${optCls}`}>
                        <strong>{letters[oi]}.</strong>
                        <span dangerouslySetInnerHTML={{ __html: formatText(opt) }} />
                      </div>
                    )
                  })}
                </div>
                
                {q.explicacao && (
                  <div className="ri-explanation">
                    <strong>Explicação:</strong><br /><br />
                    <span dangerouslySetInnerHTML={{ __html: formatText(q.explicacao) }} />
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
