import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * AuthCallbackPage handles OAuth redirects and magic link verifications
 * After successful authentication, redirects user to home page
 */
export function AuthCallbackPage() {
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      // Redirect to home after successful authentication
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, loading, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-waldorf-cream">
      <div className="text-center space-y-4">
        <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-waldorf-sage"></div>
        <h2 className="text-2xl font-bold text-waldorf-brown">驗證中...</h2>
        <p className="text-waldorf-clay">請稍候，我們正在完成登入程序</p>
      </div>
    </div>
  );
}
