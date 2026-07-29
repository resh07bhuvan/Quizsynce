import React, { useState, useRef } from 'react'
import { supabase } from '../lib/supabase.js'
import { parseExcelFile, downloadExcelTemplate } from '../lib/excelParser.js'
import { generateOptionsForQuestions } from '../lib/aiGenerator.js'
import { useToast } from '../lib/toast.jsx'
import './Modal.css'
import './CreateModal.css'

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export default function CreateFromExcelModal({ onClose, onCreated }) {
  const [step, setStep] = useState('upload')
  const [title, setTitle] = useState('')
  const [file, setFile] = useState(null)
  const [parsed, setParsed] = useState(null)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState('')
  const [aiNeeded, setAiNeeded] = useState(false)
  const fileRef = useRef()
  const toast = useToast()

  async function handleFile(f) {
    setError('')
    setFile(f)
    setProgress('Reading file...')
    try {
      const result = await parseExcelFile(f)
      setParsed(result)
      setAiNeeded(result.needsAI)
      if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''))
      setStep('preview')
    } catch (err) {
      setError(err.message)
    }
    setProgress('')
  }

  function handleDrop(e) {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f && (f.name.endsWith('.xlsx') || f.name.endsWith('.xls'))) {
      handleFile(f)
    } else {
      setError('Please drop an Excel file (.xlsx or .xls).')
    }
  }

  async function handleCreate() {
    if (!title.trim()) { setError('Enter a title for the quiz.'); return }

    setStep('creating')
    let questions = parsed.questions

    try {
      if (aiNeeded) {
        setProgress('Generating answer options with AI...')
        questions = await generateOptionsForQuestions(parsed.questions)
      }

      setProgress('Saving quiz...')
      const code = generateCode()

      const { data: quiz, error: quizErr } = await supabase
        .from('quizzes')
        .insert({
          title: title.trim(),
          code,
          status: 'waiting',
          is_active: true,
          question_count: questions.length,
          source_type: 'excel',
          source_label: file.name
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
      setStep('preview')
      setProgress('')
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box modal-wide card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Create Quiz from Excel</h2>
            <p className="text-sm text-muted mt-1">Upload a spreadsheet to generate quiz questions</p>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>

        {step === 'upload' && (
          <div>
            <div
              className={`upload-zone ${error ? 'upload-zone-error' : ''}`}
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <p className="upload-title">Drop your Excel file here</p>
              <p className="upload-sub">or click to browse · .xlsx, .xls</p>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                style={{ display: 'none' }}
                onChange={e => e.target.files[0] && handleFile(e.target.files[0])}
              />
            </div>

            {error && <p className="form-error">{error}</p>}

            <div className="upload-formats">
              <p className="text-sm text-muted" style={{ marginBottom: '8px' }}>Supported formats:</p>
              <div className="format-grid">
                <div className="format-card">
                  <p className="format-label">Full Format</p>
                  <p className="format-desc">Question · Option A · Option B · Option C · Option D · Correct</p>
                  <p className="format-note">No AI required</p>
                </div>
                <div className="format-card">
                  <p className="format-label">Simple Format</p>
                  <p className="format-desc">Question · Answer</p>
                  <p className="format-note">AI generates options</p>
                </div>
              </div>
              <button className="btn btn-ghost btn-sm mt-3" onClick={downloadExcelTemplate}>
                Download template
              </button>
            </div>

            {progress && <p className="text-sm text-muted mt-3">{progress}</p>}
          </div>
        )}

        {step === 'preview' && parsed && (
          <div>
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label>Quiz title</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Enter quiz title"
              />
            </div>

            <div className="preview-summary">
              <div className="preview-stat">
                <strong>{parsed.questions.length}</strong>
                <span>Questions</span>
              </div>
              <div className="preview-stat">
                <strong>{file?.name}</strong>
                <span>Source file</span>
              </div>
              <div className="preview-stat">
                <strong style={{ color: aiNeeded ? 'var(--warning)' : 'var(--success)' }}>
                  {aiNeeded ? 'AI needed' : 'Ready'}
                </strong>
                <span>Options</span>
              </div>
            </div>

            {aiNeeded && (
              <div className="info-box">
                <p className="text-sm">
                  Your file uses the simple format (Question + Answer). The AI will generate 3 incorrect options for each question.
                  Make sure <code>VITE_OPENROUTER_API_KEY</code> is set in your environment.
                </p>
              </div>
            )}

            <div className="modal-scroll" style={{ maxHeight: '200px', marginTop: '12px' }}>
              <p className="text-sm text-muted mb-2">Preview ({Math.min(3, parsed.questions.length)} of {parsed.questions.length}):</p>
              {parsed.questions.slice(0, 3).map((q, i) => (
                <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <p className="text-sm" style={{ fontWeight: '500' }}>{i + 1}. {q.question}</p>
                  {q.options && (
                    <p className="text-sm text-muted mt-1">
                      {q.options.map((o, j) => (
                        <span key={j} style={{ marginRight: '8px', color: j === q.correct ? 'var(--success)' : '' }}>
                          {o}
                        </span>
                      ))}
                    </p>
                  )}
                  {q.answer && <p className="text-sm text-muted mt-1">Answer: {q.answer}</p>}
                </div>
              ))}
            </div>

            {error && <p className="form-error mt-3">{error}</p>}

            <div className="modal-actions mt-4">
              <button className="btn btn-ghost" onClick={() => { setStep('upload'); setParsed(null); setFile(null); setError('') }}>
                Back
              </button>
              <button className="btn btn-primary" onClick={handleCreate}>
                Create Quiz
              </button>
            </div>
          </div>
        )}

        {step === 'creating' && (
          <div className="creating-state">
            <span className="spinner spinner-lg"></span>
            <p className="text-muted" style={{ marginTop: '16px' }}>{progress}</p>
          </div>
        )}
      </div>
    </div>
  )
}
