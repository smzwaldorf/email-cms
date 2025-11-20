/**
 * AdminRoute - Protected route wrapper for admin-only pages
 * Ensures user is authenticated and has admin role
 */

import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

interface AdminRouteProps {
  children: ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { user, isLoading } = useAuth();

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-waldorf-clay mx-auto"></div>
          <p className="mt-4 text-waldorf-brown">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Redirect to home if not admin
  if (user.role !== 'admin') {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
