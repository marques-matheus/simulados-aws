import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useApi } from '../hooks/useApi'
import { CERT_META, CERT_CODES } from '../utils/certMeta'
import { getRecentlyUsedIds } from '../utils/antiRepeat'
import LoadingSpinner from '../components/LoadingSpinner'
import type { Questao, ExamConfig } from '../types'

export default function HomePage() {
  const { isAuthenticated } = useAuth()
  const { apiFetch } = useApi()
  const navigate = useNavigate()

  const [loadingMsg, setLoadingMsg] = useState<string | null>(null)
  const [questionsCache, setQuestionsCache] = useState<Record<string, Questao[]>>({})
  
  const [selectedCert, setSelectedCert] = useState<string | null>(null)
  const [selectedTheme, setSelectedTheme] = useState('Todos')
  const [qty, setQty] = useState(30)
  const [trainingMode, setTrainingMode] = useState(false)

  // Fetch questions when a cert is clicked
  async function handleSelectCert(cert: string) {
    if (!isAuthenticated) {
      alert('Faça login primeiro para iniciar o simulado.')
      return
    }

    if (questionsCache[cert]) {
      setSelectedCert(cert)
      setSelectedTheme('Todos')
      return
    }

    setLoadingMsg(`Buscando questões do ${cert}...`)
    try {
      const data = await apiFetch<Questao[]>(`/questoes?prova=${cert}`)
      if (!data || data.length === 0) {
        alert('Nenhuma questão encontrada para esta certificação.')
        return
      }

      setQuestionsCache(prev => ({ ...prev, [cert]: data }))
      setSelectedCert(cert)
      setSelectedTheme('Todos')
    } catch (err: any) {
      alert(err.message || 'Erro ao carregar questões.')
    } finally {
      setLoadingMsg(null)
    }
  }

  function handleStart() {
    if (!selectedCert) return

    const pool = questionsCache[selectedCert] || []
    let filtered = pool
    if (selectedTheme !== 'Todos') {
      filtered = pool.filter(q => q.temas?.includes(selectedTheme))
    }

    if (filtered.length === 0) {
      alert('Nenhuma questão disponível para este filtro.')
      return
    }

    const config: ExamConfig = {
      cert: selectedCert,
      qty,
      trainingMode,
      theme: selectedTheme
    }

    // Navega para a página de exame passando a config e as questões disponíveis
    navigate('/exam', { state: { config, pool: filtered } })
  }

  // Derived state for the config panel
  const pool = selectedCert ? questionsCache[selectedCert] : []
  
  // Extrai temas únicos
  const uniqueThemes = new Set<string>()
  pool?.forEach(q => q.temas?.forEach(t => uniqueThemes.add(t)))
  const sortedThemes = Array.from(uniqueThemes).sort()

  // Filtra pool
  let currentPool = pool || []
  if (selectedTheme !== 'Todos') {
    currentPool = currentPool.filter(q => q.temas?.includes(selectedTheme))
  }

  const recentIds = selectedCert ? getRecentlyUsedIds(selectedCert) : new Set()
  const freshCount = currentPool.filter(q => !recentIds.has(q.SK)).length

  return (
    <div className="home-layout">
      {loadingMsg && <LoadingSpinner overlay message={loadingMsg} />}

      <header className="home-header">
        <div className="logotype">
          <div className="logo-mark">C</div>
          <div className="logo-text">Simulados <span>| AWS</span></div>
        </div>
        <h1>Domine a AWS com simulados focados</h1>
        <p>Pratique com questões atualizadas, acompanhe sua evolução e conquiste sua próxima certificação cloud.</p>
      </header>

      <div className="cert-section-title">Escolha sua Certificação</div>
      
      <div className="cert-list">
        {CERT_CODES.map(cert => {
          const meta = CERT_META[cert]
          const isActive = selectedCert === cert
          
          return (
            <div
              key={cert}
              className={`cert-card ${isActive ? 'active' : ''}`}
              onClick={() => handleSelectCert(cert)}
              data-cert={cert}
            >
              <div className="cert-icon">
                <i className={`ph ${meta.icon}`}></i>
              </div>
              <div className="cert-info">
                <span className={`cert-level ${meta.level}`}>{meta.level}</span>
                <h3>{meta.name}</h3>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="cert-code">{cert}</span>
                  <span className="cert-count" id={`count-${cert}`}>
                    {questionsCache[cert] ? `${questionsCache[cert].length} questões` : 'Acessar'}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {selectedCert && (
        <div className="exam-config">
          <div className="config-header">
            <h2>Configurar Simulado: {CERT_META[selectedCert].name}</h2>
            <button
              className="btn-outline btn-sm"
              onClick={() => setSelectedCert(null)}
            >
              Trocar
            </button>
          </div>

          <div className="config-group">
            <label>Tema Específico</label>
            <select
              className="select-premium"
              value={selectedTheme}
              onChange={e => setSelectedTheme(e.target.value)}
            >
              <option value="Todos">Todos (Simulado Completo)</option>
              {sortedThemes.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="config-group">
            <label>Quantidade de Questões</label>
            <div className="btn-group">
              {[10, 20, 30, 40, 65].map(q => (
                <button
                  key={q}
                  className={`btn-option ${qty === q ? 'active' : ''}`}
                  onClick={() => setQty(q)}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <div className="config-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '2rem 0' }}>
            <div>
              <label style={{ margin: 0 }}>Modo Treinamento</label>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Exibe gabarito e explicação imediatamente após responder.
              </p>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={trainingMode}
                onChange={e => setTrainingMode(e.target.checked)}
              />
              <span className="slider round"></span>
            </label>
          </div>

          <div className="config-stats" style={{ textAlign: 'center' }}>
            <p>
              <strong>{currentPool.length}</strong> questões disponíveis · <strong>{freshCount}</strong> novas para você
            </p>
            <button
              className="btn-primary"
              style={{ fontSize: '1.1rem', padding: '1rem' }}
              onClick={handleStart}
            >
              Iniciar Simulado
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
