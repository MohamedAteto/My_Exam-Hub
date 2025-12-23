import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios.js'
import ErrorBoundary from '../components/ErrorBoundary'
import { storage } from '../utils/storage'

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const styles = useMemo(
    () => `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { 
      height: 100%; 
      font-family: 'Inter', system-ui, -apple-system, sans-serif; 
      background-color: #f8fafc;
      overflow: hidden;
    }
    .login-container { 
      display: flex; 
      justify-content: center; 
      align-items: center; 
      min-height: 100vh;
      background: radial-gradient(circle at top left, rgba(239, 68, 68, 0.05) 0%, transparent 40%),
                  radial-gradient(circle at bottom right, rgba(239, 68, 68, 0.05) 0%, transparent 40%);
      padding: 1.5rem;
    }
    .login-card { 
      width: 100%; 
      max-width: 440px; 
      background: white; 
      padding: 3rem 2.5rem; 
      border-radius: 24px; 
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.08); 
      animation: slideDown 0.6s cubic-bezier(0.16, 1, 0.3, 1);
      border: 1px solid rgba(0,0,0,0.02);
    }
    @keyframes slideDown {
      from { transform: translateY(-20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    .brand-section {
      text-align: center;
      margin-bottom: 2.5rem;
    }
    .brand-logo {
      width: 64px;
      height: 64px;
      background: #ef4444;
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 1.25rem;
      box-shadow: 0 8px 16px rgba(239, 68, 68, 0.2);
    }
    .brand-logo svg {
      width: 32px;
      height: 32px;
      fill: white;
    }
    .brand-section h1 { 
      font-size: 1.75rem; 
      font-weight: 800; 
      color: #111827;
      letter-spacing: -0.02em;
      margin-bottom: 0.5rem;
    }
    .brand-section p {
      color: #6b7280;
      font-size: 0.9375rem;
    }
    .input-group { margin-bottom: 1.25rem; position: relative; }
    .input-label {
      display: block;
      font-size: 0.875rem;
      font-weight: 600;
      color: #374151;
      margin-bottom: 0.5rem;
      margin-left: 4px;
    }
    .input-wrapper {
      position: relative;
    }
    .input-icon {
      position: absolute;
      left: 1rem;
      top: 50%;
      transform: translateY(-50%);
      color: #9ca3af;
      pointer-events: none;
    }
    .input-group input { 
      width: 100%; 
      padding: 0.875rem 1rem 0.875rem 2.75rem; 
      border: 1.5px solid #e5e7eb; 
      border-radius: 12px; 
      font-size: 1rem; 
      background: #fff; 
      transition: all 0.2s ease; 
      color: #111827;
    }
    .input-group input:focus { 
      outline: none; 
      border-color: #ef4444; 
      box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.1);
      transform: translateY(-1px);
    }
    .input-group input::placeholder { color: #9ca3af; }
    .toggle-password { 
      position: absolute; 
      right: 0.75rem; 
      top: 50%; 
      transform: translateY(-50%); 
      background: #f3f4f6; 
      border: none; 
      cursor: pointer; 
      color: #6b7280; 
      padding: 6px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }
    .toggle-password:hover { background: #e5e7eb; color: #111827; }
    .auth-options {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
    }
    .forgot-password { 
      color: #ef4444; 
      text-decoration: none; 
      font-size: 0.875rem; 
      font-weight: 600;
      transition: color 0.2s ease;
    }
    .forgot-password:hover { color: #dc2626; text-decoration: underline; }
    .remember-me {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
      color: #6b7280;
      cursor: pointer;
    }
    .remember-me input {
      width: 16px;
      height: 16px;
      accent-color: #ef4444;
    }
    .sign-in-btn { 
      width: 100%; 
      background: #ef4444; 
      color: white; 
      border: none; 
      padding: 1rem; 
      border-radius: 14px; 
      font-size: 1rem; 
      font-weight: 700; 
      cursor: pointer; 
      transition: all 0.32s cubic-bezier(0.4, 0, 0.2, 1); 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      gap: 10px; 
      box-shadow: 0 10px 20px rgba(239, 68, 68, 0.15);
    }
    .sign-in-btn:hover:not(:disabled) { 
      background: #dc2626; 
      transform: translateY(-2px);
      box-shadow: 0 12px 24px rgba(239, 68, 68, 0.25);
    }
    .sign-in-btn:active:not(:disabled) { transform: translateY(0); }
    .sign-in-btn:disabled { opacity: 0.7; cursor: not-allowed; }
    .signup-text { 
      text-align: center; 
      color: #6b7280; 
      font-size: 0.9375rem; 
      margin-top: 2rem;
    }
    .signup-text a { 
      color: #ef4444; 
      text-decoration: none; 
      font-weight: 700;
      margin-left: 4px;
    }
    .signup-text a:hover { text-decoration: underline; }
    .error-toast {
      background: #fee2e2;
      border: 1.5px solid #fecaca;
      color: #dc2626;
      padding: 1rem;
      border-radius: 12px;
      font-size: 0.875rem;
      margin-bottom: 2rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both;
    }
    @keyframes shake {
      10%, 90% { transform: translate3d(-1px, 0, 0); }
      20%, 80% { transform: translate3d(2px, 0, 0); }
      30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
      40%, 60% { transform: translate3d(4px, 0, 0); }
    }
    .success-toast {
      background: #dcfce7;
      border: 1.5px solid #bbf7d0;
      color: #166534;
      padding: 1rem;
      border-radius: 12px;
      font-size: 0.875rem;
      margin-bottom: 2rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .loading-spinner {
      width: 20px;
      height: 20px;
      border: 3px solid rgba(255,255,255,0.3);
      border-radius: 50%;
      border-top-color: white;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `,
    []
  )

  const [rememberMe, setRememberMe] = useState(false)

  // Auto-redirect if already logged in
  useEffect(() => {
    if (storage.isAuthenticated()) {
      const role = storage.getItem('userRole')
      const roleNorm = String(role || '').toLowerCase()
      if (roleNorm === 'admin') navigate('/superadmin')
      else if (roleNorm === 'teacher') navigate('/teacher')
      else if (roleNorm === 'student') navigate('/student')
    }
  }, [navigate])

  useEffect(() => {
    if (successMessage || errorMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage('')
        setErrorMessage('')
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [successMessage, errorMessage])

  function validate() {
    if (!email || !password) {
      setErrorMessage('Please enter both email and password.')
      return false
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setErrorMessage('Please use a valid email address format.')
      return false
    }
    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.')
      return false
    }
    setErrorMessage('')
    return true
  }

  async function handleLogin(e) {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    try {
      const response = await api.post('/auth/login', { email, password })
      const { token, roles, fullNameEn, fullNameAr } = response.data

      const roleArray = Array.isArray(roles) ? roles.map(r => String(r)) : []
      const primaryRole = roleArray.find(r => r.toLowerCase() === 'admin')
        || roleArray.find(r => r.toLowerCase() === 'teacher')
        || roleArray.find(r => r.toLowerCase() === 'student')
        || ''

      // Use storage utility with persistence flag
      storage.setItem('token', token, rememberMe)
      storage.setItem('userRole', primaryRole)
      storage.setItem('userName', fullNameEn || fullNameAr || 'User')

      setSuccessMessage('Login successful! Redirecting to your dashboard...')
      setTimeout(() => {
        const roleNorm = String(primaryRole || '').toLowerCase()
        if (roleNorm === 'admin') navigate('/superadmin')
        else if (roleNorm === 'teacher') navigate('/teacher')
        else if (roleNorm === 'student') navigate('/student')
        else navigate('/')
      }, 1500)
    } catch (err) {
      if (err.code === 'ERR_NETWORK' || !err.response) {
        setErrorMessage('Server unreachable. Please check your connection.')
      } else if (err.response?.status === 401) {
        setErrorMessage('Invalid credentials. Please try again.')
      } else {
        setErrorMessage(err.response?.data?.message || 'Login failed. Please try again later.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <ErrorBoundary>
      <div className="login-container">
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet" />
        <style>{styles}</style>
        <div className="login-card">
          <div className="brand-section">
            <div className="brand-logo">
              <img src="/logo.png" style={{ width: '48px', height: '48px', objectFit: 'contain' }} alt="Exams Hub" />
            </div>
            <h1>Exams Hub</h1>
            <p>Sign in to manage your examinations</p>
          </div>

          <form onSubmit={handleLogin}>
            {errorMessage && (
              <div className="error-toast">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {errorMessage}
              </div>
            )}
            {successMessage && (
              <div className="success-toast">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                {successMessage}
              </div>
            )}

            <div className="input-group">
              <label className="input-label">Email Address</label>
              <div className="input-wrapper">
                <span className="input-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
                  </svg>
                </span>
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Password</label>
              <div className="input-wrapper">
                <span className="input-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="auth-options">
              <label className="remember-me">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Remember me</span>
              </label>
              <a href="#" className="forgot-password">Forgot password?</a>
            </div>

            <button type="submit" className="sign-in-btn" disabled={loading}>
              {loading ? (
                <div className="loading-spinner"></div>
              ) : (
                <>
                  <span>Sign In</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                  </svg>
                </>
              )}
            </button>
          </form>

          <div className="signup-text">
            Don't have an account? <a href="#">Create one now</a>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}
