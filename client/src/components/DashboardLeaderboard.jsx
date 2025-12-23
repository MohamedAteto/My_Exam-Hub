export default function DashboardLeaderboard({ leaderboard, loading, examTitle, userRole, currentUserId }) {
    if (loading) {
        return (
            <div style={{
                background: 'var(--bg-main)',
                borderRadius: '16px',
                padding: '1.5rem',
                boxShadow: 'var(--shadow-sm)'
            }}>
                <div style={{
                    height: '1.5rem',
                    width: '200px',
                    background: 'linear-gradient(90deg, var(--bg-surface-hover) 25%, var(--bg-surface) 50%, var(--bg-surface-hover) 75%)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 1.5s infinite',
                    borderRadius: '4px',
                    marginBottom: '1.5rem'
                }}></div>
                {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} style={{
                        height: '60px',
                        background: 'linear-gradient(90deg, var(--bg-surface-hover) 25%, var(--bg-surface) 50%, var(--bg-surface-hover) 75%)',
                        backgroundSize: '200% 100%',
                        animation: 'shimmer 1.5s infinite',
                        borderRadius: '8px',
                        marginBottom: '0.75rem'
                    }}></div>
                ))}
            </div>
        )
    }

    if (!leaderboard || leaderboard.length === 0) {
        return (
            <div style={{
                background: 'var(--bg-main)',
                borderRadius: '16px',
                padding: '3rem 1.5rem',
                boxShadow: 'var(--shadow-sm)',
                textAlign: 'center'
            }}>
                <svg style={{ width: '64px', height: '64px', fill: 'var(--text-light)', margin: '0 auto 1rem' }} viewBox="0 0 24 24">
                    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                </svg>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                    No Leaderboard Data
                </h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
                    Complete an exam to see the leaderboard
                </p>
            </div>
        )
    }

    const getMedalColor = (rank) => {
        switch (rank) {
            case 1:
                return { bg: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)', border: '#f59e0b', emoji: '🥇' }
            case 2:
                return { bg: 'linear-gradient(135deg, #d1d5db 0%, #9ca3af 100%)', border: '#9ca3af', emoji: '🥈' }
            case 3:
                return { bg: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', border: '#ea580c', emoji: '🥉' }
            default:
                return { bg: 'var(--bg-surface)', border: 'var(--border-color)', emoji: null }
        }
    }

    return (
        <div style={{
            background: 'var(--bg-main)',
            borderRadius: '16px',
            padding: '1.5rem',
            boxShadow: 'var(--shadow-sm)'
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                marginBottom: '1.5rem'
            }}>
                <svg style={{ width: '24px', height: '24px', fill: 'var(--primary)' }} viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                <div>
                    <h3 style={{
                        fontSize: '1.25rem',
                        fontWeight: '600',
                        color: 'var(--text-primary)',
                        margin: 0
                    }}>
                        Leaderboard
                    </h3>
                    {examTitle && (
                        <p style={{
                            fontSize: '0.875rem',
                            color: 'var(--text-secondary)',
                            margin: '0.25rem 0 0 0'
                        }}>
                            {examTitle}
                        </p>
                    )}
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {leaderboard.map((entry, index) => {
                    const medal = getMedalColor(entry.rank)
                    const isCurrentUser = currentUserId && entry.studentId === currentUserId
                    const isTopThree = entry.rank <= 3

                    return (
                        <div
                            key={entry.studentId || index}
                            style={{
                                background: isTopThree ? medal.bg : 'var(--bg-surface)',
                                border: `2px solid ${isCurrentUser ? 'var(--primary)' : medal.border}`,
                                borderRadius: '12px',
                                padding: '1rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1rem',
                                transition: 'all 0.3s ease',
                                position: 'relative',
                                overflow: 'hidden'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateX(4px)'
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,.1)'
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateX(0)'
                                e.currentTarget.style.boxShadow = 'none'
                            }}
                        >
                            {/* Rank Badge */}
                            <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '10px',
                                background: isTopThree ? 'rgba(255,255,255,0.3)' : 'var(--bg-main)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1.25rem',
                                fontWeight: '700',
                                color: isTopThree ? '#fff' : 'var(--text-primary)',
                                flexShrink: 0
                            }}>
                                {medal.emoji || `#${entry.rank}`}
                            </div>

                            {/* Student Info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                    fontSize: '1rem',
                                    fontWeight: '600',
                                    color: isTopThree ? '#fff' : 'var(--text-primary)',
                                    marginBottom: '0.25rem',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                }}>
                                    {entry.studentName}
                                    {isCurrentUser && (
                                        <span style={{
                                            marginLeft: '0.5rem',
                                            fontSize: '0.75rem',
                                            padding: '0.125rem 0.5rem',
                                            borderRadius: '4px',
                                            background: 'var(--primary)',
                                            color: 'white'
                                        }}>
                                            You
                                        </span>
                                    )}
                                </div>
                                <div style={{
                                    fontSize: '0.875rem',
                                    color: isTopThree ? 'rgba(255,255,255,0.9)' : 'var(--text-secondary)'
                                }}>
                                    Rank #{entry.rank}
                                </div>
                            </div>

                            {/* Score */}
                            <div style={{
                                textAlign: 'right',
                                flexShrink: 0
                            }}>
                                <div style={{
                                    fontSize: '1.5rem',
                                    fontWeight: '700',
                                    color: isTopThree ? '#fff' : 'var(--primary)',
                                    lineHeight: 1
                                }}>
                                    {entry.score.toFixed(1)}%
                                </div>
                                {entry.earnedMarks !== undefined && entry.totalMarks !== undefined && (
                                    <div style={{
                                        fontSize: '0.75rem',
                                        color: isTopThree ? 'rgba(255,255,255,0.8)' : 'var(--text-secondary)',
                                        marginTop: '0.25rem'
                                    }}>
                                        {entry.earnedMarks}/{entry.totalMarks}
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            {leaderboard.length >= 10 && (
                <div style={{
                    marginTop: '1rem',
                    padding: '0.75rem',
                    background: 'var(--bg-surface)',
                    borderRadius: '8px',
                    textAlign: 'center',
                    fontSize: '0.875rem',
                    color: 'var(--text-secondary)'
                }}>
                    Showing top {leaderboard.length} students
                </div>
            )}
        </div>
    )
}
