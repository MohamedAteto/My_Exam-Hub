/**
 * Authentication and Authorization Utilities
 */

import { parseToken } from './token';
import { storage } from './storage';

/**
 * Get current user's roles from token
 */
export function getUserRoles() {
  const token = storage.getItem('token');
  if (!token) return [];
  
  const payload = parseToken(token);
  if (!payload) return [];
  
  // Standard role claim types (in order of preference)
  const roleClaimTypes = [
    'http://schemas.microsoft.com/ws/2008/06/identity/claims/role',
    'roles',
    'role',
    'Role'
  ];
  
  for (const claimType of roleClaimTypes) {
    const roles = payload[claimType];
    if (roles) {
      // Return as array
      return Array.isArray(roles) ? roles : [roles];
    }
  }
  
  return [];
}

/**
 * Check if current user has the specified role
 */
export function hasRole(requiredRole) {
  if (!requiredRole) return false;
  
  const userRoles = getUserRoles();
  const normalized = requiredRole.toLowerCase();
  
  return userRoles.some(role => role.toLowerCase() === normalized);
}

/**
 * Get the primary role for the current user
 * Useful for routing/display purposes
 */
export function getPrimaryRole() {
  const roles = getUserRoles();
  
  if (roles.length === 0) return null;
  
  // Priority order
  const rolePriority = ['superadmin', 'admin', 'board', 'teacher', 'student'];
  
  for (const priority of rolePriority) {
    if (roles.some(role => role.toLowerCase() === priority)) {
      return roles.find(role => role.toLowerCase() === priority);
    }
  }
  
  return roles[0];
}

/**
 * Get default route for a user based on their role
 */
export function getDefaultRouteForRole(role) {
  const roleRoutes = {
    'superadmin': '/superadmin',
    'admin': '/superadmin',
    'board': '/superadmin',
    'teacher': '/teacher',
    'student': '/student'
  };
  
  return roleRoutes[role?.toLowerCase()] || '/';
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated() {
  const token = storage.getItem('token');
  if (!token) return false;
  
  const payload = parseToken(token);
  return payload !== null; // parseToken returns null if expired or invalid
}

/**
 * Get user ID from current token
 */
export function getCurrentUserId() {
  const token = storage.getItem('token');
  if (!token) return null;
  
  const payload = parseToken(token);
  if (!payload) return null;
  
  return payload.AccountId || payload.accountId || payload.sub || payload.id || payload.nameid || payload.userId || null;
}

/**
 * Check if token is about to expire (within 5 minutes)
 */
export function isTokenExpiringSoon() {
  const token = storage.getItem('token');
  if (!token) return false;
  
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    
    const payload = JSON.parse(atob(base64));
    
    if (!payload.exp) return false;
    
    const expiryTime = payload.exp * 1000;
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    
    return expiryTime - now < fiveMinutes && expiryTime > now;
  } catch {
    return false;
  }
}
