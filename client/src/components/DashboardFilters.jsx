import { useState, useEffect } from 'react'
import api from '../api/axios'

export default function DashboardFilters({ onFilterChange, userRole, grades = [], classes = [], allExams = [], recentExams = [], selectedExamId = null, onExamChange, currentFilters = null }) {
  const [selectedGrade, setSelectedGrade] = useState(currentFilters?.gradeId || '')
  const [selectedClass, setSelectedClass] = useState(currentFilters?.classId || '')
  const [selectedGroupBy, setSelectedGroupBy] = useState(currentFilters?.groupBy || 'Student')
  const [startDate, setStartDate] = useState(currentFilters?.startDate || '')
  const [endDate, setEndDate] = useState(currentFilters?.endDate || '')
  const [activeFilters, setActiveFilters] = useState([])

  // Update local state if currentFilters changes (e.g. from parent)
  useEffect(() => {
    if (currentFilters) {
      if (currentFilters.gradeId !== undefined) setSelectedGrade(currentFilters.gradeId || '')
      if (currentFilters.classId !== undefined) setSelectedClass(currentFilters.classId || '')
      if (currentFilters.groupBy !== undefined) setSelectedGroupBy(currentFilters.groupBy || 'Student')
      if (currentFilters.startDate !== undefined) setStartDate(currentFilters.startDate || '')
      if (currentFilters.endDate !== undefined) setEndDate(currentFilters.endDate || '')
    }
  }, [currentFilters])

  const hasExamFilter = ((allExams && allExams.length > 0) || recentExams.length > 0)

  // Classes are filtered based on selected grade
  const filteredClasses = selectedGrade
    ? classes.filter(c => !c.gradeId || String(c.gradeId) === String(selectedGrade))
    : classes



  // Filter exams based on grade and class
  const filteredExams = (allExams && allExams.length > 0 ? allExams : recentExams)
    .filter(exam => {
      if (selectedGrade && String(exam.gradeId) !== String(selectedGrade)) return false
      if (selectedClass) {
        const matchLegacy = String(exam.classId) === String(selectedClass)
        const classIds = exam.classIds || exam.ClassIds || []
        const matchArray = classIds.some(id => String(id) === String(selectedClass))
        if (!matchLegacy && !matchArray) return false
      }
      return true
    })

  const handleApplyFilters = () => {
    const filters = {
      gradeId: selectedGrade ? parseInt(selectedGrade) : null,
      classId: selectedClass ? parseInt(selectedClass) : null,
      startDate: startDate || null,
      endDate: endDate || null,
      groupBy: selectedGroupBy
    }

    // Build active filters summary
    const active = []
    if (selectedGrade) {
      const grade = grades.find(g => g.id === parseInt(selectedGrade))
      if (grade) active.push(grade.gradeName || grade.name)
    }
    if (selectedGroupBy === 'Class') {
      active.push('Group by Class')
    }
    if (selectedClass) {
      const classItem = classes.find(c => c.id === parseInt(selectedClass))
      if (classItem) active.push(classItem.className || classItem.name)
    }
    if (startDate && endDate) {
      active.push(`${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`)
    } else if (startDate) {
      active.push(`From ${new Date(startDate).toLocaleDateString()}`)
    } else if (endDate) {
      active.push(`Until ${new Date(endDate).toLocaleDateString()}`)
    }

    setActiveFilters(active)
    onFilterChange(filters)
  }

  const handleClearFilters = () => {
    setSelectedGrade('')
    setSelectedClass('')
    setSelectedGroupBy('Student')
    setStartDate('')
    setEndDate('')
    setActiveFilters([])
    onFilterChange({
      gradeId: null,
      classId: null,
      startDate: null,
      endDate: null,
      groupBy: 'Student'
    })
  }

  return (
    <div style={{
      background: 'var(--bg-main)',
      borderRadius: '16px',
      padding: '1.5rem',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
      marginBottom: '1.5rem',
      border: '1px solid #f1f3f5'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        marginBottom: '1.5rem'
      }}>
        <svg style={{ width: '24px', height: '24px', fill: 'var(--primary)' }} viewBox="0 0 24 24">
          <path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z" />
        </svg>
        <h3 style={{
          fontSize: '1.25rem',
          fontWeight: '600',
          color: 'var(--text-primary)',
          margin: 0
        }}>
          Filters
        </h3>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '1rem'
      }}>
        {/* Grade Filter */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '0.875rem',
            fontWeight: '500',
            color: 'var(--text-secondary)',
            marginBottom: '0.5rem'
          }}>
            Grade
          </label>
          <select
            value={selectedGrade}
            onChange={(e) => {
              setSelectedGrade(e.target.value)
              setSelectedClass('') // Reset class when grade changes
            }}
            style={{
              width: '100%',
              padding: '0.625rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <option value="">All Grades</option>
            {grades.map(grade => (
              <option key={grade.id} value={grade.id}>{grade.gradeName || grade.name}</option>
            ))}
          </select>
        </div>

        {/* Class Filter */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '0.875rem',
            fontWeight: '500',
            color: 'var(--text-secondary)',
            marginBottom: '0.5rem'
          }}>
            Class
          </label>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            disabled={!selectedGrade && filteredClasses.length === 0}
            style={{
              width: '100%',
              padding: '0.625rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
              opacity: !selectedGrade && filteredClasses.length === 0 ? 0.5 : 1
            }}
          >
            <option value="">All Classes</option>
            {filteredClasses.map(classItem => (
              <option key={classItem.id} value={classItem.id}>{classItem.className || classItem.name}</option>
            ))}
          </select>
        </div>

        {/* Start Date Filter */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '0.875rem',
            fontWeight: '500',
            color: 'var(--text-secondary)',
            marginBottom: '0.5rem'
          }}>
            Start Date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{
              width: '100%',
              padding: '0.625rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
              cursor: 'pointer'
            }}
          />
        </div>

        {/* End Date Filter */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '0.875rem',
            fontWeight: '500',
            color: 'var(--text-secondary)',
            marginBottom: '0.5rem'
          }}>
            End Date
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            min={startDate}
            style={{
              width: '100%',
              padding: '0.625rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
              cursor: 'pointer'
            }}
          />
        </div>

        {/* Group By Filter */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '0.875rem',
            fontWeight: '500',
            color: 'var(--text-secondary)',
            marginBottom: '0.5rem'
          }}>
            Group By
          </label>
          <select
            value={selectedGroupBy}
            onChange={(e) => setSelectedGroupBy(e.target.value)}
            style={{
              width: '100%',
              padding: '0.625rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <option value="Student">Students</option>
            <option value="Class">Class</option>
          </select>
        </div>
      </div>

      <div style={{
        display: 'flex',
        gap: '1rem',
        flexWrap: 'wrap',
        alignItems: 'flex-end'
      }}>
        {/* Exam Filter */}
        {hasExamFilter ? (
          <div style={{
            flex: '2 1 420px'
          }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: 'var(--text-secondary)',
              marginBottom: '0.5rem'
            }}>
              Selected Exam
            </label>
            <select
              value={selectedExamId || ''}
              onChange={(e) => {
                if (onExamChange) {
                  onExamChange(e)
                }
              }}
              style={{
                width: '100%',
                padding: '0.625rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <option value="">All Exams</option>
              {filteredExams.map(exam => (
                <option key={exam.examId || exam.id} value={exam.examId || exam.id}>
                  {exam.title}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: '0.75rem',
          flexWrap: 'wrap',
          justifyContent: 'flex-end',
          flex: '1 1 260px'
        }}>
          <button
            onClick={handleApplyFilters}
            style={{
              padding: '0.625rem 1.5rem',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--primary)',
              color: 'white',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'var(--primary-dark)'
              e.target.style.transform = 'translateY(-1px)'
              e.target.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)'
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'var(--primary)'
              e.target.style.transform = 'translateY(0)'
              e.target.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.3)'
            }}
          >
            Apply Filters
          </button>

          <button
            onClick={handleClearFilters}
            style={{
              padding: '0.625rem 1.5rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'var(--bg-surface-hover)'
              e.target.style.borderColor = 'var(--text-secondary)'
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'transparent'
              e.target.style.borderColor = 'var(--border-color)'
            }}
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Active Filters Summary */}
      {activeFilters.length > 0 && (
        <div style={{
          marginTop: '1rem',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-color)'
        }}>
          <div style={{
            fontSize: '0.75rem',
            fontWeight: '500',
            color: 'var(--text-secondary)',
            marginBottom: '0.25rem',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Active Filters
          </div>
          <div style={{
            fontSize: '0.875rem',
            color: 'var(--text-primary)',
            fontWeight: '500'
          }}>
            {activeFilters.join(' • ')}
          </div>
        </div>
      )}
    </div>
  )
}
