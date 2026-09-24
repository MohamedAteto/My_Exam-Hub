import { describe, it, expect, beforeEach } from 'vitest';
import { parseToken, getUserIdFromToken, getRoleFromToken, isTokenValid } from './token';

// Helper: build a JWT-shaped token with URL-safe base64, padding stripped
function makeToken(payload, expiresIn = 3600) {
  const b64url = (obj) => btoa(JSON.stringify(obj))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, exp: now + expiresIn };
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(fullPayload)}.fakesignature`;
}

describe('Token Utilities', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('parseToken', () => {
    it('should parse valid URL-safe base64 token without padding', () => {
      const token = makeToken({ AccountId: 42, email: 'test@example.com' });
      const parsed = parseToken(token);
      
      expect(parsed).toBeTruthy();
      expect(parsed.AccountId).toBe(42);
      expect(parsed.email).toBe('test@example.com');
    });

    it('should handle standard padded base64 token', () => {
      const payload = { sub: 'user123', exp: Math.floor(Date.now() / 1000) + 3600 };
      const token = `header.${btoa(JSON.stringify(payload))}.signature`;
      const parsed = parseToken(token);
      
      expect(parsed).toBeTruthy();
      expect(parsed.sub).toBe('user123');
    });

    it('should return null for expired token', () => {
      const token = makeToken({ AccountId: 1 }, -100); // Expired 100 seconds ago
      const parsed = parseToken(token);
      
      expect(parsed).toBeNull();
    });

    it('should return null for invalid inputs', () => {
      expect(parseToken(null)).toBeNull();
      expect(parseToken(undefined)).toBeNull();
      expect(parseToken('')).toBeNull();
      expect(parseToken('not-a-jwt')).toBeNull();
      expect(parseToken('only.two')).toBeNull();
      expect(parseToken(12345)).toBeNull();
    });

    it('should return null for malformed base64', () => {
      const token = 'header.%%%invalid%%%.signature';
      expect(parseToken(token)).toBeNull();
    });
  });

  describe('getUserIdFromToken', () => {
    it('should extract AccountId from token', () => {
      const token = makeToken({ AccountId: 99 });
      expect(getUserIdFromToken(token)).toBe(99);
    });

    it('should extract accountId (lowercase) from token', () => {
      const token = makeToken({ accountId: 88 });
      expect(getUserIdFromToken(token)).toBe(88);
    });

    it('should extract sub claim from token', () => {
      const token = makeToken({ sub: 'user-77' });
      expect(getUserIdFromToken(token)).toBe('user-77');
    });

    it('should extract id claim from token', () => {
      const token = makeToken({ id: 66 });
      expect(getUserIdFromToken(token)).toBe(66);
    });

    it('should extract nameid claim from token', () => {
      const token = makeToken({ nameid: 'name-55' });
      expect(getUserIdFromToken(token)).toBe('name-55');
    });

    it('should extract userId claim from token', () => {
      const token = makeToken({ userId: 44 });
      expect(getUserIdFromToken(token)).toBe(44);
    });

    it('should return null when no id claims exist', () => {
      const token = makeToken({ email: 'test@example.com' });
      expect(getUserIdFromToken(token)).toBeNull();
    });

    it('should return null for invalid token', () => {
      expect(getUserIdFromToken('invalid')).toBeNull();
    });
  });

  describe('getRoleFromToken', () => {
    it('should extract role from token', () => {
      const token = makeToken({ role: 'teacher' });
      expect(getRoleFromToken(token)).toBe('teacher');
    });

    it('should extract Role (capitalized) from token', () => {
      const token = makeToken({ Role: 'student' });
      expect(getRoleFromToken(token)).toBe('student');
    });

    it('should return null when no role exists', () => {
      const token = makeToken({ AccountId: 1 });
      expect(getRoleFromToken(token)).toBeNull();
    });

    it('should return null for invalid token', () => {
      expect(getRoleFromToken('invalid')).toBeNull();
    });
  });

  describe('isTokenValid', () => {
    it('should return true for valid non-expired token', () => {
      const token = makeToken({ AccountId: 1 });
      expect(isTokenValid(token)).toBe(true);
    });

    it('should return false for expired token', () => {
      const token = makeToken({ AccountId: 1 }, -100);
      expect(isTokenValid(token)).toBe(false);
    });

    it('should return false for null token', () => {
      expect(isTokenValid(null)).toBe(false);
    });

    it('should return false for invalid token', () => {
      expect(isTokenValid('invalid')).toBe(false);
    });
  });
});
