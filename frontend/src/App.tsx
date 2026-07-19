/**
 * App.tsx — Definição de rotas e captura do token Cognito.
 *
 * Rotas:
 *   /                    → HomePage (Aluno + Mentor)
 *   /exam                → ExamPage (autenticado)
 *   /result              → ResultPage (autenticado)
 *   /review              → ReviewPage (autenticado)
 *   /progress            → ProgressPage (autenticado)
 *   /dashboard           → DashboardTurmaPage (Mentor only)
 *   /dashboard/:alunoId  → DashboardAlunoPage (Mentor only)
 */
import { useEffect } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import NavBar from './components/NavBar'
import ProtectedRoute from './components/ProtectedRoute'

// Páginas — lazy import seria ideal, mas para o MVP importamos direto
// (serão criadas nas tasks 9-11; por agora usamos placeholders)
import HomePage from './pages/HomePage'
import ExamPage from './pages/ExamPage'
import ResultPage from './pages/ResultPage'
import ReviewPage from './pages/ReviewPage'
import ProgressPage from './pages/ProgressPage'
import DashboardTurmaPage from './pages/DashboardTurmaPage'
import DashboardAlunoPage from './pages/DashboardAlunoPage'

export default function App() {
  const { login, isAuthenticated, papel } = useAuth()
  const navigate = useNavigate()

  // Captura o token do hash da URL após redirect do Cognito Hosted UI
  useEffect(() => {
    const hash = window.location.hash.substring(1)
    if (!hash) return

    const params = new URLSearchParams(hash)
    const idToken = params.get('id_token')

    if (idToken) {
      login(idToken)
      // Limpa o hash da URL
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [login])

  // Redireciona Mentor para /dashboard após login
  useEffect(() => {
    if (isAuthenticated && papel === 'Mentor' && window.location.pathname === '/') {
      navigate('/dashboard', { replace: true })
    }
  }, [isAuthenticated, papel, navigate])

  return (
    <>
      <NavBar />
      <Routes>
        {/* Rotas públicas (requerem apenas autenticação) */}
        <Route path="/" element={<HomePage />} />
        <Route path="/exam" element={<ExamPage />} />
        <Route path="/result" element={<ResultPage />} />
        <Route path="/review" element={<ReviewPage />} />
        <Route path="/progress" element={<ProgressPage />} />

        {/* Rotas protegidas — apenas Mentor */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute requiredPapel="Mentor">
              <DashboardTurmaPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/:alunoId"
          element={
            <ProtectedRoute requiredPapel="Mentor">
              <DashboardAlunoPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  )
}
