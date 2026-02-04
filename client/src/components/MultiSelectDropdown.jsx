import { useState, useEffect, useRef } from 'react'

export default function MultiSelectDropdown({
  options = [],
  selectedIds = [],
  onChange,
  label = 'Select Options',
  placeholder = 'Select options',
  disabled = false,
  id
}) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleToggle = (e) => {
    if (disabled) return
    e.preventDefault()
    setIsOpen(!isOpen)
  }

  const handleSelectAll = (checked) => {
    if (checked) {
      const allIds = options.map(opt => opt.value || opt.id)
      onChange(allIds)
    } else {
      onChange([])
    }
  }

  const handleSelectOne = (optionId, checked) => {
    let newSelected = [...selectedIds]
    if (checked) {
      // Avoid duplicates
      if (!newSelected.includes(optionId)) {
        newSelected.push(optionId)
      }
    } else {
      newSelected = newSelected.filter(id => id !== optionId)
    }
    onChange(newSelected)
  }

  // Derived state
  const isAllSelected = options.length > 0 && selectedIds.length === options.length

  // Format display text
  const getDisplayText = () => {
    if (disabled) return 'Disabled'
    if (selectedIds.length === 0) return placeholder

    // Find selected option objects to get their labels
    const selectedOptions = options.filter(opt => selectedIds.includes(opt.value || opt.id))

    if (selectedOptions.length === 0) return placeholder
    if (selectedOptions.length <= 2) {
      return selectedOptions.map(o => o.label || o.name).join(', ')
    }
    return `${selectedOptions.length} ${label.toLowerCase()} selected`
  }

  return (
    <div className="multi-select-dropdown" ref={dropdownRef} style={{ position: 'relative' }}>
      <label
        className="form-label"
        htmlFor={id}
        style={{ display: 'block', fontSize: '.875rem', fontWeight: 600, color: '#374151', marginBottom: '.5rem' }}
      >
        {label} {disabled ? '' : <span className="required" style={{ color: '#dc2626' }}>*</span>}
      </label>

      <button
        type="button"
        id={id}
        onClick={handleToggle}
        disabled={disabled}
        style={{
          width: '100%',
          padding: '.75rem',
          border: `2px solid ${isOpen ? '#3b82f6' : '#d1d5db'}`,
          borderRadius: '8px',
          fontSize: '1rem',
          background: disabled ? '#f3f4f6' : 'white',
          outline: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          color: disabled ? '#9ca3af' : '#1f2937',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '.75rem',
          transition: 'all 0.2s',
          boxShadow: isOpen ? '0 0 0 4px rgba(59, 130, 246, 0.1)' : 'none',
          textAlign: 'left'
        }}
      >
        <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {getDisplayText()}
        </span>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease', opacity: 0.5 }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {isOpen && !disabled && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            right: 0,
            padding: '.5rem',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            background: 'white',
            boxShadow: '0 10px 40px -10px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
            zIndex: 999999, // Absolute top
            maxHeight: '400px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px'
          }}
        >
          {options.length === 0 ? (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#6b7280' }}>
              <p style={{ margin: 0, fontSize: '0.875rem' }}>No options found</p>
            </div>
          ) : (
            <>
              <label
                className="dropdown-item"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '.75rem',
                  padding: '.75rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  userSelect: 'none',
                  transition: 'background 0.15s',
                  background: isAllSelected ? '#f0f9ff' : 'transparent',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                onMouseLeave={(e) => e.currentTarget.style.background = isAllSelected ? '#f0f9ff' : 'transparent'}
              >
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    style={{
                      width: '18px',
                      height: '18px',
                      accentColor: '#3b82f6',
                      cursor: 'pointer'
                    }}
                  />
                </div>
                <span style={{ fontSize: '.9rem', fontWeight: 600, color: '#111827' }}>Select All</span>
              </label>

              <div style={{ height: '1px', background: '#f3f4f6', margin: '.25rem 0' }} />

              {options.map((option) => {
                const optId = option.value || option.id
                const isSelected = selectedIds.includes(optId)
                return (
                  <label
                    key={optId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '.75rem',
                      padding: '.75rem',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      userSelect: 'none',
                      transition: 'background 0.15s',
                      background: isSelected ? '#fff7ed' : 'transparent',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                    onMouseLeave={(e) => e.currentTarget.style.background = isSelected ? '#fff7ed' : 'transparent'}
                  >
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => handleSelectOne(optId, e.target.checked)}
                        style={{
                          width: '18px',
                          height: '18px',
                          accentColor: '#f97316',
                          cursor: 'pointer'
                        }}
                      />
                    </div>
                    <span style={{ fontSize: '.9rem', color: isSelected ? '#9a3412' : '#374151', fontWeight: isSelected ? 500 : 400 }}>
                      {option.label || option.name}
                    </span>
                  </label>
                )
              })}
            </>
          )}
        </div>
      )}
    </div>
  )
}
