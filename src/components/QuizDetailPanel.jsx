import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import './QuizDetailPanel.css'

export default function QuizDetailPanel({ quiz, onClose, onToggleActive, onDelete, onUpdateStatus, onRefresh }) {
  const [sessions, setSessions] = useState([])
  const [questions, setQuestions] = useState([])
  const [tab, setTab] = useState('overview')
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [editingQ, setEditingQ] = useState(null)
  const [newQuestion, setNewQuestion] = useState({ question: '', options: ['', '', '', ''], correct: 0, explanation: '' })
  const [showAddForm, setShowAddForm] = useState(false)
  const [timer, setTimer] = useState(quiz.timer || 12)
  const [savingTimer, setSavingTimer] = useState(false)

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

  async function deleteQuestion(qId) {
    if (!window.confirm('Delete this question?')) return
    await supabase.from('questions').delete().eq('id', qId)
    fetchQuestions()
    await supabase.from('quizzes').update({ question_count: questions.length - 1 }).eq('id', quiz.id)
  }

  async function saveEditQuestion() {
    if (!editingQ.question.trim()) return
    await supabase.from('questions').update({
      question: editingQ.question,
      options: editingQ.options,
      correct: editingQ.correct,
      explanation: editingQ.explanation
    }).eq('id', editingQ.id)
    setEditingQ(null)
    fetchQuestions()
  }

  async function addQuestion() {
    if (!newQuestion.question.trim() || newQuestion.options.some(o => !o.trim())) {
      alert('Fill in the question and all 4 options.')
      return
    }
    await supabase.from('questions').insert({
      quiz_id: quiz.id,
      question: newQuestion.question,
      options: newQuestion.options,
      correct: newQuestion.correct,
      explanation: newQuestion.explanation,
      order_index: questions.length
    })
    await supabase.from('quizzes').update({ question_count: questions.length + 1 }).eq('id', quiz.id)
    setNewQuestion({ question: '', options: ['', '', '', ''], correct: 0, explanation: '' })
    setShowAddForm(false)
    fetchQuestions()
  }

  async function saveTimer() {
    setSavingTimer(true)
    await supabase.from('quizzes').update({ timer }).eq('id', quiz.id)
    setSavingTimer(false)
  }

  const shareUrl = `${window.location.origin}/quiz/${quiz.id}`
  function copyCode() { navigator.clipboard.writeText(quiz.code) }
  function copyLink() { navigator.clipboard.writeText(shareUrl) }

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
        <button className="btn btn-secondary btn-sm" onClick={copyLink}>Copy Link</button>
      </div>

      <div className="detail-controls">
        <div className="control-group">
          <span className="text-sm text-muted">Status</span>
          <div className="flex gap-2">
            <button className={`btn btn-sm ${quiz.status === 'waiting' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => onUpdateStatus('waiting')}>Waiting</button>
            <button className={`btn btn-sm ${quiz.status === 'live' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => onUpdateStatus('live')}>Live</button>
            <button className={`btn btn-sm ${quiz.status === 'ended' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => onUpdateStatus('ended')}>Ended</button>
          </div>
        </div>
        <div className="control-group">
          <span className="text-sm text-muted">Visibility</span>
          <button className={`btn btn-sm ${quiz.is_active ? 'btn-secondary' : 'btn-primary'}`} onClick={onToggleActive}>
            {quiz.is_active ? 'Deactivate' : 'Activate'}
          </button>
        </div>
        <div className="control-group">
          <span className="text-sm text-muted">Timer (seconds)</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="5"
              max="120"
              value={timer}
              onChange={e => setTimer(Number(e.target.value))}
              style={{ width: '70px', padding: '4px 8px', fontSize: '0.875rem' }}
            />
            <button className="btn btn-secondary btn-sm" onClick={saveTimer} disabled={savingTimer}>
              {savingTimer ? 'Saving...' : 'Save'}
            </button>
          </div>
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
                <button className="btn btn-ghost btn-sm" onClick={resetSessions}>Clear sessions</button>
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
                      <span className="player-meta">{s.answers_count}/{quiz.question_count} answered{s.completed_at && ' · done'}</span>
                    </div>
                    <span className="player-score">{s.score ?? 0} pts</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'questions' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted">{questions.length} questions</p>
              <button className="btn btn-primary btn-sm" onClick={() => setShowAddForm(!showAddForm)}>
                {showAddForm ? 'Cancel' : '+ Add Question'}
              </button>
            </div>

            {showAddForm && (
              <div className="edit-question-form">
                <div className="form-group">
                  <label>Question</label>
                  <textarea
                    value={newQuestion.question}
                    onChange={e => setNewQuestion({ ...newQuestion, question: e.target.value })}
                    placeholder="Enter question"
                    rows={2}
                  />
                </div>
                {newQuestion.options.map((opt, i) => (
                  <div key={i} className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="radio"
                        name="new-correct"
                        checked={newQuestion.correct === i}
                        onChange={() => setNewQuestion({ ...newQuestion, correct: i })}
                        style={{ width: 'auto' }}
                      />
                      Option {String.fromCharCode(65 + i)} {newQuestion.correct === i && '✓ correct'}
                    </label>
                    <input
                      type="text"
                      value={opt}
                      onChange={e => {
                        const opts = [...newQuestion.options]
                        opts[i] = e.target.value
                        setNewQuestion({ ...newQuestion, options: opts })
                      }}
                      placeholder={`Option ${String.fromCharCode(65 + i)}`}
                    />
                  </div>
                ))}
                <div className="form-group">
                  <label>Explanation (optional)</label>
                  <input
                    type="text"
                    value={newQuestion.explanation}
                    onChange={e => setNewQuestion({ ...newQuestion, explanation: e.target.value })}
                    placeholder="Why is this the correct answer?"
                  />
                </div>
                <button className="btn btn-primary btn-sm w-full" onClick={addQuestion}>Add Question</button>
              </div>
            )}

            <div className="questions-list">
              {questions.length === 0 ? (
                <div className="empty-state" style={{ padding: '32px 0' }}>
                  <p>No questions loaded.</p>
                </div>
              ) : questions.map((q, i) => (
                <div key={q.id} className="question-preview">
                  {editingQ?.id === q.id ? (
                    <div style={{ flex: 1 }}>
                      <div className="form-group mb-2">
                        <textarea
                          value={editingQ.question}
                          onChange={e => setEditingQ({ ...editingQ, question: e.target.value })}
                          rows={2}
                          style={{ fontSize: '0.8125rem' }}
                        />
                      </div>
                      {editingQ.options.map((opt, j) => (
                        <div key={j} className="flex items-center gap-2 mb-2">
                          <input
                            type="radio"
                            name={`edit-correct-${q.id}`}
                            checked={editingQ.correct === j}
                            onChange={() => setEditingQ({ ...editingQ, correct: j })}
                            style={{ width: 'auto', flexShrink: 0 }}
                          />
                          <input
                            type="text"
                            value={opt}
                            onChange={e => {
                              const opts = [...editingQ.options]
                              opts[j] = e.target.value
                              setEditingQ({ ...editingQ, options: opts })
                            }}
                            style={{ fontSize: '0.8125rem' }}
                          />
                        </div>
                      ))}
                      <div className="flex gap-2 mt-2">
                        <button className="btn btn-primary btn-sm" onClick={saveEditQuestion}>Save</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditingQ(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="q-number">{i + 1}</div>
                      <div className="q-content">
                        <p className="q-text">{q.question}</p>
                        <div className="q-options">
                          {q.options.map((opt, j) => (
                            <span key={j} className={`q-opt ${j === q.correct ? 'correct' : ''}`}>{opt}</span>
                          ))}
                        </div>
                      </div>
                      <div className="q-actions">
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditingQ({ ...q })}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => deleteQuestion(q.id)}>Del</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="detail-footer">
        <button className="btn btn-danger btn-sm" onClick={onDelete}>Delete Quiz</button>
      </div>
    </div>
  )
}
