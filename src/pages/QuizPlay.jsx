import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import './QuizPlay.css'

export default function QuizPlay() {
  const { quizId } = useParams()
  const navigate = useNavigate()

  const [quiz, setQuiz] = useState(null)
  const [questions, setQuestions] = useState([])
  const [session, setSession] = useState(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selected, setSelected] = useState(null)
  const [revealed, setRevealed] = useState(false)
  const [score, setScore] = useState(0)
  const [answers, setAnswers] = useState({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [finished, setFinished] = useState(false)
  const [livePlayers, setLivePlayers] = useState([])

  const playerName = sessionStorage.getItem('player_name')
  const sessionId = sessionStorage.getItem(`session_${quizId}`)

  useEffect(() => {
    if (!playerName || !sessionId) {
      navigate(`/quiz/${quizId}`)
      return
    }
    init()
  }, [])

  const init = useCallback(async () => {
    const [{ data: quizData }, { data: qData }, { data: sessData }] = await Promise.all([
      supabase.from('quizzes').select('*').eq('id', quizId).single(),
      supabase.from('questions').select('*').eq('quiz_id', quizId).order('order_index'),
      supabase.from('sessions').select('*').eq('id', sessionId).single()
    ])

    if (!quizData || quizData.status === 'ended') {
      navigate(`/quiz/${quizId}/results`)
      return
    }

    setQuiz(quizData)
    setQuestions(qData || [])
    setSession(sessData)

    if (sessData?.answers) {
      const savedAnswers = sessData.answers
      setAnswers(savedAnswers)
      setScore(sessData.score || 0)
      const answeredCount = Object.keys(savedAnswers).length
      if (answeredCount >= (qData?.length || 0)) {
        setFinished(true)
      } else {
        setCurrentIndex(answeredCount)
      }
    }

    fetchLivePlayers()
    setLoading(false)

    supabase
      .channel(`play_${quizId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'quizzes',
        filter: `id=eq.${quizId}`
      }, ({ new: updated }) => {
        if (updated.status === 'ended') {
          navigate(`/quiz/${quizId}/results`)
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'sessions',
        filter: `quiz_id=eq.${quizId}`
      }, () => {
        fetchLivePlayers()
      })
      .subscribe()
  }, [quizId, sessionId])

  async function fetchLivePlayers() {
    const { data } = await supabase
      .from('sessions')
      .select('player_name, score, answers_count')
      .eq('quiz_id', quizId)
      .order('score', { ascending: false })
      .limit(10)
    if (data) setLivePlayers(data)
  }

  async function handleAnswer(optionIndex) {
    if (revealed || submitting) return
    setSelected(optionIndex)
    setRevealed(true)
    setSubmitting(true)

    const q = questions[currentIndex]
    const isCorrect = optionIndex === q.correct
    const newScore = score + (isCorrect ? 10 : 0)
    const newAnswers = { ...answers, [currentIndex]: optionIndex }

    setScore(newScore)
    setAnswers(newAnswers)

    await supabase
      .from('sessions')
      .update({
        score: newScore,
        answers: newAnswers,
        answers_count: Object.keys(newAnswers).length
      })
      .eq('id', sessionId)

    setSubmitting(false)
  }

  function handleNext() {
    if (currentIndex + 1 >= questions.length) {
      supabase
        .from('sessions')
        .update({ completed_at: new Date().toISOString() })
        .eq('id', sessionId)
        .then()
      setFinished(true)
    } else {
      setCurrentIndex(prev => prev + 1)
      setSelected(null)
      setRevealed(false)
    }
  }

  if (loading) {
    return (
      <div className="play-page flex justify-center items-center" style={{ minHeight: '100vh' }}>
        <span className="spinner spinner-lg"></span>
      </div>
    )
  }

  if (finished) {
    return (
      <div className="play-page">
        <div className="play-header">
          <div className="logo">
            <span className="logo-mark">Q</span>
            <span className="logo-text">QuizSynce</span>
          </div>
        </div>
        <div className="finish-screen container-sm">
          <div className="finish-card card text-center">
            <div className="finish-emoji">🎉</div>
            <h1 style={{ marginBottom: '8px' }}>Quiz Complete!</h1>
            <p className="text-muted" style={{ marginBottom: '24px' }}>Nice work, {playerName}</p>
            <div className="final-score">
              <span className="final-score-number">{score}</span>
              <span className="final-score-label">points</span>
            </div>
            <p className="text-sm text-muted" style={{ marginTop: '8px' }}>
              {Object.values(answers).filter((a, i) => questions[i] && a === questions[i].correct).length} of {questions.length} correct
            </p>
            <div className="divider" style={{ margin: '24px 0' }}></div>
            <p className="text-sm text-muted">Waiting for others to finish...</p>
            <button
              className="btn btn-primary mt-4"
              onClick={() => navigate(`/quiz/${quizId}/results`)}
            >
              View Results
            </button>
          </div>

          {livePlayers.length > 0 && (
            <div className="live-board card mt-4">
              <h3 style={{ fontSize: '0.875rem', marginBottom: '12px', color: 'var(--text-secondary)' }}>
                Live Scores
              </h3>
              {livePlayers.map((p, i) => (
                <div key={p.player_name} className={`lb-row ${p.player_name === playerName ? 'is-you' : ''}`}>
                  <span className="lb-rank">#{i + 1}</span>
                  <span className="lb-name">{p.player_name}{p.player_name === playerName ? ' (you)' : ''}</span>
                  <span className="lb-score">{p.score} pts</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  const q = questions[currentIndex]
  if (!q) return null

  const progress = ((currentIndex) / questions.length) * 100

  return (
    <div className="play-page">
      <div className="play-header">
        <div className="logo">
          <span className="logo-mark">Q</span>
          <span className="logo-text">QuizSynce</span>
        </div>
        <div className="play-player-info">
          <span className="text-sm text-muted">{playerName}</span>
          <span className="score-pill">{score} pts</span>
        </div>
      </div>

      <div className="progress-bar" style={{ borderRadius: 0 }}>
        <div className="progress-fill" style={{ width: `${progress}%` }}></div>
      </div>

      <main className="play-main container-sm">
        <div className="q-counter">
          <span>{currentIndex + 1} / {questions.length}</span>
        </div>

        <div className="question-card card">
          <h2 className="question-text">{q.question}</h2>
        </div>

        <div className="options-grid">
          {q.options.map((opt, i) => {
            let cls = 'option-btn'
            if (revealed) {
              if (i === q.correct) cls += ' correct'
              else if (i === selected && selected !== q.correct) cls += ' wrong'
              else cls += ' dim'
            } else if (selected === i) {
              cls += ' selected'
            }

            return (
              <button
                key={i}
                className={cls}
                onClick={() => handleAnswer(i)}
                disabled={revealed}
              >
                <span className="option-letter">{String.fromCharCode(65 + i)}</span>
                <span className="option-text">{opt}</span>
                {revealed && i === q.correct && (
                  <span className="option-check">✓</span>
                )}
                {revealed && i === selected && selected !== q.correct && (
                  <span className="option-check">✕</span>
                )}
              </button>
            )
          })}
        </div>

        {revealed && (
          <div className="reveal-panel">
            <div className={`result-badge ${selected === q.correct ? 'result-correct' : 'result-wrong'}`}>
              {selected === q.correct ? '+10 points!' : 'Not quite'}
            </div>
            {q.explanation && (
              <p className="explanation-text">{q.explanation}</p>
            )}
            <button className="btn btn-primary btn-lg w-full mt-3" onClick={handleNext}>
              {currentIndex + 1 >= questions.length ? 'See Final Score' : 'Next Question'}
            </button>
          </div>
        )}

        {livePlayers.length > 1 && (
          <div className="mini-board">
            <p className="mini-board-label">Live</p>
            <div className="mini-board-players">
              {livePlayers.slice(0, 5).map((p, i) => (
                <div key={p.player_name} className={`mini-player ${p.player_name === playerName ? 'you' : ''}`}>
                  <span className="mini-rank">#{i + 1}</span>
                  <span className="mini-name">{p.player_name}</span>
                  <span className="mini-score">{p.score}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
