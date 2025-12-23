import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users } from 'lucide-react'
import UserProfile from '../components/UserProfile'
import Sidebar from '../components/Sidebar'
import QuizModal from '../components/QuizModal'
import ErrorBoundary from '../components/ErrorBoundary'
import UnifiedDashboard from '../components/UnifiedDashboard'
import api from '../api/axios'
import { storage } from '../utils/storage'

export default function SuperAdminPage() {
  const navigate = useNavigate()

  // State management
  const [currentSection, setCurrentSection] = useState('main')
  const [currentView, setCurrentView] = useState('overview') // 'overview', 'teachers', 'students'
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Real data from backend
  const [exams, setExams] = useState([])
  const [questionBanks, setQuestionBanks] = useState([])
  const [teachers, setTeachers] = useState([])
  const [students, setStudents] = useState([])

  // Modal state
  const [isModalActive, setIsModalActive] = useState(false)
  const [modalTitle, setModalTitle] = useState('')
  const [modalMessage, setModalMessage] = useState('')
  const modalResolveRef = useRef(null)

  // Fetch real data from backend
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const [examsRes, questionBanksRes] = await Promise.all([
          api.get('/examdetail'),
          api.get('/questionbank')
        ])

        setExams(examsRes.data || [])
        setQuestionBanks(questionBanksRes.data || [])

        // Extract unique teachers from question banks and exams
        const teacherAccounts = new Map()

        // Get teachers from question banks
        questionBanksRes.data?.forEach(qb => {
          if (qb.accountId && !teacherAccounts.has(qb.accountId)) {
            teacherAccounts.set(qb.accountId, {
              id: qb.accountId,
              name: `Teacher ${qb.accountId}`, // This will be updated when we fetch profile data
              email: `teacher${qb.accountId}@school.com`, // This will be updated when we fetch profile data
              subject: qb.questionSubject || 'Unknown',
              questionCount: 0
            })
          }
        })

        // Fetch profile data for each teacher
        const teacherProfiles = await Promise.all(
          Array.from(teacherAccounts.keys()).map(async (accountId) => {
            try {
              const profileRes = await api.get(`/auth/profile/${accountId}`)
              return { accountId, profile: profileRes.data }
            } catch (error) {
              console.error(`Error fetching profile for teacher ${accountId}:`, error)
              return { accountId, profile: null }
            }
          })
        )

        // Update teacher data with profile information
        teacherProfiles.forEach(({ accountId, profile }) => {
          if (profile && teacherAccounts.has(accountId)) {
            const teacher = teacherAccounts.get(accountId)
            teacher.name = profile.fullNameEn || profile.fullNameAr || `Teacher ${accountId}`
            teacher.email = profile.email || `teacher${accountId}@school.com`
            teacherAccounts.set(accountId, teacher)
          }
        })

        // Count questions per teacher
        questionBanksRes.data?.forEach(qb => {
          if (qb.accountId && teacherAccounts.has(qb.accountId)) {
            teacherAccounts.get(qb.accountId).questionCount++
          }
        })

        setTeachers(Array.from(teacherAccounts.values()))
        setStudents([])

      } catch (err) {
        console.error('Error fetching data:', err)
        if (err.code === 'ERR_NETWORK' || err.message?.includes('Network Error') || !err.response) {
          setError('Failed to fetch (API error). Please check if the server is running and try again.')
        } else if (err.response?.status >= 500) {
          setError('Server error. Please try again later.')
        } else {
          setError(err.response?.data?.message || 'Failed to load dashboard data. Please try again.')
        }
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  function showModal(title, message) {
    return new Promise((resolve) => {
      setIsModalActive(true)
      setModalTitle(title)
      setModalMessage(message)
      modalResolveRef.current = resolve
    })
  }

  const handleModalConfirm = () => {
    setIsModalActive(false)
    if (modalResolveRef.current) {
      modalResolveRef.current(true)
    }
  }

  const handleModalCancel = () => {
    setIsModalActive(false)
    if (modalResolveRef.current) {
      modalResolveRef.current(false)
    }
  }

  function handleLogout() {
    showModal('Confirm Logout', 'Are you sure you want to logout?').then((confirmed) => {
      if (confirmed) {
        storage.clear()
        navigate('/')
      }
    })
  }

  function showSection(section) {
    setCurrentSection(section)
  }

  return (
    <ErrorBoundary>
      <div className="dashboard-container" style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar
          isExamActive={false}
          currentSection={currentSection}
          showSection={showSection}
          handleLogout={handleLogout}
          userRole="Admin"
        />

        <div className="main-content">
          {loading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  border: '4px solid var(--border-color)',
                  borderTop: '4px solid var(--accent-primary)',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 1rem'
                }}></div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>Loading dashboard...</p>
              </div>
            </div>
          ) : error ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ color: 'var(--danger)', marginBottom: '0.5rem' }}>Error Loading Dashboard</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  style={{
                    padding: '0.5rem 1rem',
                    background: 'var(--accent-primary)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : (
            <>

              {/* Profile Section */}
              {currentSection === 'profile' && (
                <UserProfile
                  userRole="Admin"
                  onBack={() => showSection('main')}
                />
              )}

              {/* Main Dashboard */}
              {currentSection === 'main' && (
                <UnifiedDashboard
                  userRole="Superadmin"
                  userId={null}
                />
              )}

              {/* Manage Exams View */}
              {currentSection === 'my-quizzes' && (
                <div id="quizzes-view">
                  <div style={{ marginBottom: '2rem' }}>
                    <h1 style={{ fontSize: '2rem', fontWeight: 700, color: '#1f2937', margin: '0 0 .5rem 0' }}>All Exams</h1>
                    <p style={{ fontSize: '1rem', color: '#6b7280', margin: 0 }}>View and manage all exams across the platform</p>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                    {exams.map(exam => (
                      <div key={exam.id} style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 14px rgba(0,0,0,.06)', borderLeft: '4px solid #dc2626' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1f2937', marginBottom: '0.5rem' }}>{exam.title}</h3>
                        <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>{exam.description}</p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#6b7280' }}>
                          <span>Subject: {exam.examSubject}</span>
                          <span>Marks: {exam.examMarks}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Teachers View */}
              {currentSection === 'teachers' && (
                <div id="teachers-view">
                  <div style={{ marginBottom: '2rem' }}>
                    <h1 style={{ fontSize: '2rem', fontWeight: 700, color: '#1f2937', margin: '0 0 .5rem 0' }}>Teachers List</h1>
                    <p style={{ fontSize: '1rem', color: '#6b7280', margin: 0 }}>Manage teacher accounts and their activity</p>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                    {teachers.map(teacher => (
                      <div key={teacher.id} style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 14px rgba(0,0,0,.06)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: '48px', height: '48px', background: '#fee2e2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', fontWeight: 700, color: '#dc2626' }}>
                          {teacher.name.charAt(0)}
                        </div>
                        <div>
                          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#1f2937', margin: 0 }}>{teacher.name}</h3>
                          <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>{teacher.email}</p>
                          <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>{teacher.questionCount} Questions Added</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Students View */}
              {currentSection === 'students' && (
                <div id="students-view">
                  <div style={{ marginBottom: '2rem' }}>
                    <h1 style={{ fontSize: '2rem', fontWeight: 700, color: '#1f2937', margin: '0 0 .5rem 0' }}>Students Overview</h1>
                    <p style={{ fontSize: '1rem', color: '#6b7280', margin: 0 }}>View all registered students and their grades</p>
                  </div>
                  <div style={{ background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem', borderRadius: '16px', border: '2px dashed #e5e7eb' }}>
                    <div style={{ textAlign: 'center' }}>
                      <Users size={48} color="#9ca3af" style={{ marginBottom: '1rem' }} />
                      <h3 style={{ fontSize: '1.25rem', color: '#4b5563', fontWeight: 600 }}>Detailed Student View Under Implementation</h3>
                      <p style={{ color: '#6b7280' }}>User profiles and grades will appear here shortly.</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>


        <QuizModal
          title={modalTitle}
          message={modalMessage}
          onConfirm={handleModalConfirm}
          onCancel={handleModalCancel}
          isActive={isModalActive}
        />
      </div>
    </ErrorBoundary>
  )
}

