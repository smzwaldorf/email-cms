/**
 * AdminLayout - Main layout wrapper for admin dashboard
 * Includes sidebar navigation and header
 */

import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

export function AdminLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const navItems = [
    { path: '/admin', label: 'Dashboard', icon: '📊', exact: true },
    { path: '/admin/users', label: 'Users', icon: '👥' },
    { path: '/admin/weeks', label: 'Weeks', icon: '📅' },
    { path: '/admin/articles', label: 'Articles', icon: '📄' },
    { path: '/admin/classes', label: 'Classes', icon: '🏫' },
    { path: '/admin/families', label: 'Families', icon: '👨‍👩‍👧‍👦' },
    { path: '/admin/audit', label: 'Audit Log', icon: '📋' },
  ];

  return (
    <div className="min-h-screen bg-waldorf-cream">
      {/* Header */}
      <header className="bg-white border-b border-waldorf-sage/20">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-waldorf-brown">
              Email CMS Admin
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-waldorf-clay">{user?.email}</span>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 text-sm bg-waldorf-sage text-white rounded hover:bg-waldorf-clay transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar Navigation */}
        <aside className="w-64 bg-white border-r border-waldorf-sage/20 min-h-[calc(100vh-73px)]">
          <nav className="p-4 space-y-2">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.exact}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-waldorf-peach text-waldorf-brown font-medium'
                      : 'text-waldorf-clay hover:bg-waldorf-sage/10'
                  }`
                }
              >
                <span className="text-xl">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
