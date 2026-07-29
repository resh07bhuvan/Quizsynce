import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import './QuizLobby.css'

export default function QuizLobby() {
  const { quizId } = useParams()
  const navigate = useNavigate()

  const [quiz, setQuiz] = useState(null)
  const [players, setPlayers] = useState([])
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [playerName, setPlayerName] = useState(() => sessionStorage.getItem('player_name') || '')
  const [error, setError] = useState('')

  useEffect(() => {
    fetchQuiz()
    fetchPlayers()

    const channel = supabase
      .channel(`lobby_${quizId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'quizzes',
        filter: `id=eq.${quizId}`
      }, ({ new: updated }) => {
        setQuiz(updated)
        if (updated.status === 'live') {
          navigate(`/quiz/${quizId}/play`)
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'sessions',
        filter: `quiz_id=eq.${quizId}`
      }, () => {
        fetchPlayers()
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [quizId])

  useEffect(() => {
    if (quiz?.status === 'live' && session) {
      navigate(`/quiz/${quizId}/play`)
    }
  }, [quiz?.status, session])

  async function fetchQuiz() {
    const { data } = await supabase
      .from('quizzes')
      .select('*')
      .eq('id', quizId)
      .single()

    if (!data || !data.is_active) {
      navigate('/')
      return
    }
    setQuiz(data)
    setLoading(false)
  }

  async function fetchPlayers() {
    const { data } = await supabase
      .from('sessions')
      .select('id, player_name, created_at')
      .eq('quiz_id', quizId)
      .order('created_at')

    if (data) setPlayers(data)
  }

  async function handleJoin(e) {
    e.preventDefault()
    if (!playerName.trim()) { setError('Enter your name.'); return }

    setJoining(true)
    setError('')

    const name = playerName.trim()
    sessionStorage.setItem('player_name', name)

    const { data: existing } = await supabase
      .from('sessions')
      .select('*')
      .eq('quiz_id', quizId)
      .eq('player_name', name)
      .maybeSingle()

    if (existing) {
      setSession(existing)
      sessionStorage.setItem(`session_${quizId}`, existing.id)
      if (quiz?.status === 'live') {
        navigate(`/quiz/${quizId}/play`)
      }
      setJoining(false)
      return
    }

    const { data: sess, error: sessErr } = await supabase
      .from('sessions')
      .insert({
        quiz_id: quizId,
        player_name: name,
        score: 0,
        answers_count: 0,
        answers: {}
      })
      .select()
      .single()

    if (sessErr) {
      setError('Could not join. Try again.')
      setJoining(false)
      return
    }

    setSession(sess)
    sessionStorage.setItem(`session_${quizId}`, sess.id)

    if (quiz?.status === 'live') {
      navigate(`/quiz/${quizId}/play`)
    }
    setJoining(false)
  }

  if (loading) {
    return (
      <div className="lobby-page flex items-center justify-center" style={{ minHeight: '100vh' }}>
        <span className="spinner spinner-lg"></span>
      </div>
    )
  }

  return (
    <div className="lobby-page">
      <header className="lobby-header">
        <a href="/" className="logo">
          <span className="logo-mark">Q</span>
          <span className="logo-text">QuizSynce</span>
        </a>
        <code className="quiz-code">{quiz?.code}</code>
      </header>

      <main className="lobby-main container-sm">
        <div className="lobby-title-section">
          <h1 className="lobby-quiz-title">{quiz?.title}</h1>
          <div className="flex items-center gap-3">
            <span className={`badge ${quiz?.status === 'live' ? 'badge-green' : 'badge-blue'}`}>
              {quiz?.status === 'live' ? 'Live now' : quiz?.status === 'waiting' ? 'Waiting to start' : quiz?.status}
            </span>
            <span className="text-sm text-muted">{quiz?.question_count} questions</span>
          </div>
        </div>

        {!session ? (
          <div className="card">
            <h2 style={{ fontSize: '1rem', marginBottom: '16px' }}>Enter to join</h2>
            <form onSubmit={handleJoin}>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label>Your name</label>
                <input
                  type="text"
                  placeholder="How should we call you?"
                  value={playerName}
                  onChange={e => { setPlayerName(e.target.value); setError('') }}
                  maxLength={30}
                  autoFocus
                />
                {error && <p style={{ color: 'var(--error)', fontSize: '0.8125rem', marginTop: '4px' }}>{error}</p>}
              </div>
              <button type="submit" className="btn btn-primary w-full" disabled={joining}>
                {joining ? <><span className="spinner"></span> Joining...</> : 'Join Quiz'}
              </button>
            </form>
          </div>
        ) : (
          <div className="card joined-card">
            <div className="joined-status">
              <div className="joined-check">✓</div>
              <div>
                <p style={{ fontWeight: '600' }}>You're in, {session.player_name}!</p>
                <p className="text-sm text-muted mt-1">
                  {quiz?.status === 'live'
                    ? 'Quiz is live! Starting...'
                    : 'Waiting for the admin to start the quiz.'}
                </p>
              </div>
            </div>
            {quiz?.status === 'waiting' && (
              <div className="waiting-pulse">
                <span className="dot dot-blue pulse"></span>
                <span className="text-sm text-muted">Waiting for admin to start</span>
              </div>
            )}
          </div>
        )}

        <div className="players-section">
          <div className="flex items-center justify-between mb-3">
            <h2 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Players joined
            </h2>
            <span className="badge badge-blue">{players.length}</span>
          </div>
          {players.length === 0 ? (
            <p className="text-sm text-muted">No one has joined yet.</p>
          ) : (
            <div className="players-grid">
              {players.map(p => (
                <div key={p.id} className={`player-chip ${p.player_name === session?.player_name ? 'you' : ''}`}>
                  <span className="dot dot-green"></span>
                  {p.player_name}
                  {p.player_name === session?.player_name && <span style={{ fontSize: '0.6875rem', opacity: 0.6 }}> (you)</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
