import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useAdmin } from '../lib/adminAuth.jsx'
import { useToast } from '../lib/toast.jsx'
import CreateFromExcelModal from '../components/CreateFromExcelModal.jsx'
import CreateFromTopicModal from '../components/CreateFromTopicModal.jsx'
import QuizDetailPanel from '../components/QuizDetailPanel.jsx'
import './AdminDashboard.css'

export default function AdminDashboard() {
  const { isAdmin, logout } = useAdmin()
  const navigate = useNavigate()
  const toast = useToast()

  const [quizzes, setQuizzes] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedQuiz, setSelectedQuiz] = useState(null)
  const [showExcelModal, setShowExcelModal] = useState(false)
  const [showTopicModal, setShowTopicModal] = useState(false)
  const [stats, setStats] = useState({ total: 0, active: 0, players: 0 })

  useEffect(() => {
    if (!isAdmin) { navigate('/'); return }
    fetchQuizzes()
    fetchStats()

    const channel = supabase
      .channel('admin_quizzes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quizzes' }, () => {
        fetchQuizzes()
        fetchStats()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => {
        fetchStats()
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [isAdmin])

  const fetchQuizzes = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('quizzes')
        .select('*')
        .order('created_at', { ascending: false })

      if (!error && data) setQuizzes(data)
    } catch {}
    setLoading(false)
  }, [])

  const fetchStats = useCallback(async () => {
    try {
      const [{ count: total }, { count: active }, { count: players }] = await Promise.all([
        supabase.from('quizzes').select('*', { count: 'exact', head: true }),
        supabase.from('quizzes').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('sessions').select('*', { count: 'exact', head: true })
      ])
      setStats({ total: total || 0, active: active || 0, players: players || 0 })
    } catch {}
  }, [])

  async function toggleActive(quiz) {
    const { error } = await supabase
      .from('quizzes')
      .update({ is_active: !quiz.is_active })
      .eq('id', quiz.id)

    if (!error) {
      toast(quiz.is_active ? 'Quiz deactivated.' : 'Quiz activated — players can now join!', 'success')
      fetchQuizzes()
      if (selectedQuiz?.id === quiz.id) {
        setSelectedQuiz(prev => ({ ...prev, is_active: !prev.is_active }))
      }
    } else {
      toast('Failed to update quiz.', 'error')
    }
  }

  async function deleteQuiz(quiz) {
    if (!window.confirm(`Delete "${quiz.title}"? This cannot be undone.`)) return

    const { error } = await supabase.from('quizzes').delete().eq('id', quiz.id)
    if (!error) {
      toast('Quiz deleted.', 'success')
      if (selectedQuiz?.id === quiz.id) setSelectedQuiz(null)
      fetchQuizzes()
    } else {
      toast('Failed to delete quiz.', 'error')
    }
  }

  async function updateStatus(quiz, status) {
    const { error } = await supabase
      .from('quizzes')
      .update({ status })
      .eq('id', quiz.id)
    if (!error) {
      toast(`Quiz set to ${status}.`, 'success')
      fetchQuizzes()
      if (selectedQuiz?.id === quiz.id) setSelectedQuiz(prev => ({ ...prev, status }))
    }
  }

  function handleCreated(quiz) {
    fetchQuizzes()
    fetchStats()
    setShowExcelModal(false)
    setShowTopicModal(false)
    toast(`"${quiz.title}" created!`, 'success')
    setSelectedQuiz(quiz)
  }

  function handleLogout() {
    logout()
    navigate('/')
  }

  return (
    <div className="admin-page">
      <aside className="admin-sidebar">
        <div className="sidebar-top">
          <div className="logo">
            <span className="logo-mark">Q</span>
            <span className="logo-text">QuizSynce</span>
          </div>
          <span className="badge badge-blue" style={{ marginTop: '4px' }}>Admin</span>
        </div>

        <nav className="sidebar-nav">
          <p className="nav-label">Create Quiz</p>
          <button className="nav-btn" onClick={() => setShowExcelModal(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
            From Excel
          </button>
          <button className="nav-btn" onClick={() => setShowTopicModal(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <circle cx="12" cy="12" r="10"/>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            From Topic
          </button>
        </nav>

        <div className="sidebar-stats">
          <p className="nav-label">Overview</p>
          <div className="stat-row">
            <span>Total quizzes</span>
            <strong>{stats.total}</strong>
          </div>
          <div className="stat-row">
            <span>Active</span>
            <strong style={{ color: 'var(--success)' }}>{stats.active}</strong>
          </div>
          <div className="stat-row">
            <span>Total players</span>
            <strong>{stats.players}</strong>
          </div>
        </div>

        <div className="sidebar-bottom">
          <a href="/" className="nav-btn" target="_blank" rel="noreferrer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            Player View
          </a>
          <button className="nav-btn nav-btn-danger" onClick={handleLogout}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <div className="admin-toolbar">
          <div>
            <h1 style={{ fontSize: '1.375rem', marginBottom: '4px' }}>Quiz Dashboard</h1>
            <p className="text-sm text-muted">{quizzes.length} quiz{quizzes.length !== 1 ? 'zes' : ''} total</p>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-ghost btn-sm" onClick={() => setShowExcelModal(true)}>
              + From Excel
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowTopicModal(true)}>
              + From Topic
            </button>
          </div>
        </div>

        <div className="admin-content">
          <div className={`quiz-list-panel ${selectedQuiz ? 'has-selection' : ''}`}>
            {loading ? (
              <div className="flex justify-center" style={{ padding: '60px' }}>
                <span className="spinner spinner-lg"></span>
              </div>
            ) : quizzes.length === 0 ? (
              <div className="empty-state">
                <h3>No quizzes yet</h3>
                <p>Create your first quiz from an Excel file or a topic.</p>
                <div className="flex gap-3 justify-center mt-4">
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowExcelModal(true)}>
                    From Excel
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={() => setShowTopicModal(true)}>
                    From Topic
                  </button>
                </div>
              </div>
            ) : (
              <div className="quiz-list">
                {quizzes.map(quiz => (
                  <div
                    key={quiz.id}
                    className={`quiz-row ${selectedQuiz?.id === quiz.id ? 'selected' : ''}`}
                    onClick={() => setSelectedQuiz(quiz)}
                  >
                    <div className="quiz-row-main">
                      <div className="quiz-row-info">
                        <div className="flex items-center gap-2">
                          <h3 className="quiz-row-title">{quiz.title}</h3>
                          <span className={`badge ${
                            quiz.status === 'live' ? 'badge-green' :
                            quiz.status === 'ended' ? 'badge-red' : 'badge-blue'
                          }`}>
                            {quiz.status}
                          </span>
                          {!quiz.is_active && (
                            <span className="badge" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
                              inactive
                            </span>
                          )}
                        </div>
                        <p className="quiz-row-meta">
                          {quiz.question_count} questions
                          {quiz.source_type && ` · ${quiz.source_type === 'excel' ? 'Excel' : 'Topic'}`}
                          {quiz.source_label && ` · ${quiz.source_label}`}
                        </p>
                      </div>
                      <code className="quiz-code">{quiz.code}</code>
                    </div>
                    <div className="quiz-row-actions" onClick={e => e.stopPropagation()}>
                      <button
                        className={`btn btn-sm ${quiz.is_active ? 'btn-secondary' : 'btn-primary'}`}
                        onClick={() => toggleActive(quiz)}
                      >
                        {quiz.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => deleteQuiz(quiz)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedQuiz && (
            <QuizDetailPanel
              quiz={selectedQuiz}
              onClose={() => setSelectedQuiz(null)}
              onToggleActive={() => toggleActive(selectedQuiz)}
              onDelete={() => deleteQuiz(selectedQuiz)}
              onUpdateStatus={(s) => updateStatus(selectedQuiz, s)}
              onRefresh={fetchQuizzes}
            />
          )}
        </div>
      </main>

      {showExcelModal && (
        <CreateFromExcelModal
          onClose={() => setShowExcelModal(false)}
          onCreated={handleCreated}
        />
      )}
      {showTopicModal && (
        <CreateFromTopicModal
          onClose={() => setShowTopicModal(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  )
}
