import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, ArrowRight, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
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
      background-color: #ffffff;
      overflow: hidden;
    }
    .login-container { 
      display: flex; 
      justify-content: center; 
      align-items: center; 
      min-height: 100vh;
      background: radial-gradient(circle at top right, rgba(239, 68, 68, 0.05), transparent),
                  radial-gradient(circle at bottom left, rgba(239, 68, 68, 0.03), transparent);
      padding: 1.5rem;
    }
    .login-card { 
      width: 100%; 
      max-width: 440px; 
      background: white; 
      padding: 3rem 2.5rem; 
      border-radius: 32px; 
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.08); 
      animation: cardEntrance 0.8s cubic-bezier(0.16, 1, 0.3, 1);
      border: 1px solid rgba(0,0,0,0.04);
      position: relative;
      overflow: hidden;
    }
    @keyframes cardEntrance {
      from { transform: translateY(30px) scale(0.95); opacity: 0; }
      to { transform: translateY(0) scale(1); opacity: 1; }
    }
    .brand-section {
      text-align: center;
      margin-bottom: 2.5rem;
      animation: fadeInDown 0.6s ease-out 0.2s both;
    }
    @keyframes fadeInDown {
      from { transform: translateY(-10px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    .brand-logo {
      width: 72px;
      height: 72px;
      background: white;
      border-radius: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 1.5rem;
      border: 1px solid #f3f4f6;
      box-shadow: 0 12px 24px rgba(220, 38, 38, 0.1);
      transition: transform 0.3s ease;
    }
    .brand-logo:hover { transform: rotate(5deg) scale(1.05); }
    .brand-section h1 { 
      font-size: 2rem; 
      font-weight: 800; 
      color: #111827;
      letter-spacing: -0.025em;
      margin-bottom: 0.5rem;
    }
    .brand-section p {
      color: #6b7280;
      font-size: 1rem;
    }
    .input-group { 
      margin-bottom: 1.25rem; 
      position: relative; 
      animation: staggeredFade 0.5s ease-out both;
    }
    .input-group:nth-child(1) { animation-delay: 0.3s; }
    .input-group:nth-child(2) { animation-delay: 0.4s; }
    .auth-options { animation: staggeredFade 0.5s ease-out 0.5s both; }
    .sign-in-btn { animation: staggeredFade 0.5s ease-out 0.6s both; }
    
    @keyframes staggeredFade {
      from { transform: translateY(10px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    .input-label {
      display: block;
      font-size: 0.875rem;
      font-weight: 600;
      color: #374151;
      margin-bottom: 0.5rem;
      margin-left: 4px;
    }
    .input-wrapper { position: relative; }
    .input-icon {
      position: absolute;
      left: 1rem;
      top: 50%;
      transform: translateY(-50%);
      color: #9ca3af;
      pointer-events: none;
      transition: color 0.2s ease;
    }
    .input-group input { 
      width: 100%; 
      padding: 0.875rem 1rem 0.875rem 2.75rem; 
      border: 2px solid #f3f4f6; 
      border-radius: 14px; 
      font-size: 1rem; 
      background: #f9fafb; 
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
      color: #111827;
    }
    .input-group input:focus { 
      outline: none; 
      border-color: #ef4444; 
      background: #fff;
      box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.08);
      transform: translateY(-1px);
    }
    .input-group input:focus + .input-icon { color: #ef4444; }
    .toggle-password { 
      position: absolute; 
      right: 0.75rem; 
      top: 50%; 
      transform: translateY(-50%); 
      background: transparent; 
      border: none; 
      cursor: pointer; 
      color: #9ca3af; 
      padding: 6px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      transition: all 0.2s ease;
    }
    .toggle-password:hover { color: #ef4444; background: rgba(239, 68, 68, 0.05); }
    
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
      transition: all 0.2s ease;
    }
    .forgot-password:hover { color: #dc2626; opacity: 0.8; }
    
    .remember-me {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      font-size: 0.875rem;
      color: #6b7280;
      cursor: pointer;
      user-select: none;
    }
    .remember-me input {
      width: 18px;
      height: 18px;
      accent-color: #ef4444;
      cursor: pointer;
    }
    
    .sign-in-btn { 
      width: 100%; 
      background: #ef4444; 
      color: white; 
      border: none; 
      padding: 1.125rem; 
      border-radius: 16px; 
      font-size: 1.0625rem; 
      font-weight: 700; 
      cursor: pointer; 
      transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      gap: 12px; 
      box-shadow: 0 10px 25px -5px rgba(239, 68, 68, 0.3);
    }
    .sign-in-btn:hover:not(:disabled) { 
      background: #dc2626; 
      transform: translateY(-3px) scale(1.01);
      box-shadow: 0 15px 30px -5px rgba(239, 68, 68, 0.4);
    }
    .sign-in-btn:active:not(:disabled) { transform: translateY(-1px); }
    .sign-in-btn:disabled { opacity: 0.6; cursor: not-allowed; }
    
    .error-toast {
      background: #fff1f2;
      border: 1px solid #fecaca;
      color: #be123c;
      padding: 1rem;
      border-radius: 14px;
      font-size: 0.9rem;
      margin-bottom: 2rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
    }
    @keyframes shake {
      10%, 90% { transform: translate3d(-1px, 0, 0); }
      20%, 80% { transform: translate3d(2px, 0, 0); }
      30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
      40%, 60% { transform: translate3d(4px, 0, 0); }
    }
    .success-toast {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      color: #15803d;
      padding: 1rem;
      border-radius: 14px;
      font-size: 0.9rem;
      margin-bottom: 2rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0% { transform: scale(1); }
      50% { transform: scale(1.01); }
      100% { transform: scale(1); }
    }
    .spin-loader { animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    
    .signup-text { 
      text-align: center; 
      color: #6b7280; 
      font-size: 0.9375rem; 
      margin-top: 2rem;
      animation: fadeIn 0.8s ease-out 0.8s both;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .signup-text a { 
      color: #ef4444; 
      text-decoration: none; 
      font-weight: 700;
      margin-left: 4px;
      transition: color 0.2s;
    }
    .signup-text a:hover { color: #dc2626; text-decoration: underline; }
  `,
    []
  )

  const [rememberMe, setRememberMe] = useState(false)

  useEffect(() => {
    if (storage.isAuthenticated()) {
      const role = storage.getItem('userRole')
      const roleNorm = String(role || '').toLowerCase()
      if (roleNorm === 'admin' || roleNorm === 'board') navigate('/superadmin')
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

      const primaryRole = roles.find(r => r.toLowerCase() === 'admin' || r.toLowerCase() === 'board')
        || roles.find(r => r.toLowerCase() === 'teacher')
        || roles.find(r => r.toLowerCase() === 'student')
        || ''

      storage.setItem('token', token, rememberMe)
      storage.setItem('userRole', primaryRole)
      storage.setItem('userName', fullNameEn || fullNameAr || 'User')

      setSuccessMessage('Login successful! Welcome back.')

      const card = document.querySelector('.login-card')
      if (card) {
        card.style.transition = 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)'
        card.style.transform = 'scale(0.9) translateY(-20px)'
        card.style.opacity = '0'
      }

      setTimeout(() => {
        navigate('/greeting')
      }, 800)
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
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <style>{styles}</style>
        <div className="login-card">
          <div className="brand-section">
            <div className="brand-logo">
              <img src="/logo.png" style={{ width: '52px', height: '52px', objectFit: 'contain' }} alt="Exams Hub" />
            </div>
            <h1>Exams Hub</h1>
            <p>Sign in to your account</p>
          </div>

          <form onSubmit={handleLogin}>
            {errorMessage && (
              <div className="error-toast">
                <AlertCircle size={20} />
                {errorMessage}
              </div>
            )}
            {successMessage && (
              <div className="success-toast">
                <CheckCircle size={20} />
                {successMessage}
              </div>
            )}

            <div className="input-group">
              <label className="input-label">Email Address</label>
              <div className="input-wrapper">
                <span className="input-icon"><Mail size={18} /></span>
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
                <span className="input-icon"><Lock size={18} /></span>
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
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
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
                <span>Keep me signed in</span>
              </label>
              <a href="#" className="forgot-password">Forgot password?</a>
            </div>

            <button type="submit" className="sign-in-btn" disabled={loading}>
              {loading ? (
                <Loader2 className="spin-loader" size={20} />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={20} />
                </>
              )}
            </button>
          </form>

          <div className="signup-text">
            New to Exams Hub? <a href="#">Create account</a>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}
