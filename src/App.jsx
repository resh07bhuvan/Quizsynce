import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ToastProvider } from './lib/toast.jsx'
import { AdminProvider } from './lib/adminAuth.jsx'
import Home from './pages/Home.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import QuizLobby from './pages/QuizLobby.jsx'
import QuizPlay from './pages/QuizPlay.jsx'
import QuizResults from './pages/QuizResults.jsx'

export default function App() {
  return (
    <AdminProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/quiz/:quizId" element={<QuizLobby />} />
            <Route path="/quiz/:quizId/play" element={<QuizPlay />} />
            <Route path="/quiz/:quizId/results" element={<QuizResults />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AdminProvider>
  )
}
