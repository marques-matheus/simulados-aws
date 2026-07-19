/**
 * NavBar — cabeçalho da aplicação.
 *
 * - Exibe logo CloudCerto
 * - Botão Login / Logout
 * - Links de navegação condicionais por papel
 * - Link para Dashboard (apenas Mentor)
 */
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { buildCognitoLoginUrl } from './ProtectedRoute'

export default function NavBar() {
  const { isAuthenticated, papel, email, logout } = useAuth()
  const location = useLocation()

  // Não exibe NavBar na tela de exame (fullscreen)
  if (location.pathname === '/exam') return null

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        {/* Logo */}
        <Link to="/" className="navbar-logo">
          <span className="logo-mark">C</span>
          <span className="logo-text">
            CloudCerto<span> | AWS</span>
          </span>
        </Link>

        {/* Navigation links */}
        <div className="navbar-links">
          {isAuthenticated && (
            <>
              <Link
                to="/"
                className={`navbar-link ${location.pathname === '/' ? 'active' : ''}`}
              >
                <i className="ph ph-house" />
                <span>Início</span>
              </Link>

              <Link
                to="/progress"
                className={`navbar-link ${location.pathname === '/progress' ? 'active' : ''}`}
              >
                <i className="ph ph-chart-line-up" />
                <span>Evolução</span>
              </Link>

              {papel === 'Mentor' && (
                <Link
                  to="/dashboard"
                  className={`navbar-link ${location.pathname.startsWith('/dashboard') ? 'active' : ''}`}
                >
                  <i className="ph ph-users-three" />
                  <span>Dashboard</span>
                </Link>
              )}
            </>
          )}
        </div>

        {/* Auth section */}
        <div className="navbar-auth">
          {isAuthenticated ? (
            <>
              {email && (
                <span className="navbar-email" title={email}>
                  {email.split('@')[0]}
                </span>
              )}
              <button onClick={logout} className="btn-outline btn-sm navbar-btn">
                <i className="ph ph-sign-out" />
                <span>Sair</span>
              </button>
            </>
          ) : (
            <a href={buildCognitoLoginUrl()} className="btn-primary btn-sm navbar-btn">
              <i className="ph ph-sign-in" />
              <span>Fazer Login</span>
            </a>
          )}
        </div>
      </div>
    </nav>
  )
}
