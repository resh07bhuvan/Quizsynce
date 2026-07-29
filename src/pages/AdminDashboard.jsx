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
