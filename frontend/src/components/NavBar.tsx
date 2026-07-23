/**
 * Sidebar — navegação lateral fixa da aplicação KUMO.
 *
 * - Logo KUMO no topo
 * - Links de navegação verticais com ícones
 * - Usuário + logout no rodapé
 * - Hambúrguer no mobile
 * - Não aparece na tela de exame (fullscreen)
 */
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { buildCognitoLoginUrl } from './ProtectedRoute'

export default function Sidebar() {
  const { isAuthenticated, papel, email, nome, logout } = useAuth()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  // Não exibe Sidebar na tela de exame (fullscreen)
  if (location.pathname === '/exam') return null

  const userInitials = nome
    ? nome.substring(0, 2).toUpperCase()
    : (email ? email.split('@')[0].substring(0, 2).toUpperCase() : '?')

  const userName = nome || (email ? email.split('@')[0] : '')

  function closeMobile() {
    setMobileOpen(false)
  }

  return (
    <>
      {/* Hambúrguer toggle (mobile only) */}
      <button
        className="sidebar-toggle"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Menu"
      >
        <i className={mobileOpen ? 'ph ph-x' : 'ph ph-list'} />
      </button>

      {/* Overlay (mobile only) */}
      <div
        className={`sidebar-overlay ${mobileOpen ? 'open' : ''}`}
        onClick={closeMobile}
      />

      {/* Sidebar */}
      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        {/* Logo */}
        <Link to="/" className="sidebar-logo" onClick={closeMobile}>
          <div className="logo-icon">K</div>
          <span className="logo-text">KUMO</span>
        </Link>

        {/* Navigation */}
        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Menu</div>

          {isAuthenticated ? (
            <>
              <Link
                to="/"
                className={`sidebar-link ${location.pathname === '/' ? 'active' : ''}`}
                onClick={closeMobile}
              >
                <i className="ph ph-house" />
                <span>Simulados</span>
              </Link>

              <Link
                to="/progress"
                className={`sidebar-link ${location.pathname === '/progress' ? 'active' : ''}`}
                onClick={closeMobile}
              >
                <i className="ph ph-chart-line-up" />
                <span>Histórico</span>
              </Link>

              <Link
                to="/profile"
                className={`sidebar-link ${location.pathname === '/profile' ? 'active' : ''}`}
                onClick={closeMobile}
              >
                <i className="ph ph-user-circle" />
                <span>{papel === 'Aluno' ? 'Turmas e Perfil' : 'Meu Perfil'}</span>
              </Link>

              {papel === 'Mentor' && (
                <Link
                  to="/dashboard"
                  className={`sidebar-link ${location.pathname.startsWith('/dashboard') ? 'active' : ''}`}
                  onClick={closeMobile}
                >
                  <i className="ph ph-users-three" />
                  <span>Turmas</span>
                </Link>
              )}

              <div className="sidebar-section-label">Mais</div>

              <span className="sidebar-link" style={{ cursor: 'default', opacity: 0.5 }}>
                <i className="ph ph-trophy" />
                <span>Ranking</span>
                <span className="badge-soon">Em breve</span>
              </span>

              <span className="sidebar-link" style={{ cursor: 'default', opacity: 0.5 }}>
                <i className="ph ph-medal" />
                <span>Conquistas</span>
                <span className="badge-soon">Em breve</span>
              </span>

              <span className="sidebar-link" style={{ cursor: 'default', opacity: 0.5 }}>
                <i className="ph ph-gear" />
                <span>Configurações</span>
                <span className="badge-soon">Em breve</span>
              </span>
            </>
          ) : (
            <div className="sidebar-login-btns">
              <a href={buildCognitoLoginUrl('Aluno')} className="sidebar-login-btn aluno" onClick={closeMobile}>
                <i className="ph ph-student" />
                <span>Sou Aluno</span>
              </a>
              <a href={buildCognitoLoginUrl('Mentor')} className="sidebar-login-btn mentor" onClick={closeMobile}>
                <i className="ph ph-chalkboard-teacher" />
                <span>Sou Mentor</span>
              </a>
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          {isAuthenticated && (
            <>
              <div className="sidebar-user">
                <div className="sidebar-avatar">{userInitials}</div>
                <div className="sidebar-user-info">
                  <div className="sidebar-user-name">{userName}</div>
                  <div className="sidebar-user-role">{papel || 'Usuário'}</div>
                </div>
              </div>
              <button onClick={() => { logout(); closeMobile(); }} className="sidebar-logout">
                <i className="ph ph-sign-out" />
                <span>Sair</span>
              </button>
            </>
          )}
        </div>
      </aside>
    </>
  )
}
