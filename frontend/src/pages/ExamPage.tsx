import { useEffect, useState } from 'react'
import { useLocation, useNavigate, Navigate } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { useTimer } from '../hooks/useTimer'
import { CERT_META } from '../utils/certMeta'
import { formatText } from '../utils/formatText'
import { getRecentlyUsedIds, saveExamToHistory, savePerformanceHistory } from '../utils/antiRepeat'
import LoadingSpinner from '../components/LoadingSpinner'
import Modal from '../components/Modal'
import type { Questao, ExamConfig, Resultado } from '../types'

// Shuffle utility
function shuffle<T>(arr: T[]): T[] {
  const newArr = [...arr]
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[newArr[i], newArr[j]] = [newArr[j], newArr[i]]
  }
  return newArr
}

export default function ExamPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { apiFetch } = useApi()
  const timer = useTimer()

  const config = location.state?.config as ExamConfig
  const pool = location.state?.pool as Questao[]

  const [examQuestions, setExamQuestions] = useState<Questao[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  
  // answers stores the indices of the selected options. For multiple choice, it's an array of indices.
  const [answers, setAnswers] = useState<Record<number, number | number[]>>({})
  const [flagged, setFlagged] = useState<Set<number>>(new Set())
  const [fontSize, setFontSize] = useState(15)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [fetchingCorrection, setFetchingCorrection] = useState(false)
  
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean
    type: 'danger' | 'warning' | 'info'
    title: string
    message: string
    onConfirm: () => void
    onCancel?: () => void
    confirmText?: string
  }>({ isOpen: false, type: 'info', title: '', message: '', onConfirm: () => {} })

  function closeModal() {
    setModalConfig(prev => ({ ...prev, isOpen: false }))
  }

  // Initialize exam
  useEffect(() => {
    if (!config || !pool) return

    const needed = Math.min(config.qty, pool.length)
    if (needed === 0) return

    const recentIds = getRecentlyUsedIds(config.cert)
    const fresh = shuffle(pool.filter(q => !recentIds.has(q.SK)))
    const used = shuffle(pool.filter(q => recentIds.has(q.SK)))

    let selected = fresh.slice(0, needed)
    if (selected.length < needed) {
      selected = selected.concat(used.slice(0, needed - selected.length))
    }
    
    selected = shuffle(selected)

    setExamQuestions(selected)
    saveExamToHistory(config.cert, selected.map(q => q.SK))
    timer.start()

    // cleanup on unmount
    return () => timer.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // run only once on mount

  if (!config || !pool) {
    return <Navigate to="/" replace />
  }

  if (examQuestions.length === 0) {
    return <LoadingSpinner overlay message="Preparando simulado..." />
  }

  const q = examQuestions[currentIdx]
  const numCorrect = q.num_respostas_corretas || 1
  const isMulti = numCorrect > 1

  // Checks if the user has completed answering this question (for training mode)
  const isAnswerComplete = () => {
    const userAns = answers[currentIdx]
    if (userAns === undefined) return false
    // Training mode only shows solution if q.correct is filled by backend
    if (q.correct === undefined) return false
    if (isMulti) {
      if (!Array.isArray(userAns)) return false
      return userAns.length === numCorrect
    }
    return true
  }

  const isComplete = config.trainingMode && isAnswerComplete()
  const correctSet = Array.isArray(q.correct)
    ? q.correct
    : q.correct !== undefined
    ? [q.correct]
    : []

  async function handleOptionClick(idx: number) {
    if (isComplete || fetchingCorrection) return // block clicks if already answered or fetching

    let finalAns: number | number[]
    if (isMulti) {
      let currentArr = answers[currentIdx]
        ? [...(answers[currentIdx] as number[])]
        : []
      
      if (currentArr.includes(idx)) {
        currentArr = currentArr.filter(x => x !== idx)
      } else {
        if (currentArr.length < numCorrect) {
          currentArr.push(idx)
        }
      }
      finalAns = currentArr
    } else {
      finalAns = idx
    }

    setAnswers(prev => ({ ...prev, [currentIdx]: finalAns }))

    // Training mode auto-fetch correction
    if (config.trainingMode) {
      const isAnsComplete = isMulti ? (finalAns as number[]).length === numCorrect : true
      if (isAnsComplete && q.correct === undefined) {
        setFetchingCorrection(true)
        try {
          const res = await apiFetch<Resultado>('/corrigir', {
            method: 'POST',
            body: JSON.stringify({
              prova: config.cert,
              questoes_ids: [q.SK],
              respostas: { "0": finalAns }
            })
          })
          if (res.detalhes && res.detalhes.length > 0) {
            const detalhe = res.detalhes[0]
            const updatedQuestions = [...examQuestions]
            updatedQuestions[currentIdx] = {
              ...updatedQuestions[currentIdx],
              correct: detalhe.resposta_correta.length === 1 ? detalhe.resposta_correta[0] : detalhe.resposta_correta,
              explicacao: detalhe.explicacao
            }
            setExamQuestions(updatedQuestions)
          } else {
            console.error("Modo treino: Backend não retornou detalhes.")
          }
        } catch (err: any) {
          console.error("Erro ao obter correção no Modo Treino:", err)
        } finally {
          setFetchingCorrection(false)
        }
      }
    }
  }

  function handleFlag() {
    setFlagged(prev => {
      const newSet = new Set(prev)
      if (newSet.has(currentIdx)) newSet.delete(currentIdx)
      else newSet.add(currentIdx)
      return newSet
    })
  }

  function isAnswerEmpty(userAns: any) {
    if (userAns === undefined) return true
    if (Array.isArray(userAns) && userAns.length === 0) return true
    return false
  }

  function handleFinishExam() {
    const unanswered = examQuestions.length - Object.keys(answers).filter(k => !isAnswerEmpty(answers[parseInt(k)])).length
    if (unanswered > 0) {
      setModalConfig({
        isOpen: true,
        type: 'warning',
        title: 'Atenção',
        message: `Você tem ${unanswered} questão(ões) sem resposta. Deseja finalizar mesmo assim?`,
        confirmText: 'Finalizar',
        onConfirm: () => {
          closeModal()
          submitExam()
        },
        onCancel: closeModal
      })
    } else {
      submitExam()
    }
  }

  async function submitExam() {
    setIsSubmitting(true)
    timer.pause()

    const questoes_ids = examQuestions.map(q => q.SK)
    const respostas: Record<string, any> = {}
    
    Object.keys(answers).forEach(idx => {
      const idxNum = parseInt(idx)
      const ans = answers[idxNum]
      if (!isAnswerEmpty(ans)) {
        respostas[idxNum] = ans
      }
    })

    try {
      const resultado = await apiFetch<Resultado>('/corrigir', {
        method: 'POST',
        body: JSON.stringify({
          prova: config.cert,
          questoes_ids,
          respostas
        })
      })

      // Popula examQuestions com as respostas corretas
      const updatedQuestions = [...examQuestions]
      if (resultado.detalhes) {
        resultado.detalhes.forEach((detalhe, idx) => {
          if (updatedQuestions[idx]) {
            const correta = detalhe.resposta_correta
            updatedQuestions[idx].correct = correta.length === 1 ? correta[0] : correta
          }
        })
      }

      // Salva no histórico de performance
      const perfObj = {
        date: new Date().toISOString(),
        score: resultado.score,
        correct: resultado.corretas,
        wrong: resultado.erradas,
        skipped: resultado.puladas,
        total: resultado.total,
        timeTaken: timer.elapsed
      }
      savePerformanceHistory(config.cert, perfObj)

      // Navega para Result passando o resultado, questoes atualizadas e as respostas do usuário
      navigate('/result', {
        state: {
          config,
          resultado,
          examQuestions: updatedQuestions,
          answers,
          flagged,
          timeTaken: timer.elapsed
        },
        replace: true
      })

    } catch (err: any) {
      setModalConfig({
        isOpen: true,
        type: 'danger',
        title: 'Erro ao corrigir',
        message: err.message || 'Erro ao corrigir prova no servidor.',
        confirmText: 'Entendi',
        onConfirm: closeModal
      })
      setIsSubmitting(false)
      timer.resume()
    }
  }

  return (
    <>
      <Modal {...modalConfig} />
      {isSubmitting && <LoadingSpinner overlay message="Corrigindo prova..." />}
      {timer.isPaused && !isSubmitting && !modalConfig.isOpen && (
        <div className="pause-overlay">
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: '2rem', marginBottom: '1.5rem', color: '#fff' }}>Simulado Pausado</h2>
            <button className="btn-primary" onClick={timer.resume} style={{ padding: '1rem 2rem', fontSize: '1.1rem' }}>
              <i className="ph ph-play" /> Retomar Simulado
            </button>
          </div>
        </div>
      )}

      <header className="exam-header">
        <div className="exam-header-left">
          <div className="exam-logo">{config.cert}</div>
          <div className="exam-progress">
            {currentIdx + 1} / {examQuestions.length}
          </div>
        </div>
        <div className="exam-header-center">
          <div className="progress-bar-container">
            <div
              className="progress-bar"
              style={{ width: `${((currentIdx + 1) / examQuestions.length) * 100}%` }}
            />
          </div>
        </div>
        <div className="exam-header-right" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button className="btn-icon" onClick={timer.isPaused ? timer.resume : timer.pause} title={timer.isPaused ? 'Continuar' : 'Pausar'} style={{ height: '32px', width: '32px' }}>
            <i className={`ph ${timer.isPaused ? 'ph-play' : 'ph-pause'}`} />
          </button>
          <button className="btn-primary btn-sm" onClick={handleFinishExam} style={{ padding: '0 1rem', height: '32px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <i className="ph ph-check" /> Finalizar
          </button>
          <div className="exam-timer">
            <i className="ph ph-timer" /> <span>{timer.formatted}</span>
          </div>
        </div>
      </header>

      <main className="exam-body" style={{ fontSize: `${fontSize}px` }}>
        <div className="question-container animate-slide-up" key={currentIdx}>
          <div className="question-meta">
            <div style={{ display: 'flex', gap: '8px' }}>
              <span className="tag tag-cert">{CERT_META[config.cert].name}</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-icon" onClick={() => setFontSize(f => Math.max(12, f - 1))} title="Diminuir fonte">
                <i className="ph ph-text-aa" style={{ fontSize: '0.9em' }} />
              </button>
              <button className="btn-icon" onClick={() => setFontSize(f => Math.min(24, f + 1))} title="Aumentar fonte">
                <i className="ph ph-text-aa" style={{ fontSize: '1.2em' }} />
              </button>
              <button
                className="btn-icon"
                onClick={handleFlag}
                style={{ color: flagged.has(currentIdx) ? 'var(--orange)' : undefined }}
                title="Sinalizar questão para revisão"
              >
                <i className={flagged.has(currentIdx) ? "ph-fill ph-flag" : "ph ph-flag"} />
              </button>
            </div>
          </div>

          <div
            className="question-text"
            dangerouslySetInnerHTML={{ __html: formatText(q.pergunta) }}
          />

          <div className="options-list">
            {isMulti && (
              <p className="multi-hint">Selecione {numCorrect} respostas</p>
            )}

            {q.opcoes.map((opt, i) => {
              const letters = ['A', 'B', 'C', 'D', 'E', 'F']
              
              let isSelected = false
              if (isMulti) {
                const userArr = (answers[currentIdx] as number[]) || []
                isSelected = userArr.includes(i)
              } else {
                isSelected = answers[currentIdx] === i
              }

              let btnClasses = 'option-btn'
              if (isSelected) btnClasses += ' selected'

              if (isComplete) {
                if (correctSet.includes(i)) btnClasses += ' is-correct-train'
                else if (isSelected && !correctSet.includes(i)) btnClasses += ' is-wrong-train'
              }

              return (
                <button
                  key={i}
                  className={btnClasses}
                  onClick={() => handleOptionClick(i)}
                  style={{ cursor: isComplete ? 'default' : 'pointer' }}
                >
                  <span className="option-letter">{letters[i]}</span>
                  <span
                    className="option-text"
                    dangerouslySetInnerHTML={{ __html: formatText(opt) }}
                  />
                </button>
              )
            })}

            {isComplete && q.explicacao && (
              <div className="ri-explanation" style={{ marginTop: '1.5rem' }}>
                <strong>Explicação:</strong><br /><br />
                <div dangerouslySetInnerHTML={{ __html: formatText(q.explicacao) }} />
              </div>
            )}
          </div>

          <div className="question-nav" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem' }}>
            <button
              className="btn-nav"
              disabled={currentIdx === 0}
              onClick={() => setCurrentIdx(i => i - 1)}
            >
              <i className="ph ph-arrow-left" /> Anterior
            </button>
            
            <div className="question-dots">
              {examQuestions.map((_, i) => (
                <div
                  key={i}
                  className={`dot ${i === currentIdx ? 'current' : ''} ${!isAnswerEmpty(answers[i]) ? 'answered' : ''}`}
                  onClick={() => setCurrentIdx(i)}
                />
              ))}
            </div>

            <button 
              className="btn-nav-primary" 
              disabled={currentIdx === examQuestions.length - 1}
              onClick={() => setCurrentIdx(i => i + 1)}
            >
              Próxima <i className="ph ph-arrow-right" />
            </button>
          </div>

        </div>
      </main>
    </>
  )
}
