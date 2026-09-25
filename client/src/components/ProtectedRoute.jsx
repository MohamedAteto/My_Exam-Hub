import { useEffect, useRef } from 'react'
import { Navigate } from 'react-router-dom'
import { storage } from '../utils/storage'
import { getUserRoles, getDefaultRouteForRole, isAuthenticated } from '../utils/auth'
import { parseToken } from '../utils/token'

export default function ProtectedRoute({ children, allowedRoles }) {
    const authenticated = isAuthenticated()
    const redirectStarted = useRef(false)
    const casUrl = import.meta.env.VITE_CAS_URL || 'https://centerlizedlogin.sewedy.com.eg'
    const callbackUrl = encodeURIComponent(`${window.location.origin}/sso-callback`)
    const loginUrl = `${casUrl}/login?redirect=${callbackUrl}&businessEntityId=9`

    useEffect(() => {
        if (authenticated || redirectStarted.current) return
        redirectStarted.current = true
        window.location.href = loginUrl
    }, [authenticated, loginUrl])

    if (!authenticated) {
        return (
            <main role="status" style={{
                minHeight: '100vh',
                display: 'grid',
                placeContent: 'center',
                gap: '0.75rem',
                padding: '2rem',
                textAlign: 'center',
                color: '#111827',
                background: '#f9fafb'
            }}>
                <p style={{ margin: 0 }}>Redirecting to secure sign-in...</p>
                <a href={loginUrl} style={{ color: '#b91c1c', textDecoration: 'underline' }}>
                    Continue to sign in
                </a>
            </main>
        )
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
    const normalizedAllowed = (allowedRoles || []).map(role => role.toLowerCase())
    const hasAccess = normalizedAllowed.length === 0 || userRoles.some(
        role => normalizedAllowed.includes(String(role).toLowerCase())
    )

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
