/**
 * UserManagementPage - Modern user CRUD interface with shadcn/ui data table
 */

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { generateMockUsers } from '@/lib/mockData';
import type { UserRoleRow } from '@/types/database';

export function UserManagementPage() {
  const [users] = useState<UserRoleRow[]>(generateMockUsers(50));
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter users
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      const matchesSearch = user.email.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesRole && matchesSearch;
    });
  }, [users, roleFilter, searchQuery]);

  const getRoleBadgeVariant = (role: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (role) {
      case 'admin':
        return 'destructive';
      case 'teacher':
        return 'default';
      case 'parent':
        return 'secondary';
      case 'student':
        return 'outline';
      default:
        return 'outline';
    }
  };

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

  const roleStats = useMemo(() => {
    return {
      all: users.length,
      admin: users.filter(u => u.role === 'admin').length,
      teacher: users.filter(u => u.role === 'teacher').length,
      parent: users.filter(u => u.role === 'parent').length,
      student: users.filter(u => u.role === 'student').length,
    };
  }, [users]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-waldorf-brown">User Management</h2>
          <p className="text-waldorf-clay mt-2">Manage user accounts and permissions</p>
        </div>
        <Button>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 mr-2"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
              clipRule="evenodd"
            />
          </svg>
          Create User
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card className={roleFilter === 'all' ? 'ring-2 ring-waldorf-sage' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 cursor-pointer" onClick={() => setRoleFilter('all')}>
            <CardTitle className="text-sm font-medium">All Users</CardTitle>
            <span className="text-2xl">👥</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{roleStats.all}</div>
          </CardContent>
        </Card>

        <Card className={roleFilter === 'admin' ? 'ring-2 ring-waldorf-sage' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 cursor-pointer" onClick={() => setRoleFilter('admin')}>
            <CardTitle className="text-sm font-medium">Admins</CardTitle>
            <span className="text-2xl">👤</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{roleStats.admin}</div>
          </CardContent>
        </Card>

        <Card className={roleFilter === 'teacher' ? 'ring-2 ring-waldorf-sage' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 cursor-pointer" onClick={() => setRoleFilter('teacher')}>
            <CardTitle className="text-sm font-medium">Teachers</CardTitle>
            <span className="text-2xl">👨‍🏫</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{roleStats.teacher}</div>
          </CardContent>
        </Card>

        <Card className={roleFilter === 'parent' ? 'ring-2 ring-waldorf-sage' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 cursor-pointer" onClick={() => setRoleFilter('parent')}>
            <CardTitle className="text-sm font-medium">Parents</CardTitle>
            <span className="text-2xl">👨‍👩‍👧</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{roleStats.parent}</div>
          </CardContent>
        </Card>

        <Card className={roleFilter === 'student' ? 'ring-2 ring-waldorf-sage' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 cursor-pointer" onClick={() => setRoleFilter('student')}>
            <CardTitle className="text-sm font-medium">Students</CardTitle>
            <span className="text-2xl">👶</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{roleStats.student}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Search & Filter</CardTitle>
          <CardDescription>Find users by email or filter by role</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Input
                type="text"
                placeholder="Search by email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={roleFilter === 'all' ? 'default' : 'outline'}
                onClick={() => setRoleFilter('all')}
              >
                All
              </Button>
              <Button
                variant={roleFilter === 'admin' ? 'default' : 'outline'}
                onClick={() => setRoleFilter('admin')}
              >
                Admin
              </Button>
              <Button
                variant={roleFilter === 'teacher' ? 'default' : 'outline'}
                onClick={() => setRoleFilter('teacher')}
              >
                Teacher
              </Button>
              <Button
                variant={roleFilter === 'parent' ? 'default' : 'outline'}
                onClick={() => setRoleFilter('parent')}
              >
                Parent
              </Button>
              <Button
                variant={roleFilter === 'student' ? 'default' : 'outline'}
                onClick={() => setRoleFilter('student')}
              >
                Student
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Users ({filteredUsers.length})</CardTitle>
          <CardDescription>
            Showing {filteredUsers.length} of {users.length} users
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-waldorf-clay">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">{getRoleIcon(user.role)}</span>
                        <div>
                          <p className="font-medium text-waldorf-brown">{user.email}</p>
                          <p className="text-xs text-waldorf-clay">ID: {user.id.substring(0, 8)}...</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(user.role)}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm text-waldorf-clay">
                        {new Date(user.created_at).toLocaleDateString()}
                      </p>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm">
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
