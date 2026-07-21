import { useState, useEffect } from 'react'
import { CERT_META, CERT_CODES } from '../utils/certMeta'
import { type PerformanceRecord } from '../utils/antiRepeat'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
} from 'chart.js'
import CertBadge from '../components/CertBadge'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip)

function formatTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0')
}

import { useAuth } from '../context/AuthContext'
import { useApi } from '../hooks/useApi'
import LoadingSpinner from '../components/LoadingSpinner'

export default function ProgressPage() {
  const { sub } = useAuth()
  const { apiFetch } = useApi()
  const [data, setData] = useState<Record<string, PerformanceRecord[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!sub) return

    apiFetch<any[]>(`/historico/${sub}`)
      .then(res => {
        const loadedData: Record<string, PerformanceRecord[]> = {}
        const items = res || []
        
        items.forEach(item => {
          const cert = item.certificacao
          if (!loadedData[cert]) loadedData[cert] = []
          loadedData[cert].push({
            date: item.data_iso,
            score: item.score,
            correct: item.corretas,
            wrong: item.erradas,
            skipped: item.puladas,
            total: item.total,
            timeTaken: item.tempo_segundos || 0
          })
        })
        
        // Ensure they are sorted from oldest to newest for the chart, 
        // since the API returns newest first (ScanIndexForward=False)
        Object.keys(loadedData).forEach(cert => {
          loadedData[cert].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        })
        
        setData(loadedData)
      })
      .catch(err => console.error("Erro ao buscar histórico:", err))
      .finally(() => setLoading(false))
  }, [sub])

  const hasAny = Object.keys(data).length > 0

  return (
    <div className="page-container">
      {loading && <LoadingSpinner overlay message="Buscando histórico..." />}

      <header className="home-header" style={{ marginBottom: '2rem' }}>
        <h1>Sua Evolução</h1>
        <p>Acompanhe seu desempenho nos simulados e veja seu progresso rumo à certificação.</p>
      </header>

      {!loading && !hasAny ? (
        <div className="progress-empty">
          <i className="ph ph-chart-line-down" />
          <p>Você ainda não concluiu nenhum simulado.</p>
          <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>Faça um simulado para começar a acompanhar sua evolução.</p>
        </div>
      ) : (
        <div className="progress-list">
          {CERT_CODES.map((cert, idx) => {
            const history = data[cert]
            if (!history) return null
            
            const meta = CERT_META[cert]
            
            const chartData = {
              labels: history.map((_, i) => `Tentativa ${i + 1}`),
              datasets: [{
                data: history.map(h => h.score),
                borderColor: meta.color,
                backgroundColor: `${meta.color}33`,
                borderWidth: 2,
                pointBackgroundColor: meta.color,
                pointBorderColor: '#fff',
                pointRadius: 4,
                fill: true,
                tension: 0.3
              }]
            }

            const chartOptions = {
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                y: { beginAtZero: true, max: 100, grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#9ca3af' } },
                x: { grid: { display: false }, ticks: { color: '#9ca3af' } }
              },
              plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (context: any) => `${context.parsed.y}%` } }
              }
            }

            return (
              <div key={cert} className="progress-cert-group" style={{ animationDelay: `${idx * 0.05}s` }}>
                <div className="progress-cert-header">
                  <h3>{meta.name}</h3>
                  <CertBadge cert={cert} />
                </div>
                
                <div style={{ padding: '1.5rem 1.5rem 0', borderBottom: '1px solid var(--border)', height: '200px' }}>
                  <Line data={chartData} options={chartOptions as any} />
                </div>

                <div className="progress-items">
                  {[...history].reverse().map((h, i) => {
                    const d = new Date(h.date)
                    const dateStr = d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                    const isPass = h.score >= 70
                    const scoreClass = isPass ? 'pass' : 'fail'

                    return (
                      <div key={i} className="progress-item">
                        <div className="progress-item-left">
                          <span className="progress-date">{dateStr}</span>
                          <div className="progress-details">
                            <span title="Tempo"><i className="ph ph-timer" /> {formatTime(h.timeTaken || 0)}</span>
                            <span title="Corretas"><i className="ph ph-check" style={{ color: 'var(--green)' }} /> {h.correct}</span>
                            <span title="Erradas"><i className="ph ph-x" style={{ color: 'var(--red)' }} /> {h.wrong}</span>
                            <span title="Total">Total: {h.total}</span>
                          </div>
                        </div>
                        <div className={`progress-score ${scoreClass}`}>{h.score}%</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
