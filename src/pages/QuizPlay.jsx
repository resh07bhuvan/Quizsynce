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

  useEffect(() => {
    if (loading || finished || revealed || timeLeft === null) return
    if (timeLeft <= 0) { handleTimeout(); return }
    timerRef.current = setTimeout(() => setTimeLeft(prev => prev - 1), 1000)
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
    const newAnswers = { ...answers, [currentIndex]: -1 }
    setAnswers(newAnswers)
    await supabase.from('sessions').update({
      score, answers: newAnswers, answers_count: Object.keys(newAnswers).length
    }).eq('id', sessionId)
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

    supabase.channel(`play_${quizId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'quizzes', filter: `id=eq.${quizId}` },
        ({ new: updated }) => { if (updated.status === 'ended') navigate(`/quiz/${quizId}/results`) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions', filter: `quiz_id=eq.${quizId}` },
        () => fetchLivePlayers())
      .subscribe()
  }, [quizId, sessionId])

  async function fetchLivePlayers() {
    const { data } = await supabase.from('sessions').select('player_name, score, answers_count')
      .eq('quiz_id', quizId).order('score', { ascending: false }).limit(10)
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
    await supabase.from('sessions').update({
      score: newScore, answers: newAnswers, answers_count: Object.keys(newAnswers).length
    }).eq('id', sessionId)
    setSubmitting(false)
  }

  function handleNext() {
    if (currentIndex + 1 >= questions.length) {
      supabase.from('sessions').update({ completed_at: new Date().toISOString() }).eq('id', sessionId).then()
      setFinished(true)
    } else {
      setCurrentIndex(prev => prev + 1)
      setSelected(null)
      setRevealed(false)
      startTimer(quiz.timer || 12)
    }
  }
