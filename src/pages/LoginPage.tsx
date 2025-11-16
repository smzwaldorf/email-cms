import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  const { signInWithGoogle, signInWithEmail } = useAuth();

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setMessage(null);
      await signInWithGoogle();
      // OAuth will redirect, so we don't need to navigate here
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Google 登入失敗，請稍後再試' });
      console.error('Google sign-in error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      setMessage({ type: 'error', text: '請輸入電子郵件' });
      return;
    }

    try {
      setLoading(true);
      setMessage(null);
      await signInWithEmail(email);
      setEmailSent(true);
      setMessage({ type: 'success', text: `登入連結已發送至 ${email}` });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || '發送登入連結失敗，請稍後再試' });
      console.error('Email sign-in error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-waldorf-cream to-waldorf-sage p-4">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-waldorf-brown mb-2">
            電子報 CMS
          </h1>
          <p className="text-waldorf-clay text-lg">
            歡迎回來
          </p>
        </div>

        {/* Message Display */}
        {message && (
          <div
            className={`p-4 rounded-lg text-sm ${
              message.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {message.text}
          </div>
        )}

        {!emailSent ? (
          <>
            {/* Google Sign-In */}
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 border-2 border-gray-300 rounded-xl hover:bg-gray-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span className="font-semibold text-gray-700">使用 Google 帳號登入</span>
            </button>

            {/* Divider */}
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-500 font-medium">或</span>
              </div>
            </div>

            {/* Email Magic Link */}
            <form onSubmit={handleEmailSignIn} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  電子郵件
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="your.email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-waldorf-sage focus:border-waldorf-sage transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full px-6 py-4 bg-waldorf-sage text-white font-semibold rounded-xl hover:bg-opacity-90 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
              >
                {loading ? '發送中...' : '發送魔法連結'}
              </button>
            </form>

            {/* Info Text */}
            <p className="text-center text-sm text-gray-500 mt-6">
              我們會發送一個登入連結到您的信箱，無需密碼
            </p>
          </>
        ) : (
          /* Email Sent Success View */
          <div className="text-center space-y-6 py-8">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <svg
                className="w-10 h-10 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76"
                />
              </svg>
            </div>

            <div className="space-y-3">
              <h3 className="text-2xl font-bold text-gray-900">請檢查您的電子郵件</h3>
              <p className="text-gray-600">
                我們已發送登入連結至 <span className="font-semibold text-waldorf-brown">{email}</span>
              </p>
              <p className="text-sm text-gray-500">
                連結將在 15 分鐘內有效。如果沒有收到郵件，請檢查垃圾郵件資料夾。
              </p>
            </div>

            <button
              onClick={() => {
                setEmailSent(false);
                setEmail('');
                setMessage(null);
              }}
              className="text-waldorf-sage hover:text-waldorf-brown font-medium transition-colors duration-200"
            >
              ← 返回登入
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
