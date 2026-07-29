import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdmin } from '../lib/adminAuth.jsx'
import { useToast } from '../lib/toast.jsx'
import './Modal.css'

export default function AdminLoginModal({ onClose }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const { login } = useAdmin()
  const toast = useToast()
  const navigate = useNavigate()

  function handleSubmit(e) {
    e.preventDefault()
    if (login(password)) {
      toast('Welcome back, Admin.', 'success')
      onClose()
      navigate('/admin')
    } else {
      setError('Incorrect password.')
      setPassword('')
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Admin Access</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label htmlFor="admin-pw">Password</label>
            <input
              id="admin-pw"
              type="password"
              placeholder="Enter admin password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError('') }}
              autoFocus
            />
            {error && <p style={{ color: 'var(--error)', fontSize: '0.8125rem' }}>{error}</p>}
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Sign in</button>
          </div>
        </form>
      </div>
    </div>
  )
}
