import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';

// Mock the auth utility
vi.mock('../utils/auth', () => ({
  hasRole: vi.fn(),
  isAuthenticated: vi.fn(),
}));

import { hasRole, isAuthenticated } from '../utils/auth';

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  const TestComponent = () => <div>Protected Content</div>;
  const LoginComponent = () => <div>Login Page</div>;

  const renderWithRouter = (element, initialRoute = '/protected') => {
    return render(
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/login" element={<LoginComponent />} />
          <Route path="/protected" element={element} />
        </Routes>
      </MemoryRouter>
    );
  };

  describe('Authentication', () => {
    it('should render children when authenticated', () => {
      isAuthenticated.mockReturnValue(true);
      hasRole.mockReturnValue(true);

      renderWithRouter(
        <ProtectedRoute>
          <TestComponent />
        </ProtectedRoute>
      );

      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });

    it('should redirect to login when not authenticated', () => {
      isAuthenticated.mockReturnValue(false);

      renderWithRouter(
        <ProtectedRoute>
          <TestComponent />
        </ProtectedRoute>
      );

      expect(screen.getByText('Login Page')).toBeInTheDocument();
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });
  });

  describe('Role-based Access', () => {
    it('should render when user has required role', () => {
      isAuthenticated.mockReturnValue(true);
      hasRole.mockReturnValue(true);

      renderWithRouter(
        <ProtectedRoute allowedRoles={['teacher']}>
          <TestComponent />
        </ProtectedRoute>
      );

      expect(screen.getByText('Protected Content')).toBeInTheDocument();
      expect(hasRole).toHaveBeenCalledWith('teacher');
    });

    it('should redirect when user lacks required role', () => {
      isAuthenticated.mockReturnValue(true);
      hasRole.mockReturnValue(false);

      renderWithRouter(
        <ProtectedRoute allowedRoles={['admin']}>
          <TestComponent />
        </ProtectedRoute>
      );

      expect(screen.getByText('Login Page')).toBeInTheDocument();
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });

    it('should check multiple allowed roles', () => {
      isAuthenticated.mockReturnValue(true);
      hasRole.mockImplementation((role) => role === 'teacher');

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
      expect(hasRole).not.toHaveBeenCalled();
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
