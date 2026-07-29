import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import './QuizDetailPanel.css'

export default function QuizDetailPanel({ quiz, onClose, onToggleActive, onDelete, onUpdateStatus, onRefresh }) {
  const [sessions, setSessions] = useState([])
  const [questions, setQuestions] = useState([])
  const [tab, setTab] = useState('overview')
  const [loadingSessions, setLoadingSessions] = useState(true)

  useEffect(() => {
    fetchSessions()
    fetchQuestions()

    const channel = supabase
      .channel(`quiz_detail_${quiz.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions', filter: `quiz_id=eq.${quiz.id}` }, () => {
        fetchSessions()
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [quiz.id])

  async function fetchSessions() {
    setLoadingSessions(true)
    const { data } = await supabase
      .from('sessions')
      .select('*')
      .eq('quiz_id', quiz.id)
      .order('score', { ascending: false })
    if (data) setSessions(data)
    setLoadingSessions(false)
  }

  async function fetchQuestions() {
    const { data } = await supabase
      .from('questions')
      .select('*')
      .eq('quiz_id', quiz.id)
      .order('order_index')
    if (data) setQuestions(data)
  }

  async function resetSessions() {
    if (!window.confirm('Clear all player sessions for this quiz?')) return
    await supabase.from('sessions').delete().eq('quiz_id', quiz.id)
    fetchSessions()
  }

  const shareUrl = `${window.location.origin}/quiz/${quiz.id}`

  function copyCode() {
    navigator.clipboard.writeText(quiz.code)
  }

  function copyLink() {
    navigator.clipboard.writeText(shareUrl)
  }

  return (
    <div className="detail-panel">
      <div className="detail-header">
        <div>
          <h2 className="detail-title">{quiz.title}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className={`badge ${quiz.status === 'live' ? 'badge-green' : quiz.status === 'ended' ? 'badge-red' : 'badge-blue'}`}>
              {quiz.status}
            </span>
            {!quiz.is_active && (
              <span className="badge" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
                inactive
              </span>
            )}
          </div>
        </div>
        <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
      </div>

      <div className="detail-share">
        <div className="share-code-box">
          <span className="share-label">Quiz Code</span>
          <div className="flex items-center gap-2">
            <code className="share-code">{quiz.code}</code>
            <button className="btn btn-ghost btn-sm" onClick={copyCode}>Copy</button>
          </div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={copyLink}>
          Copy Link
        </button>
      </div>

      <div className="detail-controls">
        <div className="control-group">
          <span className="text-sm text-muted">Status</span>
          <div className="flex gap-2">
            <button
              className={`btn btn-sm ${quiz.status === 'waiting' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => onUpdateStatus('waiting')}
            >Waiting</button>
            <button
              className={`btn btn-sm ${quiz.status === 'live' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => onUpdateStatus('live')}
            >Live</button>
            <button
              className={`btn btn-sm ${quiz.status === 'ended' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => onUpdateStatus('ended')}
