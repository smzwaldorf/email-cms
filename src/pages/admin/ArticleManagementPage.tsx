/**
 * ArticleManagementPage - Article CRUD with advanced filtering
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
import { generateMockArticles } from '@/lib/mockData';
import type { ArticleRow } from '@/types/database';

export function ArticleManagementPage() {
  const [articles] = useState<ArticleRow[]>(generateMockArticles(100));
  const [visibilityFilter, setVisibilityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter articles
  const filteredArticles = useMemo(() => {
    return articles.filter((article) => {
      const matchesVisibility =
        visibilityFilter === 'all' ||
        article.visibility_type === visibilityFilter;

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'published' && article.is_published) ||
        (statusFilter === 'draft' && !article.is_published);

      const matchesSearch =
        article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        article.week_number.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesVisibility && matchesStatus && matchesSearch;
    });
  }, [articles, visibilityFilter, statusFilter, searchQuery]);

  const stats = useMemo(() => {
    return {
      total: articles.length,
      published: articles.filter(a => a.is_published).length,
      draft: articles.filter(a => !a.is_published).length,
      public: articles.filter(a => a.visibility_type === 'public').length,
      restricted: articles.filter(a => a.visibility_type === 'class_restricted').length,
    };
  }, [articles]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-waldorf-brown">Article Management</h2>
          <p className="text-waldorf-clay mt-2">Manage articles, content, and visibility</p>
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
          Create Article
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <span className="text-2xl">📄</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card className={statusFilter === 'published' ? 'ring-2 ring-waldorf-sage' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 cursor-pointer" onClick={() => setStatusFilter(statusFilter === 'published' ? 'all' : 'published')}>
            <CardTitle className="text-sm font-medium">Published</CardTitle>
            <span className="text-2xl">✅</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.published}</div>
          </CardContent>
        </Card>

        <Card className={statusFilter === 'draft' ? 'ring-2 ring-waldorf-sage' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 cursor-pointer" onClick={() => setStatusFilter(statusFilter === 'draft' ? 'all' : 'draft')}>
            <CardTitle className="text-sm font-medium">Draft</CardTitle>
            <span className="text-2xl">📝</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.draft}</div>
          </CardContent>
        </Card>

        <Card className={visibilityFilter === 'public' ? 'ring-2 ring-waldorf-sage' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 cursor-pointer" onClick={() => setVisibilityFilter(visibilityFilter === 'public' ? 'all' : 'public')}>
            <CardTitle className="text-sm font-medium">Public</CardTitle>
            <span className="text-2xl">🌍</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.public}</div>
          </CardContent>
        </Card>

        <Card className={visibilityFilter === 'class_restricted' ? 'ring-2 ring-waldorf-sage' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 cursor-pointer" onClick={() => setVisibilityFilter(visibilityFilter === 'class_restricted' ? 'all' : 'class_restricted')}>
            <CardTitle className="text-sm font-medium">Restricted</CardTitle>
            <span className="text-2xl">🔒</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.restricted}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Search & Filter</CardTitle>
          <CardDescription>Find articles by title, week, or filter by status and visibility</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <Input
              type="text"
              placeholder="Search by title or week number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="flex gap-2 flex-wrap">
              <div className="flex gap-2">
                <span className="text-sm text-waldorf-clay self-center">Status:</span>
                <Button
                  size="sm"
                  variant={statusFilter === 'all' ? 'default' : 'outline'}
                  onClick={() => setStatusFilter('all')}
                >
                  All
                </Button>
                <Button
                  size="sm"
                  variant={statusFilter === 'published' ? 'default' : 'outline'}
                  onClick={() => setStatusFilter('published')}
                >
                  Published
                </Button>
                <Button
                  size="sm"
                  variant={statusFilter === 'draft' ? 'default' : 'outline'}
                  onClick={() => setStatusFilter('draft')}
                >
                  Draft
                </Button>
              </div>
              <div className="flex gap-2">
                <span className="text-sm text-waldorf-clay self-center">Visibility:</span>
                <Button
                  size="sm"
                  variant={visibilityFilter === 'all' ? 'default' : 'outline'}
                  onClick={() => setVisibilityFilter('all')}
                >
                  All
                </Button>
                <Button
                  size="sm"
                  variant={visibilityFilter === 'public' ? 'default' : 'outline'}
                  onClick={() => setVisibilityFilter('public')}
                >
                  Public
                </Button>
                <Button
                  size="sm"
                  variant={visibilityFilter === 'class_restricted' ? 'default' : 'outline'}
                  onClick={() => setVisibilityFilter('class_restricted')}
                >
                  Class Restricted
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Articles Table */}
      <Card>
        <CardHeader>
          <CardTitle>Articles ({filteredArticles.length})</CardTitle>
          <CardDescription>
            Showing {filteredArticles.length} of {articles.length} articles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Week</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Visibility</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredArticles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-waldorf-clay">
                    No articles found
                  </TableCell>
                </TableRow>
              ) : (
                filteredArticles.slice(0, 20).map((article) => (
                  <TableRow key={article.id}>
                    <TableCell>
                      <div className="max-w-[300px]">
                        <p className="font-medium text-waldorf-brown truncate">{article.title}</p>
                        <p className="text-xs text-waldorf-clay">ID: {article.short_id}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{article.week_number}</Badge>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm text-waldorf-clay">{article.author || 'Unknown'}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{article.article_order}</Badge>
                    </TableCell>
                    <TableCell>
                      {article.visibility_type === 'public' ? (
                        <Badge variant="outline">🌍 Public</Badge>
                      ) : (
                        <Badge variant="outline">🔒 Restricted</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {article.is_published ? (
                        <Badge variant="success">Published</Badge>
                      ) : (
                        <Badge variant="warning">Draft</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm">
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-600">
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {filteredArticles.length > 20 && (
            <div className="mt-4 text-center text-sm text-waldorf-clay">
              Showing first 20 of {filteredArticles.length} articles
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
