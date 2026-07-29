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
            >Ended</button>
          </div>
        </div>
        <div className="control-group">
          <span className="text-sm text-muted">Visibility</span>
          <button
            className={`btn btn-sm ${quiz.is_active ? 'btn-secondary' : 'btn-primary'}`}
            onClick={onToggleActive}
          >
            {quiz.is_active ? 'Deactivate' : 'Activate'}
          </button>
        </div>
      </div>

      <div className="detail-tabs">
        <button className={`tab-btn ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>
          Players ({sessions.length})
        </button>
        <button className={`tab-btn ${tab === 'questions' ? 'active' : ''}`} onClick={() => setTab('questions')}>
          Questions ({questions.length})
        </button>
      </div>

      <div className="detail-body">
        {tab === 'overview' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted">{sessions.length} player{sessions.length !== 1 ? 's' : ''} joined</p>
              {sessions.length > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={resetSessions}>
                  Clear sessions
                </button>
              )}
            </div>
            {loadingSessions ? (
              <div className="flex justify-center" style={{ padding: '24px' }}>
                <span className="spinner"></span>
              </div>
            ) : sessions.length === 0 ? (
              <div className="empty-state" style={{ padding: '32px 0' }}>
                <p>No players yet. Share the code to get started.</p>
              </div>
            ) : (
              <div className="leaderboard">
                {sessions.map((s, i) => (
                  <div key={s.id} className="leaderboard-row">
                    <span className="rank">#{i + 1}</span>
                    <div className="player-info">
                      <span className="player-name">{s.player_name}</span>
                      <span className="player-meta">
                        {s.answers_count}/{quiz.question_count} answered
                        {s.completed_at && ' · done'}
                      </span>
                    </div>
                    <span className="player-score">{s.score ?? 0} pts</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'questions' && (
          <div className="questions-list">
            {questions.length === 0 ? (
              <div className="empty-state" style={{ padding: '32px 0' }}>
                <p>No questions loaded.</p>
              </div>
            ) : questions.map((q, i) => (
              <div key={q.id} className="question-preview">
                <div className="q-number">{i + 1}</div>
                <div className="q-content">
                  <p className="q-text">{q.question}</p>
                  <div className="q-options">
                    {q.options.map((opt, j) => (
                      <span key={j} className={`q-opt ${j === q.correct ? 'correct' : ''}`}>
                        {opt}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="detail-footer">
        <button className="btn btn-danger btn-sm" onClick={onDelete}>
          Delete Quiz
        </button>
      </div>
    </div>
  )
}
