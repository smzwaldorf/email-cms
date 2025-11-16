import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

/**
 * ProfilePage displays user profile information
 */
export function ProfilePage() {
  const { user, isAdmin, isTeacher, isParent, isStudent } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return null;
  }

  const getRoleText = () => {
    if (isAdmin()) return '管理員';
    if (isTeacher()) return '老師';
    if (isParent()) return '家長';
    if (isStudent()) return '學生';
    return user.role;
  };

  const getRoleBadgeColor = () => {
    if (isAdmin()) return 'bg-red-100 text-red-800 border-red-300';
    if (isTeacher()) return 'bg-blue-100 text-blue-800 border-blue-300';
    if (isParent()) return 'bg-green-100 text-green-800 border-green-300';
    if (isStudent()) return 'bg-purple-100 text-purple-800 border-purple-300';
    return 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const displayName = user.displayName || `${user.firstName} ${user.lastName}` || user.email;
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="min-h-screen bg-gradient-to-br from-waldorf-cream to-waldorf-sage p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>返回</span>
          </button>
          <h1 className="text-3xl font-bold text-waldorf-brown">個人資料</h1>
          <div className="w-24"></div>
        </div>

        {/* Profile Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Profile Header */}
          <div className="bg-gradient-to-r from-waldorf-sage to-waldorf-peach p-8 text-white">
            <div className="flex items-center gap-6">
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={displayName}
                  className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-waldorf-brown text-white flex items-center justify-center font-bold text-3xl border-4 border-white shadow-lg">
                  {initials}
                </div>
              )}
              <div>
                <h2 className="text-3xl font-bold">{displayName}</h2>
                <p className="text-white/80 mt-1">{user.email}</p>
                <div className="mt-3 flex items-center gap-3">
                  <span className={`px-4 py-1 rounded-full text-sm font-semibold border-2 ${getRoleBadgeColor()}`}>
                    {getRoleText()}
                  </span>
                  {user.emailVerified && (
                    <span className="px-4 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-800 border-2 border-green-300">
                      ✓ 已驗證電子郵件
                    </span>
                  )}
                  {user.isActive ? (
                    <span className="px-4 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-800 border-2 border-green-300">
                      ✓ 帳號啟用中
                    </span>
                  ) : (
                    <span className="px-4 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-800 border-2 border-red-300">
                      ✗ 帳號已停用
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Profile Details */}
          <div className="p-8 space-y-6">
            <h3 className="text-xl font-bold text-waldorf-brown mb-4">基本資訊</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-600">姓名</label>
                <p className="text-lg text-gray-900">
                  {user.firstName} {user.lastName}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-600">顯示名稱</label>
                <p className="text-lg text-gray-900">{user.displayName || '—'}</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-600">電子郵件</label>
                <p className="text-lg text-gray-900">{user.email}</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-600">電話號碼</label>
                <p className="text-lg text-gray-900">{user.phoneNumber || '—'}</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-600">角色</label>
                <p className="text-lg text-gray-900">{getRoleText()}</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-600">最後登入時間</label>
                <p className="text-lg text-gray-900">
                  {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('zh-TW') : '—'}
                </p>
              </div>
            </div>

            {/* Account Information */}
            <div className="border-t pt-6 mt-6">
              <h3 className="text-xl font-bold text-waldorf-brown mb-4">帳號資訊</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-600">帳號建立日期</label>
                  <p className="text-lg text-gray-900">{new Date(user.createdAt).toLocaleString('zh-TW')}</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-600">最後更新日期</label>
                  <p className="text-lg text-gray-900">{new Date(user.updatedAt).toLocaleString('zh-TW')}</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="border-t pt-6 mt-6">
              <button
                onClick={() => alert('編輯功能即將推出')}
                className="px-6 py-3 bg-waldorf-sage text-white font-semibold rounded-lg hover:bg-opacity-90 transition-all duration-200 shadow-md hover:shadow-lg"
              >
                編輯個人資料
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
