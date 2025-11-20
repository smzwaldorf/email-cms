/**
 * UnauthorizedPage - Shown when user tries to access a page they don't have permission for
 */

import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

export function UnauthorizedPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-waldorf-cream flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg border border-waldorf-sage/20 p-8 text-center shadow-lg">
        <div className="text-6xl mb-4">🚫</div>
        <h1 className="text-3xl font-bold text-waldorf-brown mb-4">Access Denied</h1>
        <p className="text-waldorf-clay mb-6">
          You don't have permission to access this page.
        </p>

        {user && (
          <div className="mb-6 p-4 bg-waldorf-sage/10 rounded-lg">
            <p className="text-sm text-waldorf-clay">
              Logged in as: <span className="font-medium text-waldorf-brown">{user.email}</span>
            </p>
            <p className="text-sm text-waldorf-clay">
              Role: <span className="font-medium text-waldorf-brown">{user.role}</span>
            </p>
          </div>
        )}

        <div className="space-y-3">
          <Link
            to="/"
            className="block w-full px-6 py-3 bg-waldorf-sage text-white rounded-lg hover:bg-waldorf-clay transition-colors"
          >
            Go to Home
          </Link>
          {user && (
            <Link
              to="/login"
              className="block w-full px-6 py-3 bg-white border border-waldorf-sage text-waldorf-brown rounded-lg hover:bg-waldorf-sage/10 transition-colors"
            >
              Sign in with different account
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
