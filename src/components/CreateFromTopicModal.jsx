import React, { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { generateQuestionsFromTopic } from '../lib/aiGenerator.js'
import { useToast } from '../lib/toast.jsx'
import './Modal.css'
import './CreateModal.css'

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export default function CreateFromTopicModal({ onClose, onCreated }) {
  const [title, setTitle] = useState('')
  const [topic, setTopic] = useState('')
  const [count, setCount] = useState(10)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState('')
  const toast = useToast()

  async function handleCreate(e) {
    e.preventDefault()
    if (!topic.trim()) { setError('Enter a topic.'); return }

    setLoading(true)
    setError('')
    setProgress('Generating questions with AI...')

    try {
      const questions = await generateQuestionsFromTopic(topic.trim(), count)

      setProgress('Saving quiz...')
      const code = generateCode()
      const quizTitle = title.trim() || `${topic.trim()} Quiz`

      const { data: quiz, error: quizErr } = await supabase
        .from('quizzes')
        .insert({
          title: quizTitle,
          code,
          status: 'waiting',
          is_active: true,
          question_count: questions.length,
          source_type: 'topic',
          source_label: topic.trim()
        })
        .select()
        .single()

      if (quizErr) throw quizErr

      const qRows = questions.map((q, i) => ({
        quiz_id: quiz.id,
        question: q.question,
        options: q.options,
        correct: q.correct,
        explanation: q.explanation || '',
        order_index: i
      }))

      const { error: qErr } = await supabase.from('questions').insert(qRows)
      if (qErr) throw qErr

      onCreated(quiz)
    } catch (err) {
      setError(err.message)
    }

    setLoading(false)
    setProgress('')
  }

  const suggestions = [
    'World History', 'General Science', 'Pop Culture 2024',
    'Geography', 'Technology & AI', 'Sports Trivia',
    'Mathematics', 'Literature', 'Movies & TV'
  ]

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Create Quiz from Topic</h2>
            <p className="text-sm text-muted mt-1">AI generates questions on any topic</p>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleCreate} className="modal-body">
          <div className="form-group">
            <label>Topic <span style={{ color: 'var(--error)' }}>*</span></label>
            <input
              type="text"
              placeholder="e.g. World War II, Python programming, NFL history"
              value={topic}
              onChange={e => { setTopic(e.target.value); setError('') }}
              disabled={loading}
            />
          </div>

          <div className="topic-chips">
            {suggestions.map(s => (
              <button
                key={s}
                type="button"
                className="chip"
                onClick={() => setTopic(s)}
                disabled={loading}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="form-group">
            <label>Quiz title <span style={{ color: 'var(--text-muted)' }}>(optional)</span></label>
            <input
              type="text"
              placeholder={topic ? `${topic} Quiz` : 'Auto-generated from topic'}
              value={title}
              onChange={e => setTitle(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Number of questions</label>
            <select value={count} onChange={e => setCount(Number(e.target.value))} disabled={loading}>
              {[5, 10, 15, 20].map(n => (
                <option key={n} value={n}>{n} questions</option>
              ))}
            </select>
          </div>

          <div className="info-box">
            <p className="text-sm">
              Requires <code>VITE_OPENROUTER_API_KEY</code>. Get a free key at{' '}
              <a href="https://openrouter.ai" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
                openrouter.ai
              </a>
            </p>
          </div>

          {error && <p className="form-error">{error}</p>}
          {loading && progress && (
            <div className="flex items-center gap-2">
              <span className="spinner"></span>
              <span className="text-sm text-muted">{progress}</span>
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading || !topic.trim()}>
              {loading ? 'Creating...' : `Generate ${count} Questions`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
