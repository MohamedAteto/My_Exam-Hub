import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users } from 'lucide-react'
import UserProfile from '../components/UserProfile'
import Sidebar from '../components/Sidebar'
import QuizModal from '../components/QuizModal'
import ErrorBoundary from '../components/ErrorBoundary'
import UnifiedDashboard from '../components/UnifiedDashboard'
import DashboardFilters from '../components/DashboardFilters'
import api from '../api/axios'
import { storage } from '../utils/storage'

export default function SuperAdminPage() {
  const navigate = useNavigate()

  // State management
  const [currentSection, setCurrentSection] = useState('main')
  const [currentView, setCurrentView] = useState('overview') // 'overview', 'teachers', 'students'
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const actualRole = storage.getItem('userRole') || 'Admin'

  // Real data from backend
  const [exams, setExams] = useState([])
  const [questionBanks, setQuestionBanks] = useState([])
  const [teachers, setTeachers] = useState([])
  const [students, setStudents] = useState([])
  const [dbGrades, setDbGrades] = useState([])
  const [dbClasses, setDbClasses] = useState([])
  const [filters, setFilters] = useState({
    gradeId: null,
    classId: null,
    startDate: null,
    endDate: null
  })

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
        const [examsRes, questionBanksRes, lookupRes] = await Promise.all([
          api.get('/examdetail'),
          api.get('/questionbank'),
          api.get('/dashboard/lookup-data').catch(() => ({ data: { grades: [], classes: [] } }))
        ])

        // Robust mapping for exams to handle casing and missing fields
        const mappedExams = (examsRes.data || []).map(exam => {
          const gId = exam.gradeId ?? exam.GradeId ?? exam.GradeID;
          const cIds = exam.classIds ?? exam.ClassIds ?? (exam.classId ? [exam.classId] : (exam.ClassId ? [exam.ClassId] : []));

          let normalizedClassIds = Array.isArray(cIds) ? cIds : [];
          if (typeof cIds === 'string' && cIds.trim()) {
            normalizedClassIds = cIds.split(',').map(s => s.trim()).filter(Boolean).map(Number);
          }

          return {
            ...exam,
            id: exam.examId || exam.id,
            gradeId: gId,
            classIds: normalizedClassIds,
            title: exam.title || 'Untitled Exam',
            examSubject: exam.examSubject || exam.subject || 'N/A'
          }
        })

        setExams(mappedExams)
        setQuestionBanks(questionBanksRes.data || [])

        if (lookupRes.data) {
          setDbGrades(lookupRes.data.grades || [])
          setDbClasses(lookupRes.data.classes || [])
        }

        // Extract unique teachers from question banks
        const teacherAccounts = new Map()
        questionBanksRes.data?.forEach(qb => {
          const accId = qb.accountId || qb.AccountId;
          if (accId && !teacherAccounts.has(accId)) {
            teacherAccounts.set(accId, {
              id: accId,
              name: `Teacher ${accId}`,
              email: `teacher${accId}@school.com`,
              subject: qb.questionSubject || qb.QuestionSubject || 'Unknown',
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
          userRole={actualRole}
        />

        <div className="main-content section-transition">
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
                  userRole={actualRole}
                  onBack={() => showSection('main')}
                />
              )}

              {/* Main Dashboard */}
              {currentSection === 'main' && (
                <UnifiedDashboard
                  userRole={actualRole}
                  userId={null}
                  allExams={exams}
                  grades={dbGrades}
                  classes={dbClasses}
                />
              )}

              {/* Manage Exams View */}
              {currentSection === 'my-quizzes' && (
                <div id="quizzes-view">
                  <div style={{ marginBottom: '2rem' }}>
                    <h1 style={{ fontSize: '2rem', fontWeight: 700, color: '#1f2937', margin: '0 0 .5rem 0' }}>All Exams</h1>
                    <p style={{ fontSize: '1rem', color: '#6b7280', margin: 0 }}>View and manage all exams across the platform</p>
                  </div>

                  <div style={{ marginBottom: '2rem' }}>
                    <DashboardFilters
                      onFilterChange={(newFilters) => setFilters(newFilters)}
                      userRole={actualRole}
                      grades={dbGrades}
                      classes={dbClasses}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                    {(() => {
                      const filteredExams = exams.filter(exam => {
                        if (filters.gradeId && String(exam.gradeId) !== String(filters.gradeId)) return false
                        if (filters.classId) {
                          const cIds = exam.classIds || []
                          if (!cIds.some(id => String(id) === String(filters.classId))) return false
                        }
                        if (filters.startDate && new Date(exam.startDate) < new Date(filters.startDate)) return false
                        if (filters.endDate && new Date(exam.endDate) > new Date(filters.endDate)) return false
                        return true
                      });

                      if (filteredExams.length === 0) {
                        return (
                          <div className="animate-card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem', background: '#f9fafb', borderRadius: '16px', border: '2px dashed #e5e7eb' }}>
                            <p style={{ color: '#6b7280' }}>No exams match the selected filters.</p>
                          </div>
                        );
                      }

                      return filteredExams.map((exam, index) => (
                        <div key={exam.id} className={`animate-card stagger-${(index % 5) + 1}`} style={{
                          background: 'white',
                          borderRadius: '16px',
                          padding: '1.5rem',
                          boxShadow: '0 4px 14px rgba(0,0,0,.06)',
                          borderLeft: '4px solid #dc2626',
                          transition: 'transform 0.2s ease',
                          cursor: 'pointer'
                        }}
                          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(220, 38, 38, 0.1)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,.06)'; }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1f2937', margin: 0 }}>{exam.title}</h3>
                            <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', background: '#fee2e2', color: '#dc2626', borderRadius: '999px', fontWeight: 600 }}>#{exam.examId || exam.id}</span>
                          </div>

                          <p style={{ fontSize: '0.9rem', color: '#6b7280', marginBottom: '1.5rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: '2.7rem' }}>
                            {exam.examDescription || exam.description || 'No description provided.'}
                          </p>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingTop: '1rem', borderTop: '1px solid #f3f4f6' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#4b5563' }}>
                              <svg style={{ width: '16px', height: '16px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
                              <span>{exam.examSubject || 'Mathematics'}</span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#4b5563' }}>
                                <svg style={{ width: '16px', height: '16px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                <span>{new Date(exam.startDate).toLocaleDateString()}</span>
                              </div>
                              <div style={{ fontWeight: 600, color: '#059669', fontSize: '0.875rem' }}>
                                {exam.totalMarks || 0} Marks
                              </div>
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                              <span style={{ fontSize: '0.75rem', padding: '0.125rem 0.625rem', background: '#eff6ff', color: '#2563eb', borderRadius: '4px', border: '1px solid #dbeafe' }}>
                                {dbGrades.find(g => String(g.id) === String(exam.gradeId))?.gradeName || 'N/A'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ));
                    })()}
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
                    {teachers.map((teacher, index) => (
                      <div key={teacher.id} className={`animate-card stagger-${(index % 5) + 1}`} style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 14px rgba(0,0,0,.06)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
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
                    <div className="animate-card" style={{ textAlign: 'center' }}>
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

