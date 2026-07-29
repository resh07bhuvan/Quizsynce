import React, { useState, useEffect, useCallback, useRef } from 'react'
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
  const [timeLeft, setTimeLeft] = useState(null)
  const timerRef = useRef(null)

  const playerName = sessionStorage.getItem('player_name')
  const sessionId = sessionStorage.getItem(`session_${quizId}`)

  useEffect(() => {
    if (!playerName || !sessionId) {
      navigate(`/quiz/${quizId}`)
      return
    }
    init()
  }, [])

  // Timer effect
  useEffect(() => {
    if (loading || finished || revealed || timeLeft === null) return

    if (timeLeft <= 0) {
      handleTimeout()
      return
    }

    timerRef.current = setTimeout(() => {
      setTimeLeft(prev => prev - 1)
    }, 1000)

    return () => clearTimeout(timerRef.current)
  }, [timeLeft, loading, finished, revealed])

  function startTimer(seconds) {
    clearTimeout(timerRef.current)
    setTimeLeft(seconds)
  }

  async function handleTimeout() {
    if (revealed) return
    setRevealed(true)
    setSelected(null)

    const q = questions[currentIndex]
    const newAnswers = { ...answers, [currentIndex]: -1 }
    setAnswers(newAnswers)

    await supabase
      .from('sessions')
      .update({
        score,
        answers: newAnswers,
        answers_count: Object.keys(newAnswers).length
      })
      .eq('id', sessionId)
  }

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
        startTimer(quizData.timer || 12)
      }
    } else {
      startTimer(quizData.timer || 12)
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
    clearTimeout(timerRef.current)
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
      startTimer(quiz.timer || 12)
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
            <button className="btn btn-primary mt-4" onClick={() => navigate(`/quiz/${quizId}/results`)}>
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

  const progress = (currentIndex / questions.length) * 100
  const timerPercent = timeLeft !== null ? (timeLeft / (quiz.timer || 12)) * 100 : 100
  const timerColor = timeLeft <= 3 ? 'var(--error)' : timeLeft <= 6 ? 'var(--warning)' : 'var(--accent)'

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
        <div className="q-counter-row">
          <span className="q-counter">{currentIndex + 1} / {questions.length}</span>
          {timeLeft !== null && !revealed && (
            <div className="timer-wrap">
              <div className="timer-ring">
                <svg width="44" height="44" viewBox="0 0 44 44">
                  <circle cx="22" cy="22" r="18" fill="none" stroke="var(--bg-elevated)" strokeWidth="4"/>
                  <circle
                    cx="22" cy="22" r="18"
                    fill="none"
                    stroke={timerColor}
                    strokeWidth="4"
                    strokeDasharray={`${2 * Math.PI * 18}`}
                    strokeDashoffset={`${2 * Math.PI * 18 * (1 - timerPercent / 100)}`}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s ease', transform: 'rotate(-90deg)', transformOrigin: 'center' }}
                  />
                </svg>
                <span className="timer-number" style={{ color: timerColor }}>{timeLeft}</span>
              </div>
            </div>
          )}
        </div>

        <div className="question-card card">
