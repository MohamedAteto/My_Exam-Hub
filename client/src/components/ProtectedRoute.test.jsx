import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';

// Mock the auth utility
vi.mock('../utils/auth', () => ({
  getUserRoles: vi.fn(),
  getDefaultRouteForRole: vi.fn(),
  isAuthenticated: vi.fn(),
}));

import { getUserRoles, getDefaultRouteForRole, isAuthenticated } from '../utils/auth';

function makeToken(payload) {
  const encode = (value) => btoa(JSON.stringify(value))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  const claims = { ...payload, exp: Math.floor(Date.now() / 1000) + 3600 };
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}.signature`;
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    sessionStorage.setItem('token', makeToken({ role: 'Teacher' }));
    getUserRoles.mockReturnValue(['teacher']);
    getDefaultRouteForRole.mockReturnValue('/teacher');
  });

  const TestComponent = () => <div>Protected Content</div>;
  const RoleHome = () => <div>Role Home</div>;

  const renderWithRouter = (element, initialRoute = '/protected') => {
    return render(
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/teacher" element={<RoleHome />} />
          <Route path="/protected" element={element} />
        </Routes>
      </MemoryRouter>
    );
  };

  describe('Authentication', () => {
    it('should render children when authenticated', () => {
      isAuthenticated.mockReturnValue(true);

      renderWithRouter(
        <ProtectedRoute>
          <TestComponent />
        </ProtectedRoute>
      );

      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });

    it('should show a sign-in fallback when not authenticated', () => {
      isAuthenticated.mockReturnValue(false);

      renderWithRouter(
        <ProtectedRoute>
          <TestComponent />
        </ProtectedRoute>
      );

      expect(screen.getByRole('status')).toHaveTextContent('Redirecting to secure sign-in...');
      expect(screen.getByRole('link', { name: 'Continue to sign in' })).toHaveAttribute(
        'href',
        expect.stringContaining('/login?redirect=')
      );
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });
  });

  describe('Role-based Access', () => {
    it('should render when user has required role', () => {
      isAuthenticated.mockReturnValue(true);

      renderWithRouter(
        <ProtectedRoute allowedRoles={['teacher']}>
          <TestComponent />
        </ProtectedRoute>
      );

      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });

    it('should match CAS roles regardless of capitalization', () => {
      isAuthenticated.mockReturnValue(true);
      getUserRoles.mockReturnValue(['Teacher']);

      renderWithRouter(
        <ProtectedRoute allowedRoles={['teacher']}>
          <TestComponent />
        </ProtectedRoute>
      );

      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });

    it('should redirect when user lacks required role', () => {
      isAuthenticated.mockReturnValue(true);
      getUserRoles.mockReturnValue(['teacher']);

      renderWithRouter(
        <ProtectedRoute allowedRoles={['admin']}>
          <TestComponent />
        </ProtectedRoute>
      );

      expect(screen.getByText('Role Home')).toBeInTheDocument();
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });

    it('should check multiple allowed roles', () => {
      isAuthenticated.mockReturnValue(true);
      getUserRoles.mockReturnValue(['teacher', 'admin']);

      renderWithRouter(
        <ProtectedRoute allowedRoles={['teacher', 'admin']}>
          <TestComponent />
        </ProtectedRoute>
      );

      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });

    it('should render when no roles specified', () => {
      isAuthenticated.mockReturnValue(true);

      renderWithRouter(
        <ProtectedRoute>
          <TestComponent />
        </ProtectedRoute>
      );

      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty allowedRoles array', () => {
      isAuthenticated.mockReturnValue(true);

      renderWithRouter(
        <ProtectedRoute allowedRoles={[]}>
          <TestComponent />
        </ProtectedRoute>
      );

      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });

    it('should handle undefined children', () => {
      isAuthenticated.mockReturnValue(true);

      renderWithRouter(<ProtectedRoute />);

      // Should not crash
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });
  });
});
