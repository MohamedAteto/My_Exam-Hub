import { useEffect, useState } from 'react'

export default function DashboardCards({ data, loading, userRole }) {
    const [animatedTotal, setAnimatedTotal] = useState(0)
    const [animatedPass, setAnimatedPass] = useState(0)
    const [animatedFail, setAnimatedFail] = useState(0)

    // Animate numbers when data changes
    useEffect(() => {
        if (!loading && data) {
            animateValue(0, data.totalExams || 0, 1000, setAnimatedTotal)
            animateValue(0, data.passPercentage || 0, 1000, setAnimatedPass)
            animateValue(0, data.failPercentage || 0, 1000, setAnimatedFail)
        }
    }, [data, loading])

    const animateValue = (start, end, duration, setter) => {
        const range = end - start
        const increment = range / (duration / 16)
        let current = start

        const timer = setInterval(() => {
            current += increment
            if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
                current = end
                clearInterval(timer)
            }
            setter(Math.round(current * 100) / 100)
        }, 16)
    }

    const getRoleSpecificLabels = () => {
        switch (userRole) {
            case 'Teacher':
                return {
                    total: 'Total Exams Created',
                    pass: 'Average Pass %',
                    fail: 'Average Fail %'
                }
            case 'Superadmin':
            case 'Admin':
                return {
                    total: 'Total Exams',
                    pass: 'Overall Pass %',
                    fail: 'Overall Fail %'
                }
            default: // Student
                return {
                    total: 'Total Exams Taken',
                    pass: 'Pass %',
                    fail: 'Fail %'
                }
        }
    }

    const labels = getRoleSpecificLabels()

    if (loading) {
        return (
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '1.5rem',
                marginBottom: '2rem'
            }}>
                {[1, 2, 3].map(i => (
                    <div key={i} style={{
                        background: 'var(--bg-main)',
                        borderRadius: '16px',
                        padding: '1.5rem',
                        boxShadow: 'var(--shadow-sm)'
                    }}>
                        <div style={{
                            height: '1rem',
                            width: '60%',
                            background: 'linear-gradient(90deg, var(--bg-surface-hover) 25%, var(--bg-surface) 50%, var(--bg-surface-hover) 75%)',
                            backgroundSize: '200% 100%',
                            animation: 'shimmer 1.5s infinite',
                            borderRadius: '4px',
                            marginBottom: '1rem'
                        }}></div>
                        <div style={{
                            height: '3rem',
                            width: '40%',
                            background: 'linear-gradient(90deg, var(--bg-surface-hover) 25%, var(--bg-surface) 50%, var(--bg-surface-hover) 75%)',
                            backgroundSize: '200% 100%',
                            animation: 'shimmer 1.5s infinite',
                            borderRadius: '4px'
                        }}></div>
                    </div>
                ))}
            </div>
        )
    }

    const cards = [
        {
            label: labels.total,
            value: animatedTotal,
            icon: (
                <svg viewBox="0 0 24 24">
                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
                </svg>
            ),
            color: 'var(--primary)',
            bgColor: 'rgba(59, 130, 246, 0.1)'
        },
        {
            label: labels.pass,
            value: animatedPass,
            suffix: '%',
            icon: (
                <svg viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
            ),
            color: '#10b981',
            bgColor: 'rgba(16, 185, 129, 0.1)'
        },
        {
            label: labels.fail,
            value: animatedFail,
            suffix: '%',
            icon: (
                <svg viewBox="0 0 24 24">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
            ),
            color: '#ef4444',
            bgColor: 'rgba(239, 68, 68, 0.1)'
        }
    ]

    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.5rem',
            marginBottom: '2rem'
        }}>
            {cards.map((card, index) => (
                <div
                    key={index}
                    style={{
                        background: 'var(--bg-main)',
                        borderRadius: '16px',
                        padding: '1.5rem',
                        boxShadow: 'var(--shadow-sm)',
                        border: '2px solid transparent',
                        transition: 'all 0.3s ease',
                        cursor: 'default'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = card.color
                        e.currentTarget.style.transform = 'translateY(-4px)'
                        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,.12)'
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'transparent'
                        e.currentTarget.style.transform = 'translateY(0)'
                        e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
                    }}
                >
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '1rem'
                    }}>
                        <div style={{
                            fontSize: '0.875rem',
                            fontWeight: '500',
                            color: 'var(--text-secondary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                        }}>
                            {card.label}
                        </div>
                        <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '10px',
                            background: card.bgColor,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <div style={{ width: '24px', height: '24px', fill: card.color }}>
                                {card.icon}
                            </div>
                        </div>
                    </div>
                    <div style={{
                        fontSize: '2.5rem',
                        fontWeight: '700',
                        color: card.color,
                        lineHeight: 1
                    }}>
                        {card.value.toFixed(card.suffix ? 2 : 0)}{card.suffix || ''}
                    </div>
                </div>
            ))}
        </div>
    )
}
