/**
 * UserManagementPage - User CRUD interface for admins
 */

import { useEffect, useState } from 'react';
import { UserRoleRow } from '@/types/database';
import { getSupabaseClient } from '@/lib/supabase';

const supabase = getSupabaseClient();

export function UserManagementPage() {
  const [users, setUsers] = useState<UserRoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error('Failed to load users:', err);
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  // Filter users
  const filteredUsers = users.filter((user) => {
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesSearch = user.email.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesRole && matchesSearch;
  });

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return '👤';
      case 'teacher':
        return '👨‍🏫';
      case 'parent':
        return '👨‍👩‍👧';
      case 'student':
        return '👶';
      default:
        return '👤';
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'teacher':
        return 'bg-blue-100 text-blue-800';
      case 'parent':
        return 'bg-green-100 text-green-800';
      case 'student':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-bold text-waldorf-brown">User Management</h2>
        <button className="px-4 py-2 bg-waldorf-sage text-white rounded-lg hover:bg-waldorf-clay transition-colors">
          + Create User
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-waldorf-sage/20 p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-waldorf-sage/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-waldorf-sage"
            />
          </div>
          <div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-4 py-2 border border-waldorf-sage/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-waldorf-sage"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admins</option>
              <option value="teacher">Teachers</option>
              <option value="parent">Parents</option>
              <option value="student">Students</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg border border-waldorf-sage/20 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-waldorf-clay mx-auto"></div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-waldorf-clay">
            No users found
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-waldorf-sage/10">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-semibold text-waldorf-brown">
                  User
                </th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-waldorf-brown">
                  Role
                </th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-waldorf-brown">
                  Created
                </th>
                <th className="text-right px-6 py-4 text-sm font-semibold text-waldorf-brown">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-waldorf-sage/10">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-waldorf-sage/5">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{getRoleIcon(user.role)}</span>
                      <div>
                        <p className="font-medium text-waldorf-brown">{user.email}</p>
                        <p className="text-xs text-waldorf-clay">{user.id.substring(0, 8)}...</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(
                        user.role
                      )}`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-waldorf-clay">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-waldorf-sage hover:text-waldorf-clay text-sm font-medium mr-4">
                      Edit
                    </button>
                    <button className="text-red-600 hover:text-red-800 text-sm font-medium">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Summary */}
      <div className="mt-4 text-sm text-waldorf-clay">
        Showing {filteredUsers.length} of {users.length} users
      </div>
    </div>
  );
}
