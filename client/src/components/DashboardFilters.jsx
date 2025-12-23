import { useState, useEffect } from 'react'
import api from '../api/axios'

export default function DashboardFilters({ onFilterChange, userRole }) {
  const [grades, setGrades] = useState([])
  const [classes, setClasses] = useState([])
  const [selectedGrade, setSelectedGrade] = useState('')
  const [selectedClass, setSelectedClass] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [activeFilters, setActiveFilters] = useState([])

  // Fetch grades and classes from backend
  useEffect(() => {
    // Hardcoded filters as per user request
    setGrades([
      { id: 10, name: 'Junior' },
      { id: 11, name: 'Wheeler' },
      { id: 12, name: 'Senior' }
    ])
    setClasses([
      { id: 1, name: 'A', gradeId: null },
      { id: 2, name: 'B', gradeId: null },
      { id: 3, name: 'C', gradeId: null },
      { id: 4, name: 'D', gradeId: null }
    ])
  }, [])

  // Classes are constant for all grades now
  const filteredClasses = classes

  const handleApplyFilters = () => {
    const filters = {
      gradeId: selectedGrade ? parseInt(selectedGrade) : null,
      classId: selectedClass ? parseInt(selectedClass) : null,
      startDate: startDate || null,
      endDate: endDate || null
    }

    // Build active filters summary
    const active = []
    if (selectedGrade) {
      const grade = grades.find(g => g.id === parseInt(selectedGrade))
      if (grade) active.push(grade.name)
    }
    if (selectedClass) {
      const classItem = classes.find(c => c.id === parseInt(selectedClass))
      if (classItem) active.push(classItem.name)
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
    setStartDate('')
    setEndDate('')
    setActiveFilters([])
    onFilterChange({
      gradeId: null,
      classId: null,
      startDate: null,
      endDate: null
    })
  }

  return (
    <div style={{
      background: 'var(--bg-main)',
      borderRadius: '16px',
      padding: '1.5rem',
      boxShadow: 'var(--shadow-sm)',
      marginBottom: '2rem'
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
              <option key={grade.id} value={grade.id}>{grade.name}</option>
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
              <option key={classItem.id} value={classItem.id}>{classItem.name}</option>
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
      </div>

      {/* Action Buttons */}
      <div style={{
        display: 'flex',
        gap: '0.75rem',
        flexWrap: 'wrap'
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
