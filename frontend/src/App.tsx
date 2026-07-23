/**
 * App.tsx — Layout principal e definição de rotas.
 *
 * Layout:
 *   Sidebar (fixa à esquerda) + conteúdo principal à direita
 *
 * Rotas:
 *   /                    → HomePage (Aluno + Mentor)
 *   /exam                → ExamPage (autenticado, fullscreen sem sidebar)
 *   /result              → ResultPage (autenticado)
 *   /review              → ReviewPage (autenticado)
 *   /progress            → ProgressPage (autenticado)
 *   /dashboard           → DashboardTurmaPage (Mentor only)
 *   /dashboard/:alunoId  → DashboardAlunoPage (Mentor only)
 */
import { useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Sidebar from './components/NavBar'
import ProtectedRoute from './components/ProtectedRoute'

import HomePage from './pages/HomePage'
import ExamPage from './pages/ExamPage'
import ResultPage from './pages/ResultPage'
import ReviewPage from './pages/ReviewPage'
import ProgressPage from './pages/ProgressPage'
import ProfilePage from './pages/ProfilePage'
import DashboardTurmaPage from './pages/DashboardTurmaPage'
import DashboardAlunoPage from './pages/DashboardAlunoPage'

export default function App() {
  const { login } = useAuth()
  const location = useLocation()

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

  // Exam page is fullscreen — no sidebar wrapper
  const isExam = location.pathname === '/exam'

  return (
    <div className={isExam ? '' : 'app-layout'}>
      <Sidebar />
      <main className={isExam ? '' : 'app-content'}>
        <Routes>
          {/* Rotas públicas (requerem apenas autenticação) */}
          <Route path="/" element={<HomePage />} />
          <Route path="/exam" element={<ExamPage />} />
          <Route path="/result" element={<ResultPage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

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
      </main>
    </div>
  )
}
