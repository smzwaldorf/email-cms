import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * UserMenu component displays user information and provides logout functionality
 */
export function UserMenu() {
  const { user, signOut, isAdmin, isTeacher, isParent, isStudent } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (!user) return null;

  // Get role badge color
  const getRoleBadgeColor = () => {
    if (isAdmin()) return 'bg-red-100 text-red-800';
    if (isTeacher()) return 'bg-blue-100 text-blue-800';
    if (isParent()) return 'bg-green-100 text-green-800';
    if (isStudent()) return 'bg-purple-100 text-purple-800';
    return 'bg-gray-100 text-gray-800';
  };

  // Get role display text
  const getRoleText = () => {
    if (isAdmin()) return '管理員';
    if (isTeacher()) return '老師';
    if (isParent()) return '家長';
    if (isStudent()) return '學生';
    return user.role;
  };

  const displayName = user.displayName || `${user.firstName} ${user.lastName}` || user.email;
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="relative" ref={menuRef}>
      {/* User Avatar Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-2 rounded-lg hover:bg-waldorf-cream transition-colors duration-200"
        aria-label="User menu"
      >
        {user.avatar ? (
          <img
            src={user.avatar}
            alt={displayName}
            className="w-10 h-10 rounded-full object-cover border-2 border-waldorf-sage"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-waldorf-sage text-white flex items-center justify-center font-semibold text-sm border-2 border-waldorf-sage">
            {initials}
          </div>
        )}
        <div className="hidden md:block text-left">
          <p className="text-sm font-semibold text-waldorf-brown">{displayName}</p>
          <p className={`text-xs px-2 py-0.5 rounded-full inline-block ${getRoleBadgeColor()}`}>
            {getRoleText()}
          </p>
        </div>
        <svg
          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-50">
          {/* User Info Section */}
          <div className="p-4 bg-gradient-to-br from-waldorf-cream to-waldorf-sage">
            <div className="flex items-center gap-3">
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={displayName}
                  className="w-14 h-14 rounded-full object-cover border-3 border-white"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-waldorf-brown text-white flex items-center justify-center font-bold text-xl border-3 border-white">
                  {initials}
                </div>
              )}
              <div className="flex-1">
                <p className="font-bold text-waldorf-brown text-lg">{displayName}</p>
                <p className="text-sm text-waldorf-clay">{user.email}</p>
              </div>
            </div>
            <div className="mt-3">
              <span className={`text-xs px-3 py-1 rounded-full inline-block ${getRoleBadgeColor()}`}>
                {getRoleText()}
              </span>
              {user.emailVerified && (
                <span className="ml-2 text-xs px-3 py-1 rounded-full inline-block bg-green-100 text-green-800">
                  ✓ 已驗證
                </span>
              )}
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-2">
            <button
              onClick={() => {
                setIsOpen(false);
                navigate('/profile');
              }}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors duration-150 flex items-center gap-3"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              <span className="text-gray-700 font-medium">個人資料</span>
            </button>

            {isAdmin() && (
              <button
                onClick={() => {
                  setIsOpen(false);
                  navigate('/admin');
                }}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors duration-150 flex items-center gap-3"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-gray-700 font-medium">系統管理</span>
              </button>
            )}

            <div className="border-t border-gray-200 my-2"></div>

            <button
              onClick={handleSignOut}
              className="w-full px-4 py-3 text-left hover:bg-red-50 transition-colors duration-150 flex items-center gap-3 text-red-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              <span className="font-medium">登出</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
