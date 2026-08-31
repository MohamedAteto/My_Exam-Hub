import { motion } from 'framer-motion'

/**
 * Teacher / Admin welcome banner (AB UI style).
 *
 * Renders ONLY real data that already exists in the app:
 *  - teacherName  → from GET /auth/profile/{id} (kept in TeacherPage state)
 *  - userRole     → existing role state
 *  - current date → presentation only
 * No fake statistics, no invented actions, no new API requests.
 */
function getInitials(name) {
  if (!name || typeof name !== 'string') return 'EH'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'EH'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function TeacherWelcomeCard({ teacherName = 'Teacher', userRole = 'Teacher' }) {
  const now = new Date()
  const weekday = now.toLocaleDateString('en-US', { weekday: 'long' })
  const monthDay = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const year = now.getFullYear()
  const initials = getInitials(teacherName)
  const roleLabel = String(userRole || 'Teacher').trim() || 'Teacher'

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="dash-card welcome-card"
      style={{ padding: '1.375rem 1.75rem' }}
    >
      {/* Identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: 0 }}>
        <div className="welcome-card-avatar" aria-hidden="true">
          {initials}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <h2
              style={{
                margin: 0,
                fontSize: '1.35rem',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '100%',
              }}
            >
              Hello, {teacherName}!
            </h2>
            <span className="welcome-card-role">{roleLabel}</span>
          </div>
          <p
            style={{
              margin: '0.3rem 0 0',
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
            }}
          >
            Welcome back — here's an overview of your exams and students.
          </p>
        </div>
      </div>

      {/* Date */}
      <div className="welcome-card-date">
        <span
          style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--text-secondary)',
          }}
        >
          {weekday}
        </span>
        <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
          {monthDay}, {year}
        </span>
      </div>
    </motion.div>
  )
}
