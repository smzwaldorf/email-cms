/**
 * FamilyManagementPage - Family and enrollment management
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
import { generateMockFamilies, generateMockUsers, generateMockClasses } from '@/lib/mockData';

export function FamilyManagementPage() {
  const [families] = useState(generateMockFamilies(30));
  const [users] = useState(generateMockUsers(100));
  const [classes] = useState(generateMockClasses());
  const [searchQuery, setSearchQuery] = useState('');

  // Filter families
  const filteredFamilies = useMemo(() => {
    return families.filter((family) => {
      return family.family_code.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [families, searchQuery]);

  // Mock data for each family
  const getFamilyData = (familyId: string) => {
    const parents = users.filter(u => u.role === 'parent').slice(0, Math.random() > 0.5 ? 2 : 1);
    const children = users.filter(u => u.role === 'student').slice(0, Math.floor(Math.random() * 3) + 1);
    const enrolledClasses = classes.slice(0, Math.floor(Math.random() * 2) + 1);

    return {
      parents,
      children,
      enrolledClasses,
    };
  };

  const stats = {
    total: families.length,
    withParents: Math.floor(families.length * 0.95),
    withChildren: Math.floor(families.length * 0.9),
    avgChildren: 1.8,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-waldorf-brown">Family Management</h2>
          <p className="text-waldorf-clay mt-2">Manage families, parents, and child enrollments</p>
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
          Create Family
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Families</CardTitle>
            <span className="text-2xl">👨‍👩‍👧‍👦</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-waldorf-clay mt-1">Active families</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">With Parents</CardTitle>
            <span className="text-2xl">👨‍👩‍👧</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.withParents}</div>
            <p className="text-xs text-waldorf-clay mt-1">Parent accounts linked</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">With Children</CardTitle>
            <span className="text-2xl">👶</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.withChildren}</div>
            <p className="text-xs text-waldorf-clay mt-1">Child enrollments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Children</CardTitle>
            <span className="text-2xl">📊</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgChildren}</div>
            <p className="text-xs text-waldorf-clay mt-1">Per family</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>Search Families</CardTitle>
          <CardDescription>Find families by family code</CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            type="text"
            placeholder="Search by family code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </CardContent>
      </Card>

      {/* Families Table */}
      <Card>
        <CardHeader>
          <CardTitle>Families ({filteredFamilies.length})</CardTitle>
          <CardDescription>
            Showing {filteredFamilies.length} of {families.length} families
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Family Code</TableHead>
                <TableHead>Parents</TableHead>
                <TableHead>Children</TableHead>
                <TableHead>Enrolled Classes</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFamilies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-waldorf-clay">
                    No families found
                  </TableCell>
                </TableRow>
              ) : (
                filteredFamilies.slice(0, 15).map((family) => {
                  const data = getFamilyData(family.id);

                  return (
                    <TableRow key={family.id}>
                      <TableCell>
                        <div className="font-medium text-waldorf-brown">{family.family_code}</div>
                        <p className="text-xs text-waldorf-clay">ID: {family.id.substring(0, 8)}...</p>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {data.parents.map((parent, idx) => (
                            <Badge key={idx} variant="outline" className="mr-1">
                              {parent.email.split('@')[0]}
                            </Badge>
                          ))}
                          {data.parents.length === 0 && (
                            <span className="text-xs text-waldorf-clay">No parents</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{data.children.length} children</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {data.enrolledClasses.map((cls, idx) => (
                            <Badge key={idx} variant="outline" className="mr-1">
                              {cls.id}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-waldorf-clay">
                          {new Date(family.created_at).toLocaleDateString()}
                        </p>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm">
                            View
                          </Button>
                          <Button variant="ghost" size="sm">
                            Edit
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          {filteredFamilies.length > 15 && (
            <div className="mt-4 text-center text-sm text-waldorf-clay">
              Showing first 15 of {filteredFamilies.length} families
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
