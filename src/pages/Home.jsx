import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useAdmin } from '../lib/adminAuth.jsx'
import { useToast } from '../lib/toast.jsx'
import AdminLoginModal from '../components/AdminLoginModal.jsx'
import './Home.css'

export default function Home() {
  const [quizCode, setQuizCode] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [loading, setLoading] = useState(false)
  const [showAdminLogin, setShowAdminLogin] = useState(false)
  const [activeQuizzes, setActiveQuizzes] = useState([])
  const [loadingQuizzes, setLoadingQuizzes] = useState(true)
  const { isAdmin } = useAdmin()
  const toast = useToast()
  const navigate = useNavigate()

  useEffect(() => {
    fetchActiveQuizzes()
    const channel = supabase
      .channel('public_quizzes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quizzes' }, () => {
        fetchActiveQuizzes()
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  async function fetchActiveQuizzes() {
    try {
      const { data, error } = await supabase
        .from('quizzes')
        .select('id, title, status, question_count, created_at')
        .eq('is_active', true)
        .neq('status', 'ended')
        .order('created_at', { ascending: false })
      if (!error && data) setActiveQuizzes(data)
    } catch {}
    setLoadingQuizzes(false)
  }

  async function handleJoin(e) {
    e.preventDefault()
    if (!quizCode.trim() || !playerName.trim()) {
      toast('Enter both your name and quiz code.', 'error')
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('quizzes')
        .select('id, title, status, is_active')
        .eq('code', quizCode.trim().toUpperCase())
        .single()
      if (error || !data) {
        toast('Quiz not found. Check your code and try again.', 'error')
        setLoading(false)
        return
      }
      if (!data.is_active) {
        toast('This quiz is no longer active.', 'error')
        setLoading(false)
        return
      }
      if (data.status === 'ended') {
        toast('This quiz has already ended.', 'error')
        setLoading(false)
        return
      }
      sessionStorage.setItem('player_name', playerName.trim())
      navigate(`/quiz/${data.id}`)
    } catch (err) {
      toast('Something went wrong. Please try again.', 'error')
    }
    setLoading(false)
  }

  if (isAdmin) {
    navigate('/admin')
    return null
  }

  return (
    <div className="home-page">
      <header className="home-header">
        <div className="container flex items-center justify-between">
          <div className="logo">
            <span className="logo-mark">Q</span>
            <span className="logo-text">QuizSynce</span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowAdminLogin(true)}>
            Admin
          </button>
        </div>
      </header>

      <main className="home-main">
        <div className="home-hero">
          <div className="hero-content">
            <div className="hero-eyebrow">
              <span className="dot dot-green pulse"></span>
              <span>Live multiplayer quizzes</span>
            </div>
            <h1 className="hero-title">
              Test knowledge,<br />
              <span className="hero-accent">together.</span>
            </h1>
            <p className="hero-sub">
              Enter the quiz code shared by your admin and compete with everyone in real time.
            </p>
          </div>

          <div className="join-card card">
            <h2 style={{ fontSize: '1.125rem', marginBottom: '20px' }}>Join a Quiz</h2>
            <form onSubmit={handleJoin} className="join-form">
              <div className="form-group">
                <label htmlFor="name">Your name</label>
                <input
                  id="name"
                  type="text"
                  placeholder="Enter your name"
                  value={playerName}
                  onChange={e => setPlayerName(e.target.value)}
                  maxLength={30}
                  autoComplete="off"
                />
              </div>
              <div className="form-group">
                <label htmlFor="code">Quiz code</label>
                <input
                  id="code"
                  type="text"
                  placeholder="Enter code from your admin"
                  value={quizCode}
                  onChange={e => setQuizCode(e.target.value.toUpperCase())}
                  maxLength={8}
                  autoComplete="off"
                  style={{ fontFamily: 'monospace', letterSpacing: '0.1em', fontSize: '1.1rem' }}
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary w-full btn-lg"
                disabled={loading}
              >
                {loading ? <><span className="spinner"></span> Joining...</> : 'Join Quiz'}
              </button>
            </form>
          </div>
        </div>

        <div className="active-quizzes container">
          <h2 className="section-title">Active Quizzes</h2>
          {loadingQuizzes ? (
            <div className="flex justify-center" style={{ padding: '40px' }}>
              <span className="spinner spinner-lg"></span>
            </div>
          ) : activeQuizzes.length === 0 ? (
            <div className="empty-state">
              <h3>No active quizzes</h3>
              <p>Ask your admin to start a quiz session.</p>
            </div>
          ) : (
            <div className="quizzes-grid">
              {activeQuizzes.map(quiz => (
                <div key={quiz.id} className="quiz-tile card card-sm">
                  <div className="quiz-tile-header">
                    <div>
                      <h3 className="quiz-tile-title">{quiz.title}</h3>
                      <p className="text-sm text-muted mt-1">
                        {quiz.question_count} question{quiz.question_count !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <span className={`badge ${quiz.status === 'live' ? 'badge-green' : 'badge-blue'}`}>
                      {quiz.status === 'live' ? 'Live' : 'Waiting'}
                    </span>
                  </div>
                  <p className="text-sm text-muted">Enter the quiz code to join</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {showAdminLogin && <AdminLoginModal onClose={() => setShowAdminLogin(false)} />}
    </div>
  )
}
