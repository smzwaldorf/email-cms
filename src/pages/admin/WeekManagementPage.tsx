/**
 * WeekManagementPage - Newsletter week management with mock data
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
import { generateMockWeeks, generateMockArticles } from '@/lib/mockData';
import type { NewsletterWeekRow } from '@/types/database';

export function WeekManagementPage() {
  const [weeks] = useState<NewsletterWeekRow[]>(generateMockWeeks(24));
  const [articles] = useState(generateMockArticles(100));
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter weeks
  const filteredWeeks = useMemo(() => {
    return weeks.filter((week) => {
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'published' && week.is_published) ||
        (statusFilter === 'draft' && !week.is_published);
      const matchesSearch = week.week_number.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [weeks, statusFilter, searchQuery]);

  // Count articles per week
  const getArticleCount = (weekNumber: string) => {
    return articles.filter(a => a.week_number === weekNumber).length;
  };

  const stats = useMemo(() => {
    return {
      total: weeks.length,
      published: weeks.filter(w => w.is_published).length,
      draft: weeks.filter(w => !w.is_published).length,
    };
  }, [weeks]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-waldorf-brown">Week Management</h2>
          <p className="text-waldorf-clay mt-2">Manage newsletter weeks and publication status</p>
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
          Create Week
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className={statusFilter === 'all' ? 'ring-2 ring-waldorf-sage' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 cursor-pointer" onClick={() => setStatusFilter('all')}>
            <CardTitle className="text-sm font-medium">All Weeks</CardTitle>
            <span className="text-2xl">📅</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card className={statusFilter === 'published' ? 'ring-2 ring-waldorf-sage' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 cursor-pointer" onClick={() => setStatusFilter('published')}>
            <CardTitle className="text-sm font-medium">Published</CardTitle>
            <span className="text-2xl">✅</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.published}</div>
          </CardContent>
        </Card>

        <Card className={statusFilter === 'draft' ? 'ring-2 ring-waldorf-sage' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 cursor-pointer" onClick={() => setStatusFilter('draft')}>
            <CardTitle className="text-sm font-medium">Draft</CardTitle>
            <span className="text-2xl">📝</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.draft}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Search & Filter</CardTitle>
          <CardDescription>Find weeks by number or filter by status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Input
                type="text"
                placeholder="Search by week number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('all')}
              >
                All
              </Button>
              <Button
                variant={statusFilter === 'published' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('published')}
              >
                Published
              </Button>
              <Button
                variant={statusFilter === 'draft' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('draft')}
              >
                Draft
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Weeks Table */}
      <Card>
        <CardHeader>
          <CardTitle>Weeks ({filteredWeeks.length})</CardTitle>
          <CardDescription>
            Showing {filteredWeeks.length} of {weeks.length} weeks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Week Number</TableHead>
                <TableHead>Release Date</TableHead>
                <TableHead>Articles</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredWeeks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-waldorf-clay">
                    No weeks found
                  </TableCell>
                </TableRow>
              ) : (
                filteredWeeks.map((week) => (
                  <TableRow key={week.week_number}>
                    <TableCell>
                      <div className="font-medium text-waldorf-brown">{week.week_number}</div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm text-waldorf-clay">
                        {new Date(week.release_date).toLocaleDateString()}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getArticleCount(week.week_number)} articles
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {week.is_published ? (
                        <Badge variant="success">Published</Badge>
                      ) : (
                        <Badge variant="warning">Draft</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                        <Button variant="ghost" size="sm">
                          Edit
                        </Button>
                        {!week.is_published && (
                          <Button variant="ghost" size="sm" className="text-green-600">
                            Publish
                          </Button>
                        )}
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
