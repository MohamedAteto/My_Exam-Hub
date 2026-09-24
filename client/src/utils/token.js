/**
 * Safely decode a JWT token and return the parsed payload.
 * Handles URL-safe base64 (RFC 7515): replaces `-` with `+`, `_` with `/`, and adds padding.
 * Returns null if the token is missing, malformed, expired, or cannot be decoded.
 */
export function parseToken(token) {
  try {
    if (!token || typeof token !== 'string') return null;
    
    // Trim any whitespace
    token = token.trim();
    
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    // Get the payload part (second part of JWT)
    let base64 = parts[1];
    
    // Handle URL-safe base64 - replace URL-safe chars with standard base64 chars
    base64 = base64.replace(/-/g, '+').replace(/_/g, '/');
    
    // Add padding if needed (base64 strings should be multiples of 4)
    while (base64.length % 4) {
      base64 += '=';
    }
    
    // Additional validation - check if the string looks like valid base64
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
      console.error('Invalid base64 format after normalization');
      return null;
    }
    
    // Decode base64 to JSON string
    let jsonString;
    try {
      jsonString = atob(base64);
    } catch (decodeError) {
      console.error('Failed to decode base64:', decodeError);
      return null;
    }
    
    // Parse JSON
    const payload = JSON.parse(jsonString);
    
    // Check token expiration
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      console.warn('Token has expired');
      return null;
    }
    
    return payload;
  } catch (e) {
    console.error('Error parsing token:', e.message);
    return null;
  }
}

/**
 * Extract the user ID from a token payload, checking all known claim names.
 * Returns null if no user ID claim is found.
 */
export function getUserIdFromToken(token) {
  const payload = parseToken(token);
  if (!payload) return null;
  
  // Try various claim names in order of preference
  const claims = [
    'AccountId',
    'accountId', 
    'sub',
    'id',
    'nameid',
    'userId',
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'
  ];
  
  for (const claim of claims) {
    const value = payload[claim];
    if (value !== undefined && value !== null) {
      // Convert to number if it's a string number, otherwise return as-is
      const numValue = Number(value);
      return !isNaN(numValue) ? numValue : value;
    }
  }
  
  return null;
}

/**
 * Extract the role from a token payload.
 * Returns null if no role claim is found.
 */
export function getRoleFromToken(token) {
  const payload = parseToken(token);
  if (!payload) return null;
  return payload.role || payload.Role || null;
}

/**
 * Check if a token is valid (exists and not expired).
 * Returns false if the token is null, malformed, or expired.
 */
export function isTokenValid(token) {
  if (!token) return false;
  const payload = parseToken(token);
  return payload !== null;
}
