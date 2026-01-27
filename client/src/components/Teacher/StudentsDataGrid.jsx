import { useState, useMemo, useEffect, memo } from 'react'

const StudentRow = memo(({ student, selectedExamId, selectedExamTitle, onStudentClick }) => {
    const getExamScore = (s, eId) => {
        if (!s.quizScores || !eId) return null
        const score = s.quizScores[String(eId)]
        return score !== undefined ? score : null
    }

    const getAverageScore = (s) => {
        const scores = Object.values(s.quizScores || {})
        if (scores.length === 0) return 0
        return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    }

    const examScore = selectedExamId ? getExamScore(student, selectedExamId) : null
    const avgScore = getAverageScore(student)

    return (
        <tr
            style={{ borderBottom: '1px solid #f3f4f6', transition: 'background 0.1s' }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
        >
            <td style={{ padding: '1rem 1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: 700,
                        fontSize: '0.9rem'
                    }}>
                        {student.initials}
                    </div>
                    <div>
                        <div style={{ fontWeight: 600, color: '#111827' }}>{student.name}</div>
                        <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>ID: {student.id}</div>
                    </div>
                </div>
            </td>
            <td style={{ padding: '1rem 1.5rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span style={{
                        padding: '0.2rem 0.6rem',
                        borderRadius: '99px',
                        background: '#eff6ff',
                        color: '#1d4ed8',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        border: '1px solid #dbeafe'
                    }}>
                        {student.grade}
                    </span>
                    <span style={{
                        padding: '0.2rem 0.6rem',
                        borderRadius: '99px',
                        background: '#f3f4f6',
                        color: '#374151',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        border: '1px solid #e5e7eb'
                    }}>
                        Class {student.class}
                    </span>
                </div>
            </td>
            <td style={{ padding: '1rem 1.5rem' }}>
                <div style={{ display: 'flex', gap: '1.5rem' }}>
                    <div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Avg Score</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: avgScore >= 50 ? '#059669' : '#dc2626' }}>{avgScore}%</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>Exams</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#374151' }}>{Object.keys(student.quizScores || {}).length}</div>
                    </div>
                </div>
            </td>
            {selectedExamId && (
                <td style={{ padding: '1rem 1.5rem', textAlign: 'center', background: '#fffafa' }}>
                    {examScore !== null ? (
                        <div style={{
                            display: 'inline-block',
                            padding: '0.4rem 1rem',
                            borderRadius: '8px',
                            background: examScore >= 50 ? '#dcfce7' : '#fee2e2',
                            color: examScore >= 50 ? '#16a34a' : '#991b1b',
                            fontWeight: 700,
                            fontSize: '1rem',
                            border: `1px solid ${examScore >= 50 ? '#86efac' : '#fecaca'}`
                        }}>
                            {examScore}%
                        </div>
                    ) : (
                        <span style={{ fontSize: '0.9rem', color: '#9ca3af', fontStyle: 'italic' }}>N/A</span>
                    )}
                </td>
            )}
            <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                <button
                    onClick={() => onStudentClick(student.id)}
                    style={{
                        padding: '0.5rem 1rem',
                        background: 'white',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        color: '#374151',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.borderColor = '#9ca3af'; e.currentTarget.style.background = '#f9fafb' }}
                    onMouseOut={(e) => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.background = 'white' }}
                >
                    View Profile
                </button>
            </td>
        </tr>
    )
})

