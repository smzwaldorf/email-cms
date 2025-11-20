/**
 * AdminDashboardPage - Main admin dashboard with statistics and recent activity
 */

import { useEffect, useState } from 'react';
import { StatsCard } from '@/components/admin/StatsCard';
import {
  fetchDashboardStats,
  fetchRecentActivity,
  type DashboardStats,
  type RecentActivity,
} from '@/services/admin/adminStatsService';
import { Link } from 'react-router-dom';

export function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        setLoading(true);
        const [statsData, activityData] = await Promise.all([
          fetchDashboardStats(),
          fetchRecentActivity(5),
        ]);
        setStats(statsData);
        setActivity(activityData);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-3xl font-bold text-waldorf-brown mb-8">Dashboard</h2>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatsCard
          title="Total Users"
          value={stats?.totalUsers || 0}
          icon="👥"
          loading={loading}
        />
        <StatsCard
          title="Newsletter Weeks"
          value={stats?.totalWeeks || 0}
          icon="📅"
          loading={loading}
        />
        <StatsCard
          title="Articles"
          value={stats?.totalArticles || 0}
          icon="📄"
          loading={loading}
        />
        <StatsCard
          title="Classes"
          value={stats?.totalClasses || 0}
          icon="🏫"
          loading={loading}
        />
      </div>

      {/* User Role Breakdown */}
      <div className="bg-white rounded-lg border border-waldorf-sage/20 p-6 mb-8 shadow-sm">
        <h3 className="text-xl font-semibold text-waldorf-brown mb-4">User Roles</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-waldorf-clay">Admins</p>
            <p className="text-2xl font-bold text-waldorf-brown">
              {stats?.adminCount || 0}
            </p>
          </div>
          <div>
            <p className="text-sm text-waldorf-clay">Teachers</p>
            <p className="text-2xl font-bold text-waldorf-brown">
              {stats?.teacherCount || 0}
            </p>
          </div>
          <div>
            <p className="text-sm text-waldorf-clay">Parents</p>
            <p className="text-2xl font-bold text-waldorf-brown">
              {stats?.parentCount || 0}
            </p>
          </div>
          <div>
            <p className="text-sm text-waldorf-clay">Students</p>
            <p className="text-2xl font-bold text-waldorf-brown">
              {stats?.studentCount || 0}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Activity */}
        <div className="bg-white rounded-lg border border-waldorf-sage/20 p-6 shadow-sm">
          <h3 className="text-xl font-semibold text-waldorf-brown mb-4">Recent Activity</h3>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-waldorf-sage/20 animate-pulse rounded"></div>
              ))}
            </div>
          ) : activity.length === 0 ? (
            <p className="text-waldorf-clay text-center py-8">No recent activity</p>
          ) : (
            <div className="space-y-3">
              {activity.map((item) => (
                <div
                  key={item.id}
                  className="border-l-4 border-waldorf-peach pl-4 py-2"
                >
                  <p className="text-sm text-waldorf-brown font-medium">
                    {item.description}
                  </p>
                  <p className="text-xs text-waldorf-clay">
                    {item.userEmail} • {new Date(item.timestamp).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
          <Link
            to="/admin/audit"
            className="block mt-4 text-sm text-waldorf-clay hover:text-waldorf-brown text-center"
          >
            View all activity →
          </Link>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg border border-waldorf-sage/20 p-6 shadow-sm">
          <h3 className="text-xl font-semibold text-waldorf-brown mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <Link
              to="/admin/users"
              className="block px-4 py-3 bg-waldorf-sage/10 hover:bg-waldorf-sage/20 rounded-lg transition-colors"
            >
              <span className="text-lg mr-2">👤</span>
              <span className="text-waldorf-brown font-medium">Create User</span>
            </Link>
            <Link
              to="/admin/weeks"
              className="block px-4 py-3 bg-waldorf-sage/10 hover:bg-waldorf-sage/20 rounded-lg transition-colors"
            >
              <span className="text-lg mr-2">📅</span>
              <span className="text-waldorf-brown font-medium">Create Week</span>
            </Link>
            <Link
              to="/admin/articles"
              className="block px-4 py-3 bg-waldorf-sage/10 hover:bg-waldorf-sage/20 rounded-lg transition-colors"
            >
              <span className="text-lg mr-2">📄</span>
              <span className="text-waldorf-brown font-medium">Create Article</span>
            </Link>
            <Link
              to="/admin/classes"
              className="block px-4 py-3 bg-waldorf-sage/10 hover:bg-waldorf-sage/20 rounded-lg transition-colors"
            >
              <span className="text-lg mr-2">🏫</span>
              <span className="text-waldorf-brown font-medium">Create Class</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
