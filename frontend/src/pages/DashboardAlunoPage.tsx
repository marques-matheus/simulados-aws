import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import LoadingSpinner from '../components/LoadingSpinner'
import CertBadge from '../components/CertBadge'
import { Line } from 'react-chartjs-2'
import type { RegistroHistorico } from '../types'
import { CERT_META } from '../utils/certMeta'

export default function DashboardAlunoPage() {
  const { alunoId } = useParams()
  const { state } = useLocation()
  const navigate = useNavigate()
  const { apiFetch } = useApi()

  const [historico, setHistorico] = useState<RegistroHistorico[]>([])
  const [loading, setLoading] = useState(true)

  const turmaId = state?.turmaId

  useEffect(() => {
    if (!alunoId || !turmaId) {
      navigate('/dashboard')
      return
    }

    async function loadHistorico() {
      try {
        const data = await apiFetch<RegistroHistorico[]>(`/historico/${alunoId}?turma_id=${turmaId}`)
        setHistorico(data || [])
      } catch (err: any) {
        alert(err.message || 'Erro ao carregar histórico do aluno.')
      } finally {
        setLoading(false)
      }
    }

    loadHistorico()
  }, [alunoId, turmaId, navigate]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return <LoadingSpinner overlay message="Carregando dados do aluno..." />
  }

  // Agrupar histórico por certificação
  const certsMap = new Map<string, RegistroHistorico[]>()
  historico.forEach(reg => {
    if (!certsMap.has(reg.certificacao)) {
      certsMap.set(reg.certificacao, [])
    }
    certsMap.get(reg.certificacao)!.push(reg)
  })

  // Para ordenar temporalmente, os dados do DynamoDB já devem vir ordenados pelo SK (data ISO), 
  // mas garantimos a ordenação
  certsMap.forEach(registros => {
    registros.sort((a, b) => new Date(a.data_iso).getTime() - new Date(b.data_iso).getTime())
  })

  return (
    <div className="dashboard-container">
      <header className="dashboard-header" style={{ marginBottom: '2rem' }}>
        <div>
          <button className="btn-outline btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: '1rem' }}>
            <i className="ph ph-arrow-left" /> Voltar à Turma
          </button>
          <h1>Análise Individual do Aluno</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            {state?.nomeAluno || state?.emailAluno?.split('@')[0] || alunoId}
            {state?.emailAluno && state?.nomeAluno && <span style={{ fontSize: '0.85rem', marginLeft: '8px' }}>({state.emailAluno})</span>}
          </p>
        </div>
      </header>

      {historico.length === 0 ? (
        <div className="empty-state">
          <i className="ph ph-chart-line-down" />
          <h3>Nenhum histórico encontrado</h3>
          <p>Este aluno ainda não concluiu nenhum simulado.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {Array.from(certsMap.entries()).map(([cert, registros]) => {
            const meta = CERT_META[cert] || { name: cert, color: '#ff9900' }
            
            const chartData = {
              labels: registros.map((_, i) => `Simulado ${i + 1}`),
              datasets: [{
                label: `Score %`,
                data: registros.map(r => r.score),
                borderColor: meta.color,
                backgroundColor: `${meta.color}33`,
                borderWidth: 2,
                fill: true,
                tension: 0.3
              }]
            }

            return (
              <div key={cert} className="dashboard-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h3>Desempenho: {meta.name}</h3>
                  <CertBadge cert={cert} />
                </div>
                
                <div style={{ height: '250px', marginBottom: '1.5rem' }}>
                  <Line
                    data={chartData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      scales: {
                        y: { beginAtZero: true, max: 100, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af' } },
                        x: { grid: { display: false }, ticks: { color: '#9ca3af' } }
                      },
                      plugins: { legend: { display: false } }
                    }}
                  />
                </div>

                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Score</th>
                      <th>Corretas</th>
                      <th>Erradas</th>
                      <th>Puladas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...registros].reverse().map(r => {
                      const d = new Date(r.data_iso)
                      return (
                        <tr key={r.id}>
                          <td>{d.toLocaleDateString('pt-BR')} às {d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
                          <td>
                            <span style={{ color: r.score >= 70 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                              {r.score}%
                            </span>
                          </td>
                          <td style={{ color: 'var(--green)' }}>{r.corretas}</td>
                          <td style={{ color: 'var(--red)' }}>{r.erradas}</td>
                          <td style={{ color: 'var(--text-muted)' }}>{r.puladas}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