export default function StudentsDataGrid({ students, allExams, initialExamId, initialGrade, onStudentClick }) {
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedGrade, setSelectedGrade] = useState(initialGrade || '')
    const [selectedClass, setSelectedClass] = useState('')
    const [selectedExamId, setSelectedExamId] = useState(initialExamId || '')

    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })

    // Sync state with prop if it changes (e.g. from "See All" button)
    useEffect(() => {
        if (initialExamId !== undefined) {
            setSelectedExamId(initialExamId)
        }
        if (initialGrade !== undefined) {
            setSelectedGrade(initialGrade)
        }
    }, [initialExamId, initialGrade])

    // Get unique Grades and Classes for filters
    const grades = useMemo(() => [...new Set(students.map(s => s.grade).filter(Boolean))].sort(), [students])
    const classes = useMemo(() => {
        let filtered = students
        if (selectedGrade) {
            filtered = filtered.filter(s => s.grade === selectedGrade)
        }
        return [...new Set(filtered.map(s => s.class).filter(Boolean))].sort()
    }, [students, selectedGrade])

    // Filter Logic
    const filteredStudents = useMemo(() => {
        let result = students.filter(student => {
            // Search
            const searchLower = searchQuery.toLowerCase()
            const matchSearch = (
                student.name.toLowerCase().includes(searchLower) ||
                (student.email && student.email.toLowerCase().includes(searchLower))
            )
            if (!matchSearch) return false

            // Grade
            if (selectedGrade && student.grade !== selectedGrade) return false

            // Class
            if (selectedClass && student.class !== selectedClass) return false

            return true
        })

        // Sorting
        if (sortConfig.key) {
            result.sort((a, b) => {
                let aValue, bValue

                if (sortConfig.key === 'performance') {
                    // Calculate avg score for sorting
                    const getAvg = (s) => {
                        const sc = Object.values(s.quizScores || {})
                        return sc.length ? sc.reduce((x, y) => x + y, 0) / sc.length : -1
                    }
                    aValue = getAvg(a)
                    bValue = getAvg(b)
                } else {
                    aValue = a[sortConfig.key] || ''
                    bValue = b[sortConfig.key] || ''
                }

                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1
                return 0
            })
        }

        return result
    }, [students, searchQuery, selectedGrade, selectedClass, sortConfig])

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }))
    }
    // Helper to get score
    const getExamScore = (student, examId) => {
        if (!student.quizScores || !examId) return null;
        // quizScores is keyed by string examId
        const score = student.quizScores[String(examId)];
        return score !== undefined ? score : null;
    }

    // Helper to get average
    const getAverageScore = (student) => {
        const scores = Object.values(student.quizScores || {})
        if (scores.length === 0) return 0
        return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    }

    const selectedExamTitle = useMemo(() => {
        if (!selectedExamId) return null
        const ex = allExams.find(e => String(e.examId) === String(selectedExamId) || String(e.id) === String(selectedExamId))
        return ex ? ex.title : 'Selected Exam'
    }, [selectedExamId, allExams])

    return (
        <div style={{ padding: '2rem', background: '#f9fafb', minHeight: '100vh' }}>
            <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
                <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <h1 style={{ fontSize: '2rem', fontWeight: '700', color: '#1f2937', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <svg style={{ width: '32px', height: '32px', fill: '#dc2626' }} viewBox="0 0 24 24">
                                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                            </svg>
                            Students Directory (Redesigned)
                        </h1>
                        <p style={{ fontSize: '1rem', color: '#6b7280', margin: 0 }}>Manage and view student performance across all exams</p>
                    </div>
                </div>

                {/* Filters Bar */}
                <div style={{
                    background: 'white',
                    borderRadius: '12px',
                    padding: '1.25rem',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '1rem',
                    alignItems: 'center',
                    border: '1px solid #e5e7eb'
                }}>
                    {/* Search */}
                    <div style={{ flex: 1, minWidth: '250px', position: 'relative' }}>
                        <svg style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '20px', height: '20px', fill: '#9ca3af' }} viewBox="0 0 24 24">
                            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Search by name..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                                border: '1px solid #d1d5db',
                                borderRadius: '8px',
                                fontSize: '0.95rem',
                                outline: 'none',
                                transition: 'border-color 0.2s',
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#dc2626'}
                            onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                        />
                    </div>

                    {/* Grade Filter */}
                    <div style={{ width: '180px' }}>
                        <select
                            value={selectedGrade}
                            onChange={(e) => { setSelectedGrade(e.target.value); setSelectedClass(''); }}
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                border: '1px solid #d1d5db',
                                borderRadius: '8px',
                                background: 'white',
                                fontSize: '0.95rem',
                                cursor: 'pointer',
                                outline: 'none'
                            }}
                        >
                            <option value="">All Grades</option>
                            {grades.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                    </div>

                    {/* Class Filter */}
                    <div style={{ width: '180px' }}>
                        <select
                            value={selectedClass}
                            onChange={(e) => setSelectedClass(e.target.value)}
                            disabled={!selectedGrade && classes.length === 0}
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                border: '1px solid #d1d5db',
                                borderRadius: '8px',
                                background: 'white',
                                fontSize: '0.95rem',
                                cursor: 'pointer',
                                outline: 'none',
                                opacity: (!selectedGrade && classes.length === 0) ? 0.6 : 1
                            }}
                        >
                            <option value="">All Classes</option>
                            {classes.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    {/* Exam Filter */}
                    <div style={{ width: '250px' }}>
                        <select
                            value={selectedExamId}
                            onChange={(e) => setSelectedExamId(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                border: '1px solid #d1d5db',
                                borderRadius: '8px',
                                background: selectedExamId ? '#fef2f2' : 'white',
                                color: selectedExamId ? '#991b1b' : 'inherit',
                                fontSize: '0.95rem',
                                cursor: 'pointer',
                                outline: 'none',
                                fontWeight: selectedExamId ? 600 : 400,
                                borderColor: selectedExamId ? '#fecaca' : '#d1d5db'
                            }}
                        >
                            <option value="">Show Specific Exam Score...</option>
                            {allExams.map(e => (
                                <option key={e.id || e.examId} value={e.id || e.examId}>{e.title}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Data Grid Table */}
                <div style={{
                    background: 'white',
                    borderRadius: '12px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                    overflow: 'hidden',
                    border: '1px solid #e5e7eb'
                }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
                            <thead>
                                <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                                    <th style={{ textAlign: 'left', padding: '1rem 1.5rem', fontSize: '0.85rem', color: '#6b7280', fontWeight: '700', textTransform: 'uppercase' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }} onClick={() => handleSort('name')}>
                                            Student
                                            {sortConfig.key === 'name' && (
                                                <span style={{ fontSize: '0.8rem' }}>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                            )}
                                        </div>
                                    </th>
                                    <th style={{ textAlign: 'left', padding: '1rem 1.5rem', fontSize: '0.85rem', color: '#6b7280', fontWeight: '700', textTransform: 'uppercase' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }} onClick={() => handleSort('grade')}>
                                            Grade & Class
                                            {sortConfig.key === 'grade' && (
                                                <span style={{ fontSize: '0.8rem' }}>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                            )}
                                        </div>
                                    </th>
                                    <th style={{ textAlign: 'left', padding: '1rem 1.5rem', fontSize: '0.85rem', color: '#6b7280', fontWeight: '700', textTransform: 'uppercase' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }} onClick={() => handleSort('performance')}>
                                            Performance
                                            {sortConfig.key === 'performance' && (
                                                <span style={{ fontSize: '0.8rem' }}>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                            )}
                                        </div>
                                    </th>
                                    {selectedExamId && (
                                        <th style={{ textAlign: 'center', padding: '1rem 1.5rem', fontSize: '0.85rem', color: '#dc2626', fontWeight: '700', textTransform: 'uppercase', background: '#fef2f2' }}>
                                            {selectedExamTitle}
                                        </th>
                                    )}
                                    <th style={{ textAlign: 'right', padding: '1rem 1.5rem', fontSize: '0.85rem', color: '#6b7280', fontWeight: '700', textTransform: 'uppercase' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredStudents.length === 0 ? (
                                    <tr>
                                        <td colSpan={selectedExamId ? 5 : 4} style={{ padding: '4rem', textAlign: 'center', color: '#6b7280' }}>
                                            <div style={{ marginBottom: '1rem' }}>
                                                <svg style={{ width: '48px', height: '48px', fill: '#d1d5db' }} viewBox="0 0 24 24">
                                                    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                                                </svg>
                                            </div>
                                            <div style={{ fontSize: '1.1rem', fontWeight: 500, color: '#374151' }}>No students found</div>
                                            <p style={{ margin: 0 }}>Try adjusting your search or filters</p>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredStudents.map(student => (
                                        <StudentRow
                                            key={student.id}
                                            student={student}
                                            selectedExamId={selectedExamId}
                                            selectedExamTitle={selectedExamTitle}
                                            onStudentClick={onStudentClick}
                                        />
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    {/* Footer / Pagination (simplified) */}
                    <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e5e7eb', background: '#f9fafb', color: '#6b7280', fontSize: '0.9rem' }}>
                        Showing {filteredStudents.length} students
                    </div>
                </div>
            </div>
        </div>
    )
}
