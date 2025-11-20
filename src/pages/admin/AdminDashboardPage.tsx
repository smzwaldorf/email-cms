/**
 * AdminDashboardPage - Modern dashboard with shadcn/ui components and mock data
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { generateMockStats, generateMockActivity, type MockActivity } from '@/lib/mockData';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';

export function AdminDashboardPage() {
  const [stats, setStats] = useState(generateMockStats());
  const [activity, setActivity] = useState<MockActivity[]>([]);

  useEffect(() => {
    // Simulate loading mock data
    setStats(generateMockStats());
    setActivity(generateMockActivity(5));
  }, []);

  const getActionBadgeVariant = (action: string): 'default' | 'success' | 'warning' | 'destructive' => {
    switch (action) {
      case 'create':
        return 'success';
      case 'update':
        return 'default';
      case 'publish':
        return 'success';
      case 'unpublish':
        return 'warning';
      case 'delete':
        return 'destructive';
      default:
        return 'default';
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-waldorf-brown">Dashboard</h2>
        <p className="text-waldorf-clay mt-2">Welcome to the Email CMS Admin Dashboard</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-waldorf-clay"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-waldorf-clay mt-1">
              +12% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Newsletter Weeks</CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-waldorf-clay"
            >
              <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
              <line x1="16" x2="16" y1="2" y2="6" />
              <line x1="8" x2="8" y1="2" y2="6" />
              <line x1="3" x2="21" y1="10" y2="10" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalWeeks}</div>
            <p className="text-xs text-waldorf-clay mt-1">
              {stats.publishedWeeks} published
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Articles</CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-waldorf-clay"
            >
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalArticles}</div>
            <p className="text-xs text-waldorf-clay mt-1">
              {stats.publishedArticles} published
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Classes</CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-waldorf-clay"
            >
              <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
              <path d="M6 12v5c3 3 9 3 12 0v-5" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalClasses}</div>
            <p className="text-xs text-waldorf-clay mt-1">
              {stats.totalFamilies} families enrolled
            </p>
          </CardContent>
        </Card>
      </div>

      {/* User Role Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>User Roles Distribution</CardTitle>
          <CardDescription>Breakdown of users by role type</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex flex-col items-center justify-center p-4 bg-red-50 rounded-lg">
              <div className="text-3xl mb-2">👤</div>
              <p className="text-sm text-waldorf-clay">Admins</p>
              <p className="text-2xl font-bold text-waldorf-brown">{stats.adminCount}</p>
            </div>
            <div className="flex flex-col items-center justify-center p-4 bg-blue-50 rounded-lg">
              <div className="text-3xl mb-2">👨‍🏫</div>
              <p className="text-sm text-waldorf-clay">Teachers</p>
              <p className="text-2xl font-bold text-waldorf-brown">{stats.teacherCount}</p>
            </div>
            <div className="flex flex-col items-center justify-center p-4 bg-green-50 rounded-lg">
              <div className="text-3xl mb-2">👨‍👩‍👧</div>
              <p className="text-sm text-waldorf-clay">Parents</p>
              <p className="text-2xl font-bold text-waldorf-brown">{stats.parentCount}</p>
            </div>
            <div className="flex flex-col items-center justify-center p-4 bg-yellow-50 rounded-lg">
              <div className="text-3xl mb-2">👶</div>
              <p className="text-sm text-waldorf-clay">Students</p>
              <p className="text-2xl font-bold text-waldorf-brown">{stats.studentCount}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest changes across the system</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activity.map((item) => (
                <div key={item.id} className="flex items-start space-x-4 border-l-2 border-waldorf-peach pl-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={getActionBadgeVariant(item.action)}>
                        {item.action}
                      </Badge>
                      <span className="text-xs text-waldorf-clay">
                        {formatTimeAgo(item.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-waldorf-brown font-medium">
                      {item.description}
                    </p>
                    <p className="text-xs text-waldorf-clay">by {item.userEmail}</p>
                  </div>
                </div>
              ))}
            </div>
            <Link
              to="/admin/audit"
              className="block mt-4 text-sm text-waldorf-sage hover:text-waldorf-clay text-center"
            >
              View all activity →
            </Link>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common administrative tasks</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Link
              to="/admin/users"
              className="flex items-center space-x-3 px-4 py-3 bg-waldorf-sage/10 hover:bg-waldorf-sage/20 rounded-lg transition-colors group"
            >
              <span className="text-2xl">👤</span>
              <div className="flex-1">
                <p className="text-waldorf-brown font-medium group-hover:text-waldorf-sage">Create User</p>
                <p className="text-xs text-waldorf-clay">Add new user account</p>
              </div>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-waldorf-clay group-hover:text-waldorf-sage"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </Link>

            <Link
              to="/admin/weeks"
              className="flex items-center space-x-3 px-4 py-3 bg-waldorf-sage/10 hover:bg-waldorf-sage/20 rounded-lg transition-colors group"
            >
              <span className="text-2xl">📅</span>
              <div className="flex-1">
                <p className="text-waldorf-brown font-medium group-hover:text-waldorf-sage">Create Week</p>
                <p className="text-xs text-waldorf-clay">Add new newsletter week</p>
              </div>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-waldorf-clay group-hover:text-waldorf-sage"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </Link>

            <Link
              to="/admin/articles"
              className="flex items-center space-x-3 px-4 py-3 bg-waldorf-sage/10 hover:bg-waldorf-sage/20 rounded-lg transition-colors group"
            >
              <span className="text-2xl">📄</span>
              <div className="flex-1">
                <p className="text-waldorf-brown font-medium group-hover:text-waldorf-sage">Create Article</p>
                <p className="text-xs text-waldorf-clay">Write new article</p>
              </div>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-waldorf-clay group-hover:text-waldorf-sage"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </Link>

            <Link
              to="/admin/classes"
              className="flex items-center space-x-3 px-4 py-3 bg-waldorf-sage/10 hover:bg-waldorf-sage/20 rounded-lg transition-colors group"
            >
              <span className="text-2xl">🏫</span>
              <div className="flex-1">
                <p className="text-waldorf-brown font-medium group-hover:text-waldorf-sage">Create Class</p>
                <p className="text-xs text-waldorf-clay">Add new class</p>
              </div>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-waldorf-clay group-hover:text-waldorf-sage"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
