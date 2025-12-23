import { useState, useEffect } from 'react'
import DashboardFilters from './DashboardFilters'
import DashboardCards from './DashboardCards'
import DashboardLeaderboard from './DashboardLeaderboard'
import api from '../api/axios'

export default function UnifiedDashboard({ userRole, userId }) {
    const [filters, setFilters] = useState({
        gradeId: null,
        classId: null,
        startDate: null,
        endDate: null
    })

    const [dashboardData, setDashboardData] = useState(null)
    const [leaderboardData, setLeaderboardData] = useState(null)
    const [recentExams, setRecentExams] = useState([])
    const [selectedExamId, setSelectedExamId] = useState(null)
    const [loading, setLoading] = useState(true)
    const [leaderboardLoading, setLeaderboardLoading] = useState(true)
    const [error, setError] = useState(null)

    // Normalize role for comparison
    const roleNorm = String(userRole || '').toLowerCase()

    // Fetch dashboard data based on role and filters
    useEffect(() => {
        console.log('[UnifiedDashboard] Filters changed:', filters)
        fetchDashboardData()
    }, [userRole, userId, filters])

    // Fetch leaderboard when filters or exam selection changes
    useEffect(() => {
        if (roleNorm === 'student' && dashboardData?.latestExamLeaderboard) {
            setLeaderboardData(dashboardData.latestExamLeaderboard.topStudents || [])
            setLeaderboardLoading(false)
        } else if (dashboardData) {
            fetchLeaderboard()
        }
    }, [filters, dashboardData, selectedExamId, roleNorm])

    const fetchDashboardData = async () => {
        try {
            setLoading(true)
            setError(null)

            // Build filter query string
            const queryParams = new URLSearchParams()
            if (filters.gradeId) queryParams.append('gradeId', filters.gradeId)
            if (filters.classId) queryParams.append('classId', filters.classId)
            if (filters.startDate) queryParams.append('startDate', filters.startDate)
            if (filters.endDate) queryParams.append('endDate', filters.endDate)

            let endpoint = ''
            switch (roleNorm) {
                case 'student':
                    endpoint = `/dashboard/student/${userId}`
                    break
                case 'teacher':
                    endpoint = `/dashboard/teacher/${userId}`
                    break
                case 'superadmin':
                case 'admin':
                    endpoint = '/dashboard/superadmin'
                    break
                default:
                    throw new Error('Invalid user role')
            }

            const response = await api.get(`${endpoint}?${queryParams.toString()}`)
            const data = response.data

            // Transform data to match card component expectations
            const transformedData = {
                totalExams: data.totalExamsTaken || data.totalExamsCreated || data.totalExams || 0,
                passPercentage: data.passPercentage || data.averagePassPercentage || data.overallPassPercentage || 0,
                failPercentage: data.failPercentage || data.averageFailPercentage || data.overallFailPercentage || 0,
                latestExamLeaderboard: data.latestExamLeaderboard || null,
                studentRankInLatestExam: data.studentRankInLatestExam || null,
                topPerformingStudents: data.topPerformingStudents || []
            }

            // Common logic for all roles to set recent exams and default selection
            const recent = data.recentExams || []
            setRecentExams(recent)

            // If the currently selected exam is not in the new batch, or none selected, pick the first one
            if (recent.length > 0) {
                const currentStillExists = recent.some(e => String(e.examId) === String(selectedExamId))
                if (!currentStillExists) {
                    setSelectedExamId(recent[0].examId)
                }
            } else {
                setSelectedExamId(null)
            }

            setDashboardData(transformedData)
        } catch (err) {
            console.error('Error fetching dashboard data:', err)
            setError(err.response?.data?.message || 'Failed to load dashboard data')
        } finally {
            setLoading(false)
        }
    }

    const fetchLeaderboard = async () => {
        try {
            setLeaderboardLoading(true)

            if (roleNorm === 'admin' || roleNorm === 'superadmin') {
                if (dashboardData?.topPerformingStudents) {
                    setLeaderboardData(dashboardData.topPerformingStudents)
                }
                setLeaderboardLoading(false)
                return
            }

            if (selectedExamId) {
                // Fetch leaderboard for ANY role if an exam is selected
                const response = await api.get(`/dashboard/leaderboard/${selectedExamId}`)
                setLeaderboardData(response.data.topStudents || [])
                setLeaderboardLoading(false)
                return
            }

            setLeaderboardData([])
            setLeaderboardLoading(false)
        } catch (err) {
            console.error('Error fetching leaderboard:', err)
            setLeaderboardData([])
            setLeaderboardLoading(false)
        }
    }

    const handleFilterChange = (newFilters) => {
        setFilters(newFilters)
    }

    const handleExamChange = (e) => {
        setSelectedExamId(e.target.value)
    }

    if (error) {
        return (
            <div style={{
                padding: '2rem',
                background: 'var(--bg-surface)',
                minHeight: '100vh'
            }}>
                <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
                    <div style={{
                        background: 'var(--bg-main)',
                        borderRadius: '16px',
                        padding: '3rem 2rem',
                        textAlign: 'center',
                        boxShadow: 'var(--shadow-sm)'
                    }}>
                        <svg style={{ width: '64px', height: '64px', fill: '#ef4444', margin: '0 auto 1rem' }} viewBox="0 0 24 24">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                        </svg>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                            Error Loading Dashboard
                        </h3>
                        <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                            {error}
                        </p>
                        <button
                            onClick={fetchDashboardData}
                            style={{
                                padding: '0.75rem 1.5rem',
                                borderRadius: '8px',
                                border: 'none',
                                background: 'var(--primary)',
                                color: 'white',
                                fontSize: '0.875rem',
                                fontWeight: '500',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div style={{
            padding: '2rem',
            background: 'var(--bg-surface)',
            minHeight: '100vh'
        }}>
            <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
                {/* Header */}
                <div style={{ marginBottom: '2rem' }}>
                    <h1 style={{
                        fontSize: '2rem',
                        fontWeight: '700',
                        color: 'var(--text-primary)',
                        marginBottom: '0.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem'
                    }}>
                        <svg style={{ width: '32px', height: '32px', fill: 'var(--primary)' }} viewBox="0 0 24 24">
                            <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
                        </svg>
                        Dashboard
                    </h1>
                    <p style={{
                        fontSize: '1rem',
                        color: 'var(--text-secondary)',
                        margin: 0
                    }}>
                        {roleNorm === 'student' && 'Track your exam performance and progress'}
                        {roleNorm === 'teacher' && 'Monitor your exams and student performance'}
                        {(roleNorm === 'superadmin' || roleNorm === 'admin') && 'System-wide statistics and insights'}
                    </p>
                </div>

                {/* Filters */}
                <DashboardFilters
                    onFilterChange={handleFilterChange}
                    userRole={userRole}
                />

                {/* Statistics Cards */}
                <DashboardCards
                    data={dashboardData}
                    loading={loading}
                    userRole={userRole}
                />

                {/* Leaderboard Section Header with Dropdown for Teachers */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '1rem'
                }}>
                    <div></div> {/* Spacer */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        background: 'white',
                        padding: '0.5rem 1rem',
                        borderRadius: '12px',
                        boxShadow: 'var(--shadow-sm)',
                        border: '1px solid #e5e7eb'
                    }}>
                        <span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                            Selected Exam:
                        </span>
                        {recentExams.length > 0 ? (
                            <select
                                value={selectedExamId || ''}
                                onChange={handleExamChange}
                                style={{
                                    padding: '0.5rem',
                                    borderRadius: '8px',
                                    border: '1px solid #e5e7eb',
                                    fontSize: '0.875rem',
                                    color: 'var(--text-primary)',
                                    background: 'var(--bg-main)',
                                    cursor: 'pointer',
                                    outline: 'none',
                                    minWidth: '200px'
                                }}
                            >
                                {recentExams.map(exam => (
                                    <option key={exam.examId} value={exam.examId}>
                                        {exam.title}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <span style={{ fontSize: '0.875rem', fontStyle: 'italic', color: 'var(--text-light)' }}>
                                No exams found
                            </span>
                        )}
                    </div>
                </div>

                {/* Leaderboard */}
                <DashboardLeaderboard
                    leaderboard={leaderboardData}
                    loading={leaderboardLoading}
                    examTitle={
                        recentExams.find(e => String(e.examId) === String(selectedExamId))?.title || 'Exam Leaderboard'
                    }
                    userRole={userRole}
                    currentUserId={roleNorm === 'student' ? parseInt(userId) : null}
                />
            </div>
        </div>
    )
}
