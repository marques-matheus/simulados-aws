import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useApi } from '../hooks/useApi'
import type { Turma } from '../types'

export default function ProfilePage() {
  const { isAuthenticated, papel, email, nome, updateNome } = useAuth()
  const { apiFetch } = useApi()

  const [minhasTurmas, setMinhasTurmas] = useState<Turma[]>([])
  const [loadingTurmas, setLoadingTurmas] = useState(false)
  const [entrandoTurma, setEntrandoTurma] = useState(false)
  const [codigoConvite, setCodigoConvite] = useState('')

  const [meuNome, setMeuNome] = useState(nome || '')
  const [salvandoPerfil, setSalvandoPerfil] = useState(false)

  useEffect(() => {
    if (!isAuthenticated || papel !== 'Aluno') return

    async function loadMinhasTurmas() {
      setLoadingTurmas(true)
      try {
        const res = await apiFetch<Turma[]>('/turmas/minhas')
        setMinhasTurmas(res || [])
      } catch (err) {
        console.error('Erro ao carregar minhas turmas', err)
      } finally {
        setLoadingTurmas(false)
      }
    }
    loadMinhasTurmas()
  }, [isAuthenticated, papel, apiFetch])

  async function handleEntrarTurma(e: React.FormEvent) {
    e.preventDefault()
    if (!codigoConvite.trim()) return

    setEntrandoTurma(true)
    try {
      await apiFetch('/turmas/entrar', {
        method: 'POST',
        body: JSON.stringify({ codigo_convite: codigoConvite.trim() })
      })
      alert('Você entrou na turma com sucesso!')
      setCodigoConvite('')
      
      const res = await apiFetch<Turma[]>('/turmas/minhas')
      setMinhasTurmas(res || [])
    } catch (err: any) {
      alert(err.message || 'Erro ao entrar na turma. Verifique o código.')
    } finally {
      setEntrandoTurma(false)
    }
  }

  async function handleSalvarPerfil(e: React.FormEvent) {
    e.preventDefault()
    if (!meuNome.trim()) return
    setSalvandoPerfil(true)
    try {
      const res = await apiFetch<{mensagem: string}>('/perfil', {
        method: 'POST',
        body: JSON.stringify({ nome: meuNome })
      })
      updateNome(meuNome)
      alert(res.mensagem + ' (Seu nome foi atualizado com sucesso e já está visível na barra lateral!).')
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar perfil.')
    } finally {
      setSalvandoPerfil(false)
    }
  }

  if (!isAuthenticated) return null

  return (
    <div className="page-container">
      <div className="dashboard-header">
        <h1>Meu Perfil</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Gerencie suas informações e turmas.</p>
      </div>

      <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr' }}>
        <div className="dashboard-card" style={{ marginBottom: '1.5rem' }}>
          <h3><i className="ph ph-user-circle" /> Informações Pessoais</h3>
          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <div><strong style={{ color: 'var(--text-muted)', display: 'inline-block', width: '70px' }}>Nome:</strong> <span style={{ color: '#fff', fontWeight: 500 }}>{nome || 'Não definido'}</span></div>
            <div><strong style={{ color: 'var(--text-muted)', display: 'inline-block', width: '70px' }}>E-mail:</strong> <span style={{ color: '#fff', fontWeight: 500 }}>{email}</span></div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <strong style={{ color: 'var(--text-muted)', display: 'inline-block', width: '70px' }}>Papel:</strong> 
              <span className={`papel-badge ${papel?.toLowerCase()}`}>{papel}</span>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem', marginTop: '1.5rem' }}>
            <h4 style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--text)' }}>Como você quer ser chamado(a)?</h4>
            <form onSubmit={handleSalvarPerfil} style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="text" 
                placeholder="Seu nome completo ou apelido" 
                value={meuNome}
                onChange={e => setMeuNome(e.target.value)}
                disabled={salvandoPerfil}
                style={{ flex: 1, padding: '0.8rem', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-inset)', color: 'var(--text)' }}
              />
              <button type="submit" className="btn-primary" style={{ width: 'auto' }} disabled={salvandoPerfil}>
                {salvandoPerfil ? 'Salvando...' : 'Salvar Nome'}
              </button>
            </form>
          </div>
        </div>

        {papel === 'Aluno' && (
          <div className="dashboard-card">
            <h3><i className="ph ph-users-three" /> Minhas Turmas</h3>
            
            {loadingTurmas ? (
              <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>Carregando turmas...</p>
            ) : minhasTurmas.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '1.5rem', marginTop: '1rem' }}>
                {minhasTurmas.map(t => (
                  <div key={t.turma_id} className="turma-current">
                    <i className="ph ph-chalkboard-teacher" />
                    <span>Você está na turma: <strong className="turma-name" style={{ color: '#fff' }}>{t.nome_turma || t.nome}</strong></span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', marginTop: '1rem', marginBottom: '1.5rem' }}>
                Você ainda não está em nenhuma turma. Peça o código de convite ao seu mentor.
              </p>
            )}
            
            {minhasTurmas.length < 2 && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                <h4 style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--text)' }}>Entrar em uma nova turma</h4>
                <form onSubmit={handleEntrarTurma} className="turma-join-form">
                  <input 
                    type="text" 
                    placeholder="CÓDIGO DE CONVITE" 
                    value={codigoConvite}
                    onChange={e => setCodigoConvite(e.target.value.toUpperCase())}
                    disabled={entrandoTurma}
                  />
                  <button type="submit" className="btn-primary" style={{ width: 'auto' }} disabled={entrandoTurma}>
                    {entrandoTurma ? 'Entrando...' : 'Entrar'}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
