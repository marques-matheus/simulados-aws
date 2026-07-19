/**
 * main.tsx — Ponto de entrada do React.
 *
 * Monta a árvore:
 *   ReactDOM.createRoot → AuthProvider → BrowserRouter → App
 *
 * Importa o style.css global (adaptado para React).
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import App from './App'
import './style.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
)
