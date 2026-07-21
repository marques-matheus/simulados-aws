import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import LoadingSpinner from '../components/LoadingSpinner'
import CertBadge from '../components/CertBadge'
import type { Turma, DashboardTurma } from '../types'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip)

export default function DashboardTurmaPage() {
  const { apiFetch } = useApi()
  const { email } = useAuth()
  const navigate = useNavigate()

  const [turmas, setTurmas] = useState<Turma[]>([])
  const [selectedTurmaId, setSelectedTurmaId] = useState<string | null>(null)
  const [dashboardData, setDashboardData] = useState<DashboardTurma | null>(null)
  const [loading, setLoading] = useState(true)
  const [novaTurmaNome, setNovaTurmaNome] = useState('')
  const [criandoTurma, setCriandoTurma] = useState(false)

  // 1. Carrega a lista de turmas
  useEffect(() => {
    async function loadTurmas() {
      try {
        const res = await apiFetch<Turma[]>('/turmas')
        setTurmas(res || [])
        if (res && res.length > 0) {
          setSelectedTurmaId(res[0].turma_id)
        }
      } catch (err: any) {
        alert(err.message || 'Erro ao carregar turmas.')
      } finally {
        setLoading(false)
      }
    }
    loadTurmas()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 2. Quando seleciona uma turma, carrega o dashboard dela
  useEffect(() => {
    if (!selectedTurmaId) return

    async function loadDashboard() {
      setLoading(true)
      try {
        const data = await apiFetch<DashboardTurma>(`/dashboard/turma/${selectedTurmaId}`)
        setDashboardData(data)
      } catch (err: any) {
        alert(err.message || 'Erro ao carregar dashboard da turma.')
      } finally {
        setLoading(false)
      }
    }
    loadDashboard()
  }, [selectedTurmaId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCriarTurma(e: React.FormEvent) {
    e.preventDefault()
    if (!novaTurmaNome.trim()) return

    setCriandoTurma(true)
    try {
      const res = await apiFetch<Turma>('/turmas', {
        method: 'POST',
        body: JSON.stringify({ nome_turma: novaTurmaNome })
      })
      setTurmas(prev => [...prev, res])
      setSelectedTurmaId(res.turma_id)
      setNovaTurmaNome('')
      alert(`Turma criada! Código de convite: ${res.codigo_convite}`)
    } catch (err: any) {
      alert(err.message || 'Erro ao criar turma.')
    } finally {
      setCriandoTurma(false)
    }
  }

  function handleExcluirAluno(alunoId: string) {
    if (!selectedTurmaId) return
    if (!window.confirm('Tem certeza que deseja remover este aluno da turma?')) return

    apiFetch(`/turmas/${selectedTurmaId}/membros/${alunoId}`, { method: 'DELETE' })
      .then(() => {
        alert('Aluno removido.')
        // Reload dashboard
        setDashboardData(prev => prev ? {
          ...prev,
          alunos: prev.alunos.filter(a => a.aluno_id !== alunoId),
          ranking: prev.ranking.filter(r => r.aluno_id !== alunoId)
        } : null)
      })
      .catch(err => alert(err.message))
  }

  if (loading && turmas.length === 0) {
    return <LoadingSpinner overlay message="Carregando turmas..." />
  }

  return (
    <div className="dashboard-container">
      {loading && <LoadingSpinner overlay message="Atualizando dashboard..." />}

      <div className="dashboard-header">
        <div>
          <h1>Dashboard da Turma</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Olá, {email?.split('@')[0]}. Acompanhe o desempenho dos seus alunos.
          </p>
        </div>

        {turmas.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', minWidth: '250px' }}>
            <select
              className="select-premium"
              value={selectedTurmaId || ''}
              onChange={e => setSelectedTurmaId(e.target.value)}
              style={{ width: '100%' }}
            >
              {turmas.map(t => (
                <option key={t.turma_id} value={t.turma_id}>
                  {t.nome_turma || t.nome}
                </option>
              ))}
            </select>
            {turmas.find(t => t.turma_id === selectedTurmaId)?.codigo_convite && (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', background: 'var(--bg-inset)', padding: '4px 12px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                Convite: <span className="codigo-convite" style={{ fontWeight: 'bold', letterSpacing: '1px' }}>{turmas.find(t => t.turma_id === selectedTurmaId)?.codigo_convite}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {turmas.length === 0 ? (
        <div className="turmas-section">
          <div className="empty-state">
            <i className="ph ph-users-three" />
            <h3>Você ainda não possui turmas</h3>
            <p>Crie sua primeira turma para convidar alunos.</p>
          </div>
          
          <form onSubmit={handleCriarTurma} style={{ maxWidth: '400px', margin: '0 auto', display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder="Nome da Turma"
              value={novaTurmaNome}
              onChange={e => setNovaTurmaNome(e.target.value)}
              style={{ flex: 1, padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-inset)', color: '#fff' }}
              disabled={criandoTurma}
            />
            <button type="submit" className="btn-primary" style={{ width: 'auto' }} disabled={criandoTurma}>
              {criandoTurma ? 'Criando...' : 'Criar Turma'}
            </button>
          </form>
        </div>
      ) : (
        <>
          <div className="dashboard-grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
            {/* Lista de Alunos */}
            <div className="dashboard-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3><i className="ph ph-users" /> Alunos ({dashboardData?.alunos.length || 0})</h3>
              </div>

              {dashboardData?.alunos.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>Nenhum aluno nesta turma ainda. Compartilhe o código de convite.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Aluno</th>
                        <th>Simulados</th>
                        <th>Média Geral</th>
                        <th>Certificações Ativas</th>
                        <th>Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardData?.alunos.map(a => (
                        <tr key={a.aluno_id} onClick={() => navigate(`/dashboard/${a.aluno_id}`, { state: { turmaId: selectedTurmaId } })}>
                          <td style={{ color: '#fff', fontWeight: 500 }}>{a.email.split('@')[0]}</td>
                          <td>{a.total_simulados}</td>
                          <td>
                            <span style={{ color: a.score_medio >= 70 ? 'var(--green)' : 'var(--orange)', fontWeight: 600 }}>
                              {a.score_medio}%
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              {a.certificacoes.map(c => {
                                let trendIcon = null
                                if (c.tendencia === 'melhorando') trendIcon = <i className="ph ph-trend-up trend-up" title="Melhorando" />
                                else if (c.tendencia === 'piorando') trendIcon = <i className="ph ph-trend-down trend-down" title="Piorando" />
                                else trendIcon = <i className="ph ph-minus trend-stable" title="Estável" />

                                return (
                                  <div key={c.cert} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <CertBadge cert={c.cert} size="sm" />
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{c.ultimo_score}%</span>
                                    <span className="trend-icon">{trendIcon}</span>
                                  </div>
                                )
                              })}
                            </div>
                          </td>
                          <td onClick={e => e.stopPropagation()}>
                            <button className="btn-icon" onClick={() => handleExcluirAluno(a.aluno_id)} title="Remover aluno">
                              <i className="ph ph-trash" style={{ color: 'var(--red)' }} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Ranking e Domínios Fracos */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="dashboard-card">
                <h3><i className="ph ph-trophy" /> Ranking Geral</h3>
                {dashboardData?.ranking.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Sem dados suficientes para ranking.</p>
                ) : (
                  <div className="ranking-list">
                    {dashboardData?.ranking.slice(0, 5).map((r, i) => (
                      <div key={r.aluno_id} className={`ranking-item top-${i + 1}`}>
                        <div className="ranking-position">{i + 1}</div>
                        <div className="ranking-info">
                          <div className="email">{r.email.split('@')[0]}</div>
                          <div className="score">Média: {r.score_medio}%</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="dashboard-card">
                <h3><i className="ph ph-warning-circle" /> Domínios Críticos (Turma)</h3>
                {dashboardData?.dominios_fracos.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Nenhum domínio crítico detectado.</p>
                ) : (
                  <div style={{ height: '200px' }}>
                    <Bar
                      data={{
                        labels: dashboardData?.dominios_fracos.map(d => d.dominio.length > 15 ? d.dominio.substring(0,15)+'...' : d.dominio) || [],
                        datasets: [{
                          label: 'Média Acerto (%)',
                          data: dashboardData?.dominios_fracos.map(d => d.media_acerto) || [],
                          backgroundColor: 'rgba(239, 68, 68, 0.7)',
                          borderRadius: 4
                        }]
                      }}
                      options={{
                        indexAxis: 'y',
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                          x: { max: 100, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af' } },
                          y: { grid: { display: false }, ticks: { color: '#9ca3af', font: { size: 10 } } }
                        }
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="turmas-section" style={{ marginTop: '2rem' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}><i className="ph ph-plus-circle" /> Criar Nova Turma</h3>
            <form onSubmit={handleCriarTurma} style={{ display: 'flex', gap: '8px', maxWidth: '500px' }}>
              <input
                type="text"
                placeholder="Nome da Turma"
                value={novaTurmaNome}
                onChange={e => setNovaTurmaNome(e.target.value)}
                style={{ flex: 1, padding: '0.7rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-inset)', color: '#fff' }}
                disabled={criandoTurma}
              />
              <button type="submit" className="btn-primary" style={{ width: 'auto' }} disabled={criandoTurma}>
                {criandoTurma ? 'Criando...' : 'Criar Turma'}
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  )
}
