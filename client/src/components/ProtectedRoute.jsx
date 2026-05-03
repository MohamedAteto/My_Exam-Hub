import { Navigate } from 'react-router-dom'
import { storage } from '../utils/storage'

export default function ProtectedRoute({ children, allowedRoles }) {
    const token = storage.getItem('token')

    // If no token, redirect to login
    if (!token) {
        return <Navigate to="/" replace />
    }

    // Parse user role from token
    try {
        const payload = JSON.parse(atob(token.split('.')[1]))

        // Try multiple ways to get roles
        let userRoles = []

        // Check for roles array
        if (Array.isArray(payload.roles)) {
            userRoles = payload.roles.map(r => String(r).toLowerCase())
        }
        // Check for single role
        else if (payload.role) {
            userRoles = [String(payload.role).toLowerCase()]
        }
        // Check for role in http schema format
        else if (payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role']) {
            const role = payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role']
            userRoles = Array.isArray(role) ? role.map(r => String(r).toLowerCase()) : [String(role).toLowerCase()]
        }
        // Fallback to storage utility
        else {
            const storedRole = storage.getItem('userRole')
            if (storedRole) {
                userRoles = [String(storedRole).toLowerCase()]
            }
        }

        // Check if user has any of the allowed roles
        const hasAccess = allowedRoles.some(role =>
            userRoles.includes(role.toLowerCase())
        )

        if (!hasAccess) {
            // Redirect to appropriate page based on user's actual role
            if (userRoles.includes('admin') || userRoles.includes('board') || userRoles.includes('superadmin')) {
                if (window.location.pathname !== '/superadmin') {
                    return <Navigate to="/superadmin" replace />
                }
            } else if (userRoles.includes('teacher')) {
                if (window.location.pathname !== '/teacher') {
                    return <Navigate to="/teacher" replace />
                }
            } else if (userRoles.includes('student')) {
                if (window.location.pathname !== '/student') {
                    return <Navigate to="/student" replace />
                }
            }
            // Fallback to login if role is unknown or already home but unauthorized
            if (window.location.pathname !== '/') {
                return <Navigate to="/" replace />
            }
            return null // Just stop rendering the children
        }

        // User has access, render the protected component
        return children
    } catch (error) {
        console.error('Error parsing token:', error)
        // Invalid token, redirect to login
        return <Navigate to="/" replace />
    }
}
