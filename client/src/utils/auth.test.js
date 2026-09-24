import { describe, it, expect, beforeEach } from 'vitest';
import { getUserRoles, hasRole, getPrimaryRole, isAuthenticated } from './auth';

function makeToken(payload, expiresIn = 3600) {
  const b64url = (obj) => btoa(JSON.stringify(obj))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, exp: now + expiresIn };
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(fullPayload)}.fakesignature`;
}

describe('Auth Utilities', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getUserRoles', () => {
    it('should extract single role as array', () => {
      const token = makeToken({ role: 'teacher' });
      localStorage.setItem('token', token);
      
      expect(getUserRoles()).toEqual(['teacher']);
    });

    it('should extract multiple roles', () => {
      const token = makeToken({ role: ['teacher', 'admin'] });
      localStorage.setItem('token', token);
      
      expect(getUserRoles()).toEqual(['teacher', 'admin']);
    });

    it('should return empty array when no token', () => {
      expect(getUserRoles()).toEqual([]);
    });

    it('should return empty array when no role in token', () => {
      const token = makeToken({ AccountId: 1 });
      localStorage.setItem('token', token);
      
      expect(getUserRoles()).toEqual([]);
    });

    it('should handle expired token', () => {
      const token = makeToken({ role: 'teacher' }, -100);
      localStorage.setItem('token', token);
      
      expect(getUserRoles()).toEqual([]);
    });
  });

  describe('hasRole', () => {
    it('should return true when user has the role', () => {
      const token = makeToken({ role: 'teacher' });
      localStorage.setItem('token', token);
      
      expect(hasRole('teacher')).toBe(true);
    });

    it('should return true when user has one of multiple roles', () => {
      const token = makeToken({ role: ['teacher', 'admin'] });
      localStorage.setItem('token', token);
      
      expect(hasRole('teacher')).toBe(true);
      expect(hasRole('admin')).toBe(true);
    });

    it('should return false when user does not have the role', () => {
      const token = makeToken({ role: 'student' });
      localStorage.setItem('token', token);
      
      expect(hasRole('teacher')).toBe(false);
    });

    it('should return false when no token', () => {
      expect(hasRole('teacher')).toBe(false);
    });

    it('should be case-insensitive', () => {
      const token = makeToken({ role: 'Teacher' });
      localStorage.setItem('token', token);
      
      expect(hasRole('teacher')).toBe(true);
      expect(hasRole('TEACHER')).toBe(true);
    });
  });

  describe('getPrimaryRole', () => {
    it('should return first role when multiple roles', () => {
      const token = makeToken({ role: ['teacher', 'admin'] });
      localStorage.setItem('token', token);
      
      expect(getPrimaryRole()).toBe('teacher');
    });

    it('should return single role', () => {
      const token = makeToken({ role: 'student' });
      localStorage.setItem('token', token);
      
      expect(getPrimaryRole()).toBe('student');
    });

    it('should return null when no roles', () => {
      const token = makeToken({ AccountId: 1 });
      localStorage.setItem('token', token);
      
      expect(getPrimaryRole()).toBeNull();
    });

    it('should return null when no token', () => {
      expect(getPrimaryRole()).toBeNull();
    });
  });

  describe('isAuthenticated', () => {
    it('should return true when valid token exists', () => {
      const token = makeToken({ AccountId: 1 });
      localStorage.setItem('token', token);
      
      expect(isAuthenticated()).toBe(true);
    });

    it('should return false when no token', () => {
      expect(isAuthenticated()).toBe(false);
    });

    it('should return false when token is expired', () => {
      const token = makeToken({ AccountId: 1 }, -100);
      localStorage.setItem('token', token);
      
      expect(isAuthenticated()).toBe(false);
    });

    it('should return false when token is invalid', () => {
      localStorage.setItem('token', 'invalid-token');
      
      expect(isAuthenticated()).toBe(false);
    });
  });
});
