import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { storage } from '../utils/storage'
import { getUserIdFromToken } from '../utils/token'
import api from '../api/axios'

export default function SsoCallbackPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    async function processSso() {
      try {
        const token = searchParams.get('token')
        const role = searchParams.get('role')
        const userName = searchParams.get('name') || searchParams.get('userName')
        const email = searchParams.get('email')
        const ssoToken = searchParams.get('ssoToken')
        const userId = searchParams.get('userId')

        if (token) {
          // Token provided directly from CAS - no need for API call
          console.log('Direct token provided from CAS');
          const primaryRole = role || 'Student'
          const userIdValue = userId || searchParams.get('AccountId')
          
          storage.setItem('token', token)
          storage.setItem('userRole', primaryRole)
          if (userName) storage.setItem('userName', decodeURIComponent(userName))
          if (email) storage.setItem('userEmail', email)
          if (userIdValue) {
            storage.setItem('userId', userIdValue)
            console.log('Stored userId:', userIdValue);
          }

          // Also try to extract userId from token as backup
          try {
            const extractedUserId = getUserIdFromToken(token);
            if (extractedUserId && !userIdValue) {
              storage.setItem('userId', extractedUserId)
              console.log('Extracted userId from token:', extractedUserId);
            }
          } catch (e) {
            console.warn('Could not extract userId from token:', e.message);
          }

          // Give storage a moment to persist
          setTimeout(() => {
            navigate('/greeting', { replace: true })
          }, 100);
          return
        }

        if (email || ssoToken) {
          // Exchange SSO Token / Email with Exams API for Exams JWT
          console.log('Exchanging SSO token with API');
          const response = await api.post('/auth/sso-token', {
            email: email || '',
            ssoToken: ssoToken || '',
            businessEntity: 'Exams'
          })

          const { token: apiToken, role: apiRole, fullNameEn, fullNameAr } = response.data

          storage.setItem('token', apiToken)
          storage.setItem('userRole', apiRole || 'Student')
          storage.setItem('userName', fullNameEn || fullNameAr || email || 'User')

          navigate('/greeting', { replace: true })
          return
        }

        // Check if already authenticated
        const storedToken = storage.getItem('token')
        if (storedToken) {
          console.log('Using stored token');
          navigate('/greeting', { replace: true })
          return
        }

        // No token available, go back to login
        console.warn('No token available in SSO callback');
        navigate('/', { replace: true })
      } catch (err) {
        console.error('SSO Callback error:', err)
        // Clear any partial state
        storage.clear()
        navigate('/', { replace: true })
      }
    }

    processSso()
  }, [searchParams, navigate])

  return null
}
