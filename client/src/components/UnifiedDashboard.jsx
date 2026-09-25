import { useState, useEffect, useRef, useMemo } from 'react'
import DashboardFilters from './DashboardFilters'
import DashboardCards from './DashboardCards'
import DashboardLeaderboard from './DashboardLeaderboard'
import api from '../api/axios'
import StatsPieChart from './charts/StatsPieChart'
import StatsLineChart from './charts/StatsLineChart'
import StatsBarChart from './charts/StatsBarChart'
import DashboardCharts from './DashboardCharts'
import LoadingSpinner from './LoadingSpinner'
import ReportExportDialog from './ReportExportDialog'
import { parseToken, getUserIdFromToken } from '../utils/token'
import { buildAppliedDashboardFilters, buildDashboardReport } from '../utils/dashboardReport'

export default function UnifiedDashboard({ userRole, userId, allExams = [], grades = [], classes = [], subjects = [], onSeeAllScores }) {
    console.log('[UnifiedDashboard] Grades received:', grades)
    const [sliderGradeIndex, setSliderGradeIndex] = useState(0)
    const sliderGradeRecord = grades[sliderGradeIndex]
    const sliderGradeName = sliderGradeRecord?.gradeName || sliderGradeRecord?.name || ''
    const [filters, setFilters] = useState({
        gradeId: null,
        classId: null,
        subjectId: null,
        startDate: null,
        endDate: null,
        groupBy: 'Student'
    })

    const [dashboardData, setDashboardData] = useState(null)
    const [leaderboardData, setLeaderboardData] = useState(null)
    const [recentExams, setRecentExams] = useState([])
    const [selectedExamId, setSelectedExamId] = useState(null)
    const [loading, setLoading] = useState(true)
    const [leaderboardLoading, setLeaderboardLoading] = useState(true)
    const [error, setError] = useState(null)
    const [autoExamSelected, setAutoExamSelected] = useState(false)
    const [isReportDialogOpen, setIsReportDialogOpen] = useState(false)
    const dashboardRequestId = useRef(0)
    const leaderboardRequestId = useRef(0)

    // Normalize role for comparison
    const roleNorm = String(userRole || '').toLowerCase()
    const studentGradeId = dashboardData?.gradeId ?? dashboardData?.GradeId
    const studentClassId = dashboardData?.classId ?? dashboardData?.ClassId
    const dashboardGrades = useMemo(() => roleNorm === 'student' && studentGradeId != null
        ? grades.filter(grade => String(grade.id ?? grade.Id) === String(studentGradeId))
        : grades, [roleNorm, studentGradeId, grades])
    const dashboardClasses = useMemo(() => roleNorm === 'student' && studentClassId != null
        ? classes.filter(classItem => String(classItem.id ?? classItem.Id) === String(studentClassId))
        : classes, [roleNorm, studentClassId, classes])

    useEffect(() => {
        if (roleNorm !== 'student' || studentGradeId == null || studentClassId == null) return
        setFilters(current => String(current.gradeId) === String(studentGradeId) && String(current.classId) === String(studentClassId)
            ? current
            : { ...current, gradeId: studentGradeId, classId: studentClassId })
    }, [roleNorm, studentGradeId, studentClassId])

    const dashboardReport = useMemo(
        () => buildDashboardReport(dashboardData, { userRole: roleNorm, selectedExamId }),
        [dashboardData, roleNorm, selectedExamId]
    )
    const reportFilters = useMemo(() => buildAppliedDashboardFilters({
        filters,
        selectedExamId,
        grades: dashboardGrades,
        classes: dashboardClasses,
        subjects,
        allExams,
        recentExams
    }), [filters, selectedExamId, dashboardGrades, dashboardClasses, subjects, allExams, recentExams])

    // Fetch dashboard data based on role, filters and selected exam
    useEffect(() => {
        fetchDashboardData()
    }, [userRole, userId, filters, selectedExamId, grades])

    // Fetch leaderboard when filters, exam selection, or slider grade changes
    useEffect(() => {
        if (!selectedExamId && !filters.gradeId && ['teacher', 'admin', 'superadmin'].includes(roleNorm) && grades.length === 0) {
            leaderboardRequestId.current++
            setLeaderboardData([])
            setLeaderboardLoading(false)
            return
        }

        // If an exam is selected (manually or default), always fetch its specific leaderboard
        if (selectedExamId) {
            fetchLeaderboard()
            return
        }

        if (roleNorm === 'student' && dashboardData?.latestExamLeaderboard) {
            leaderboardRequestId.current++
            setLeaderboardData(dashboardData.latestExamLeaderboard.topStudents || [])
            setLeaderboardLoading(false)
        } else if (dashboardData || selectedExamId || (!selectedExamId && (roleNorm === 'teacher' || roleNorm === 'admin' || roleNorm === 'superadmin'))) {
            fetchLeaderboard()
        }
    }, [filters, dashboardData, selectedExamId, roleNorm, sliderGradeIndex, grades])

    // Auto-select a meaningful exam when "All Exams" view has no leaderboard data
    // Only do this for students or on initial load if desired. 
    // For teachers/admins, "All Exams" should be a valid aggregate view.
    useEffect(() => {
        if (roleNorm !== 'student') return // Disable auto-select for teachers/admins to allow "All Exams" aggregate view
        if (autoExamSelected) return
        if (selectedExamId) return
        if (!leaderboardData || leaderboardData.length > 0) return
        if (!dashboardData || !dashboardData.examBreakdown || dashboardData.examBreakdown.length === 0) return

        const breakdown = dashboardData.examBreakdown
        const candidate = breakdown.find(e =>
            (e.totalStudents || e.passedStudents || e.failedStudents || 0) > 0
        ) || breakdown[0]

        if (candidate && candidate.examId) {
            setSelectedExamId(candidate.examId)
            setAutoExamSelected(true)
        }
    }, [leaderboardData, selectedExamId, autoExamSelected, dashboardData, roleNorm])

    const handleNextGrade = () => {
        setSliderGradeIndex(prev => grades.length ? (prev + 1) % grades.length : 0)
    }

    const handlePrevGrade = () => {
        setSliderGradeIndex(prev => grades.length ? (prev - 1 + grades.length) % grades.length : 0)
    }

    const fetchDashboardData = async () => {
        // Race-condition guard: teacher/admin dashboards depend on the grades lookup data
        // for the grade slider. On first mount `grades` is still empty, so defer the fetch
        // until it arrives — the effect re-fires because `grades` is in its dependency array.
        if ((!grades || grades.length === 0) && (roleNorm === 'teacher' || roleNorm === 'admin' || roleNorm === 'superadmin')) {
            dashboardRequestId.current++
            setDashboardData(null)
            setLeaderboardData([])
            console.log('[UnifiedDashboard] Deferring fetch until grades lookup data loads')
            setLoading(false)
            return
        }
        const requestId = ++dashboardRequestId.current
        try {
            setLoading(true)
            setError(null)

            // Build filter query string
            const queryParams = new URLSearchParams()
            
            if (filters.gradeId) queryParams.append('gradeId', filters.gradeId)
            if (filters.classId) queryParams.append('classId', filters.classId)
            if (filters.subjectId) queryParams.append('subjectId', filters.subjectId)
            if (filters.startDate) queryParams.append('startDate', filters.startDate)
            if (filters.endDate) queryParams.append('endDate', filters.endDate)
            if (selectedExamId) queryParams.append('examId', selectedExamId)

            let resolvedUserId = userId
            if (!resolvedUserId || resolvedUserId === 'undefined') {
                const token = localStorage.getItem('token') || sessionStorage.getItem('token')
                if (token) {
                    resolvedUserId = getUserIdFromToken(token)
                    if (!resolvedUserId) {
                        // Fall back to the long-form nameidentifier claim used by some identity providers
                        const payload = parseToken(token)
                        resolvedUserId = payload?.['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] || null
                    }
                }
            }

            // Null-guard: student/teacher endpoints embed the user ID — never build requests
            // like /dashboard/teacher/null. SuperAdmin-style roles use an ID-less endpoint.
            if (!resolvedUserId && (roleNorm === 'student' || roleNorm === 'teacher')) {
                setError('Unable to resolve user ID. Please log in again.')
                return
            }

            let endpoint = ''
            switch (roleNorm) {
                case 'student':
                    endpoint = `/dashboard/student/${resolvedUserId}`
                    break
                case 'teacher':
                    endpoint = `/dashboard/teacher/${resolvedUserId}`
                    break
                case 'superadmin':
                case 'admin':
                case 'board':
                    endpoint = '/dashboard/superadmin'
                    break
                default:
                    throw new Error('Invalid user role')
            }

            const response = await api.get(`${endpoint}?${queryParams.toString()}`)
            if (requestId !== dashboardRequestId.current) return
            const data = response.data

            console.log('[UnifiedDashboard] API Response:', data)
            console.log('[UnifiedDashboard] scoreDistribution:', data.scoreDistribution)
            console.log('[UnifiedDashboard] recentExams:', data.recentExams)
            console.log('[UnifiedDashboard] examBreakdown:', data.examBreakdown)

            // Transform data to match card component expectations while preserving original field names
            const transformedData = {
                ...data, // Spread to preserve all original fields including averagePassPercentage
                totalExams: data.totalExamsTaken || data.totalExamsCreated || data.totalExams || 0,
                scoreDistribution: data.scoreDistribution || [],
                recentExams: data.recentExams || [],
                examBreakdown: data.examBreakdown || []
            }

            // Common logic for all roles to set recent exams and default selection
            const recent = data.recentExams || []
            setRecentExams(recent)

            // If the currently selected exam is not in the new batch, or none selected, pick the first one
            // We only auto-select if there WAS a selected exam and it's now gone.
            // If it was null ("All Exams"), we keep it null to allow the slider to show if intended.
            if (recent.length > 0) {
                const currentStillExists = recent.some(e => String(e.examId) === String(selectedExamId))
                if (selectedExamId && !currentStillExists) {
                    setSelectedExamId(recent[0].examId)
                }
            } else {
                setSelectedExamId(null)
            }

            setDashboardData(transformedData)
        } catch (err) {
            if (requestId !== dashboardRequestId.current) return
            console.error('Error fetching dashboard data:', err)
            setError(err.response?.data?.message || 'Failed to load dashboard data')
        } finally {
            if (requestId === dashboardRequestId.current) setLoading(false)
        }
    }

    const fetchLeaderboard = async () => {
        const requestId = ++leaderboardRequestId.current
        const isCurrentRequest = () => requestId === leaderboardRequestId.current
        try {
            setLeaderboardLoading(!leaderboardData)

            // Priority: Fetch specific exam leaderboard if selected
            if (selectedExamId) {
                console.log(`[UnifiedDashboard] Fetching leaderboard for exam ${selectedExamId}`)
                const params = new URLSearchParams()

                if (filters.gradeId) params.append('gradeId', filters.gradeId)
                if (filters.classId) params.append('classId', filters.classId)
                if (filters.subjectId) params.append('subjectId', filters.subjectId)
                if (filters.startDate) params.append('startDate', filters.startDate)
                if (filters.endDate) params.append('endDate', filters.endDate)
                if (filters.groupBy) params.append('groupBy', filters.groupBy)

                try {
                    const response = await api.get(`/dashboard/leaderboard/${selectedExamId}?${params.toString()}`)
                    if (isCurrentRequest()) setLeaderboardData(response.data.topStudents || [])
                } catch (e) {
                    console.error("[UnifiedDashboard] Error fetching exam leaderboard:", e)
                    if (isCurrentRequest()) setLeaderboardData([])
                }
                if (isCurrentRequest()) setLeaderboardLoading(false)
                return
            }

            // Fallback: Aggregated Leaderboard (Combined)
            if (!selectedExamId) {
                // Allow Teachers, Admins, and Superadmins to see the combined leaderboard based on grade
                if (roleNorm === 'teacher' || roleNorm === 'admin' || roleNorm === 'superadmin') {
                    // Get current slider grade ID
                    const currentSliderGradeName = String(sliderGradeName).toLowerCase()
                    let gradeId = null

                    if (filters.gradeId) {
                        gradeId = filters.gradeId
                    } else if (sliderGradeRecord) {
                        gradeId = sliderGradeRecord.id ?? sliderGradeRecord.Id
                    }

                    if (gradeId) {
                        console.log(`[UnifiedDashboard] Fetching COMBINED leaderboard for grade ${gradeId} (${currentSliderGradeName})`)
                        try {
                            const params = new URLSearchParams()
                            params.append('gradeId', gradeId)
                            if (filters.classId) params.append('classId', filters.classId)
                            if (filters.subjectId) params.append('subjectId', filters.subjectId)
                            if (filters.startDate) params.append('startDate', filters.startDate)
                            if (filters.endDate) params.append('endDate', filters.endDate)
                            if (filters.groupBy) params.append('groupBy', filters.groupBy)

                            const response = await api.get(`/dashboard/leaderboard/combined?${params.toString()}`)
                            console.log(`[UnifiedDashboard] Combined leaderboard response for grade ${gradeId}:`, response.data)
                            if (isCurrentRequest()) setLeaderboardData(response.data.topStudents || [])
                        } catch (e) {
                            console.error("[UnifiedDashboard] Error fetching combined leaderboard:", e)
                            if (isCurrentRequest()) setLeaderboardData([])
                        }
                        if (isCurrentRequest()) setLeaderboardLoading(false)
                        return
                    } else {
                        console.warn(`[UnifiedDashboard] No gradeId found for slider grade '${currentSliderGradeName}'. Available grades:`, grades)
                    }
                }
            }

            if (isCurrentRequest()) {
                setLeaderboardData([])
                setLeaderboardLoading(false)
            }
        } catch (err) {
            console.error('Error fetching leaderboard:', err)
            if (isCurrentRequest()) {
                setLeaderboardData([])
                setLeaderboardLoading(false)
            }
        }
    }

    const handleFilterChange = (newFilters) => {
        setSelectedExamId(null) // Explicitly reset exam when global filters change
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
            minHeight: '100vh',
            animation: 'fadeIn 0.5s ease-out'
        }}>
            <style>
                {`
                    @keyframes fadeIn {
                        from { opacity: 0; transform: translateY(10px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    @keyframes slideProgress {
                        0% { transform: translateX(-100%); }
                        50% { transform: translateX(0); }
                        100% { transform: translateX(100%); }
                    }
                `}
            </style>

            {/* Top Loading Progress Bar (for background refreshes) */}
            {loading && dashboardData && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '3px',
                    zIndex: 9999,
                    overflow: 'hidden',
                    background: 'rgba(239, 68, 68, 0.1)'
                }}>
                    <div style={{
                        width: '40%',
                        height: '100%',
                        background: 'var(--primary)',
                        animation: 'slideProgress 1.5s infinite ease-in-out'
                    }}></div>
                </div>
            )}

            <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
                {/* Initial Loading State */}
                {loading && !dashboardData && (
                    <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        minHeight: '70vh'
                    }}>
                        <LoadingSpinner message="Optimizing your data..." />
                    </div>
                )}

                {/* Main Content (Optimistic) */}
                <div style={{
                    opacity: (!dashboardData && loading) ? 0 : 1,
                    transition: 'opacity 0.4s ease-in-out',
                    visibility: (!dashboardData && loading) ? 'hidden' : 'visible'
                }}>
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
                        {['teacher', 'admin', 'superadmin'].includes(roleNorm) && grades.length === 0 && (
                            <p role="status" style={{ color: 'var(--text-secondary)', marginTop: '0.75rem' }}>
                                Grade data is unavailable. Check the API/database connection to load statistics.
                            </p>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
                            <button
                                type="button"
                                onClick={() => setIsReportDialogOpen(true)}
                                disabled={!dashboardData || loading}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 0.9rem', border: '1px solid var(--primary)', borderRadius: '6px', background: 'var(--primary)', color: '#fff', fontWeight: 700, cursor: !dashboardData || loading ? 'not-allowed' : 'pointer', opacity: !dashboardData || loading ? 0.55 : 1 }}
                            >
                                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <path d="m7 10 5 5 5-5M12 15V3" />
                                </svg>
                                Export Report
                            </button>
                        </div>
                    </div>

                    {/* Filters */}
                    <DashboardFilters
                        onFilterChange={handleFilterChange}
                        userRole={userRole}
                        grades={dashboardGrades}
                        classes={dashboardClasses}
                        subjects={subjects}
                        allExams={allExams}
                        recentExams={recentExams}
                        selectedExamId={selectedExamId}
                        onExamChange={handleExamChange}
                        currentFilters={filters}
                    />

                    {/* Statistics Cards */}
                    <DashboardCards
                        data={dashboardData}
                        loading={loading}
                        userRole={userRole}
                        selectedExamId={selectedExamId}
                        leaderboard={leaderboardData}
                    />

                    <DashboardLeaderboard
                        leaderboard={leaderboardData}
                        loading={leaderboardLoading}
                        examTitle={
                            (allExams.find(e => String(e.examId || e.id) === String(selectedExamId)) ||
                                recentExams.find(e => String(e.examId) === String(selectedExamId)))?.title || 'Exam Leaderboard'
                        }
                        userRole={userRole}
                        currentUserId={roleNorm === 'student' ? parseInt(userId) : null}
                        onSeeAll={roleNorm === 'student' ? null : () => {
                            console.log('[UnifiedDashboard] See All Clicked. ExamId:', selectedExamId)
                            if (onSeeAllScores) {
                                if (selectedExamId) {
                                    onSeeAllScores(selectedExamId, null)
                                } else {
                                    onSeeAllScores(null, sliderGradeRecord?.id ?? sliderGradeRecord?.Id ?? null)
                                }
                            }
                        }}
                        // Slider Props
                        sliderGrade={sliderGradeName}
                        showSlider={grades.length > 0 && !selectedExamId && (roleNorm === 'teacher' || roleNorm === 'admin' || roleNorm === 'superadmin') && !filters.gradeId && !filters.classId}
                        onNextGrade={handleNextGrade}
                        onPrevGrade={handlePrevGrade}
                        groupBy={filters.groupBy}
                    />

                    {/* Performance Charts */}
                    <DashboardCharts
                        dashboardData={dashboardData}
                        userRole={userRole}
                        selectedExamId={selectedExamId}
                        filters={filters}
                    />
                    <ReportExportDialog
                        open={isReportDialogOpen}
                        onClose={() => setIsReportDialogOpen(false)}
                        report={dashboardReport}
                        appliedFilters={reportFilters}
                    />
                </div>
            </div>
        </div>
    )
}
