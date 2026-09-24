import { Navigate } from 'react-router-dom'
import { storage } from '../utils/storage'
import { getUserRoles, getDefaultRouteForRole, isAuthenticated } from '../utils/auth'
import { parseToken } from '../utils/token'

export default function ProtectedRoute({ children, allowedRoles }) {
    // Check authentication
    if (!isAuthenticated()) {
        // Redirect to CAS Single Sign-On
        const casUrl = import.meta.env.VITE_CAS_URL || 'https://centerlizedlogin.sewedy.com.eg'
        const callbackUrl = encodeURIComponent(`${window.location.origin}/sso-callback`)
        window.location.href = `${casUrl}/login?redirect=${callbackUrl}&businessEntityId=9`
        return null
    }

    const token = storage.getItem('token')
    const payload = parseToken(token)
    
    if (!payload) {
        // Token is invalid or expired
        return <Navigate to="/" replace />
    }

    // Get user roles using centralized utility
    const userRoles = getUserRoles(payload)
    
    if (userRoles.length === 0) {
        console.warn('No roles found for user');
        return <Navigate to="/" replace />
    }

    // Check if user has any of the allowed roles
    const normalizedAllowed = allowedRoles.map(r => r.toLowerCase())
    const hasAccess = userRoles.some(role => normalizedAllowed.includes(role))

    if (!hasAccess) {
        // Redirect to appropriate page based on user's actual role
        const primaryRole = userRoles[0]
        const defaultRoute = getDefaultRouteForRole(primaryRole)
        
        if (window.location.pathname !== defaultRoute) {
            return <Navigate to={defaultRoute} replace />
        }
        
        // Already on correct route but unauthorized for this specific protected component
        return null
    }

    // User has access, render the protected component
    return children
}
