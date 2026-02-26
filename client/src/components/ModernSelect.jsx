import { useState, useEffect, useRef } from 'react'

export default function ModernSelect({
    options = [],
    value,
    onChange,
    label,
    placeholder = 'Select option',
    disabled = false,
    id
}) {
    const [isOpen, setIsOpen] = useState(false)
    const dropdownRef = useRef(null)

    // App Theme Colors (Red)
    const colors = {
        primary: '#dc2626', // Red-600
        primaryLight: 'rgba(220, 38, 38, 0.1)',
        primaryHover: '#b91c1c', // Red-700
        accent: '#ef4444', // Red-500
        text: '#1f2937',
        textMuted: '#6b7280',
        border: '#d1d5db',
        bg: '#ffffff'
    };

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

    const handleSelect = (optionValue) => {
        onChange({ target: { value: optionValue, id: id } })
        setIsOpen(false)
    }

    const selectedOption = options.find(opt => String(opt.value || opt.id) === String(value))

    return (
        <div className="modern-select" ref={dropdownRef} style={{ position: 'relative', width: '100%' }}>
            {label && (
                <label
                    className="form-label"
                    htmlFor={id}
                    style={{ display: 'block', fontSize: '.875rem', fontWeight: 600, color: '#374151', marginBottom: '.5rem' }}
                >
                    {label} <span className="required" style={{ color: colors.primary }}>*</span>
                </label>
            )}

            <button
                type="button"
                id={id}
                onClick={handleToggle}
                disabled={disabled}
                style={{
                    width: '100%',
                    padding: '.75rem 1rem',
                    border: `2px solid ${isOpen ? colors.primary : colors.border}`,
                    borderRadius: '12px',
                    fontSize: '1rem',
                    background: disabled ? '#f3f4f6' : 'white',
                    outline: 'none',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    opacity: disabled ? 0.6 : 1,
                    color: disabled ? colors.textMuted : colors.text,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '.75rem',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: isOpen ? `0 0 0 4px ${colors.primaryLight}` : 'none',
                    textAlign: 'left',
                    fontWeight: 500
                }}
            >
                <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {selectedOption ? (selectedOption.label || selectedOption.name || selectedOption.text) : placeholder}
                </span>
                <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.3s ease',
                        color: isOpen ? colors.primary : colors.textMuted
                    }}
                >
                    <polyline points="6 9 12 15 18 9" />
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
                        border: '1px solid #f3f4f6',
                        borderRadius: '16px',
                        background: 'white',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(0, 0, 0, 0.05)',
                        zIndex: 10000,
                        maxHeight: '300px',
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                        animation: 'selectFade 0.2s ease-out'
                    }}
                >
                    <style>{`
            @keyframes selectFade {
              from { opacity: 0; transform: translateY(-10px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
                    {options.length === 0 ? (
                        <div style={{ padding: '1.5rem', textAlign: 'center', color: colors.textMuted }}>
                            <p style={{ margin: 0, fontSize: '0.875rem' }}>No options available</p>
                        </div>
                    ) : (
                        options.map((option) => {
                            const optValue = option.value || option.id
                            const isSelected = String(optValue) === String(value)
                            return (
                                <div
                                    key={optValue}
                                    onClick={() => handleSelect(optValue)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: '.75rem',
                                        padding: '0.75rem 1rem',
                                        borderRadius: '10px',
                                        cursor: 'pointer',
                                        userSelect: 'none',
                                        transition: 'all 0.2s',
                                        background: isSelected ? colors.primaryLight : 'transparent',
                                        color: isSelected ? colors.primary : colors.text,
                                        fontWeight: isSelected ? 600 : 400
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!isSelected) e.currentTarget.style.background = '#f9fafb';
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!isSelected) e.currentTarget.style.background = 'transparent';
                                    }}
                                >
                                    <span style={{ fontSize: '.9375rem' }}>{option.label || option.name || option.text}</span>
                                    {isSelected && (
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                    )}
                                </div>
                            )
                        })
                    )}
                </div>
            )}
        </div>
    )
}
