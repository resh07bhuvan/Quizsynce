import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import './QuizResults.css'

export default function QuizResults() {
  const { quizId } = useParams()
  const navigate = useNavigate()
  const [quiz, setQuiz] = useState(null)
  const [sessions, setSessions] = useState([])
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const playerName = sessionStorage.getItem('player_name')
  const sessionId = sessionStorage.getItem(`session_${quizId}`)

  useEffect(() => {
    fetchResults()

    const channel = supabase
      .channel(`results_${quizId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions', filter: `quiz_id=eq.${quizId}` }, () => {
        fetchSessions()
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [quizId])

  async function fetchResults() {
    const [{ data: quizData }, { data: sessData }, { data: qData }] = await Promise.all([
      supabase.from('quizzes').select('*').eq('id', quizId).single(),
      supabase.from('sessions').select('*').eq('quiz_id', quizId).order('score', { ascending: false }),
      supabase.from('questions').select('*').eq('quiz_id', quizId).order('order_index')
    ])

    setQuiz(quizData)
    setSessions(sessData || [])
    setQuestions(qData || [])
    setLoading(false)
  }

  async function fetchSessions() {
    const { data } = await supabase
      .from('sessions')
      .select('*')
      .eq('quiz_id', quizId)
      .order('score', { ascending: false })
    if (data) setSessions(data)
  }

  const mySession = sessions.find(s => s.id === sessionId || s.player_name === playerName)
  const myRank = sessions.findIndex(s => s.id === sessionId || s.player_name === playerName) + 1
  const completedCount = sessions.filter(s => s.completed_at).length

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="spinner spinner-lg"></span>
      </div>
    )
  }

  return (
    <div className="results-page">
      <header className="results-header">
        <div className="container flex items-center justify-between">
          <div className="logo">
            <span className="logo-mark">Q</span>
            <span className="logo-text">QuizSynce</span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>
            Back to Home
          </button>
        </div>
      </header>

      <main className="results-main container">
        <div className="results-title-section">
          <h1>{quiz?.title}</h1>
          <p className="text-muted mt-1">
            {sessions.length} player{sessions.length !== 1 ? 's' : ''} · {completedCount} finished · {quiz?.question_count} questions
          </p>
        </div>

        <div className="results-layout">
          <div className="leaderboard-section">
            <h2 className="section-heading">Leaderboard</h2>

            {sessions.length >= 3 && (
              <div className="podium">
                <div className="podium-slot second">
                  <div className="podium-avatar">{sessions[1]?.player_name?.[0]?.toUpperCase()}</div>
                  <p className="podium-name">{sessions[1]?.player_name}</p>
                  <p className="podium-score">{sessions[1]?.score}</p>
                  <div className="podium-bar p2">2</div>
                </div>
                <div className="podium-slot first">
                  <div className="podium-crown">👑</div>
                  <div className="podium-avatar gold">{sessions[0]?.player_name?.[0]?.toUpperCase()}</div>
                  <p className="podium-name">{sessions[0]?.player_name}</p>
                  <p className="podium-score">{sessions[0]?.score}</p>
                  <div className="podium-bar p1">1</div>
                </div>
                <div className="podium-slot third">
                  <div className="podium-avatar">{sessions[2]?.player_name?.[0]?.toUpperCase()}</div>
                  <p className="podium-name">{sessions[2]?.player_name}</p>
                  <p className="podium-score">{sessions[2]?.score}</p>
                  <div className="podium-bar p3">3</div>
                </div>
              </div>
            )}

            <div className="full-leaderboard">
              {sessions.map((s, i) => (
                <div key={s.id} className={`lb-entry ${s.player_name === playerName ? 'mine' : ''}`}>
                  <span className={`lb-rank-num ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}`}>
                    {i + 1}
                  </span>
                  <span className="lb-avatar">{s.player_name?.[0]?.toUpperCase()}</span>
                  <div className="lb-info">
                    <span className="lb-pname">
                      {s.player_name}
                      {s.player_name === playerName && <span className="you-tag">you</span>}
                    </span>
                    <span className="lb-progress">
                      {s.answers_count}/{quiz?.question_count} answered
                      {s.completed_at && ' · finished'}
                    </span>
                  </div>
                  <span className="lb-pts">{s.score} pts</span>
                </div>
              ))}
            </div>
          </div>

          {mySession && (
            <div className="my-results-section">
              <h2 className="section-heading">Your Performance</h2>
              <div className="my-score-card card">
                <div className="my-rank-badge">#{myRank}</div>
                <div className="my-score-number">{mySession.score}</div>
                <p className="text-muted text-sm">points</p>
                <div className="my-stats">
                  <div className="my-stat">
                    <strong>
                      {questions.filter((_, i) => mySession.answers?.[i] === questions[i]?.correct).length}
                    </strong>
                    <span>Correct</span>
                  </div>
                  <div className="my-stat">
                    <strong>
                      {questions.filter((_, i) => mySession.answers?.[i] !== undefined && mySession.answers?.[i] !== questions[i]?.correct).length}
                    </strong>
                    <span>Wrong</span>
                  </div>
                  <div className="my-stat">
                    <strong>
                      {questions.filter((_, i) => mySession.answers?.[i] === undefined).length}
                    </strong>
                    <span>Skipped</span>
                  </div>
                </div>
              </div>

              {questions.length > 0 && (
                <div className="answer-review">
                  <h3 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '10px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Answer Review
                  </h3>
                  {questions.map((q, i) => {
                    const myAnswer = mySession.answers?.[i]
                    const isCorrect = myAnswer === q.correct
                    const isUnanswered = myAnswer === undefined

                    return (
                      <div key={q.id} className="review-item">
                        <div className={`review-indicator ${isUnanswered ? 'skip' : isCorrect ? 'ok' : 'fail'}`}>
                          {isUnanswered ? '—' : isCorrect ? '✓' : '✕'}
                        </div>
                        <div className="review-content">
                          <p className="review-q">{q.question}</p>
                          {!isUnanswered && (
                            <p className="review-answer">
                              Your answer: <span className={isCorrect ? 'text-correct' : 'text-wrong'}>
                                {q.options[myAnswer]}
                              </span>
                              {!isCorrect && (
                                <> · Correct: <span className="text-correct">{q.options[q.correct]}</span></>
                              )}
                            </p>
                          )}
                          {q.explanation && isCorrect === false && (
                            <p className="review-explain">{q.explanation}</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
