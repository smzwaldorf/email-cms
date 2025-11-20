/**
 * AuditLogPage - Audit trail viewer with timeline
 */

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { generateMockActivity } from '@/lib/mockData';

export function AuditLogPage() {
  const [activities] = useState(generateMockActivity(100));
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter activities
  const filteredActivities = useMemo(() => {
    return activities.filter((activity) => {
      const matchesAction = actionFilter === 'all' || activity.action === actionFilter;
      const matchesSearch =
        activity.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        activity.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesAction && matchesSearch;
    });
  }, [activities, actionFilter, searchQuery]);

  const stats = useMemo(() => {
    return {
      all: activities.length,
      create: activities.filter(a => a.action === 'create').length,
      update: activities.filter(a => a.action === 'update').length,
      publish: activities.filter(a => a.action === 'publish').length,
      delete: activities.filter(a => a.action === 'delete').length,
    };
  }, [activities]);

  // Format relative time
  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Get badge variant for action
  const getActionBadge = (action: string) => {
    switch (action) {
      case 'create':
        return <Badge variant="success">Create</Badge>;
      case 'update':
        return <Badge variant="default">Update</Badge>;
      case 'publish':
        return <Badge variant="outline">Publish</Badge>;
      case 'delete':
        return <Badge variant="destructive">Delete</Badge>;
      default:
        return <Badge variant="secondary">{action}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-waldorf-brown">Audit Log</h2>
          <p className="text-waldorf-clay mt-2">Track all system activities and changes</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card className={actionFilter === 'all' ? 'ring-2 ring-waldorf-sage' : ''}>
          <CardHeader
            className="flex flex-row items-center justify-between space-y-0 pb-2 cursor-pointer"
            onClick={() => setActionFilter('all')}
          >
            <CardTitle className="text-sm font-medium">All Actions</CardTitle>
            <span className="text-2xl">📋</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.all}</div>
          </CardContent>
        </Card>

        <Card className={actionFilter === 'create' ? 'ring-2 ring-waldorf-sage' : ''}>
          <CardHeader
            className="flex flex-row items-center justify-between space-y-0 pb-2 cursor-pointer"
            onClick={() => setActionFilter(actionFilter === 'create' ? 'all' : 'create')}
          >
            <CardTitle className="text-sm font-medium">Create</CardTitle>
            <span className="text-2xl">➕</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.create}</div>
          </CardContent>
        </Card>

        <Card className={actionFilter === 'update' ? 'ring-2 ring-waldorf-sage' : ''}>
          <CardHeader
            className="flex flex-row items-center justify-between space-y-0 pb-2 cursor-pointer"
            onClick={() => setActionFilter(actionFilter === 'update' ? 'all' : 'update')}
          >
            <CardTitle className="text-sm font-medium">Update</CardTitle>
            <span className="text-2xl">✏️</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.update}</div>
          </CardContent>
        </Card>

        <Card className={actionFilter === 'publish' ? 'ring-2 ring-waldorf-sage' : ''}>
          <CardHeader
            className="flex flex-row items-center justify-between space-y-0 pb-2 cursor-pointer"
            onClick={() => setActionFilter(actionFilter === 'publish' ? 'all' : 'publish')}
          >
            <CardTitle className="text-sm font-medium">Publish</CardTitle>
            <span className="text-2xl">🚀</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.publish}</div>
          </CardContent>
        </Card>

        <Card className={actionFilter === 'delete' ? 'ring-2 ring-waldorf-sage' : ''}>
          <CardHeader
            className="flex flex-row items-center justify-between space-y-0 pb-2 cursor-pointer"
            onClick={() => setActionFilter(actionFilter === 'delete' ? 'all' : 'delete')}
          >
            <CardTitle className="text-sm font-medium">Delete</CardTitle>
            <span className="text-2xl">🗑️</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.delete}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>Search Activity</CardTitle>
          <CardDescription>Find activities by user or description</CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            type="text"
            placeholder="Search by user or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </CardContent>
      </Card>

      {/* Activity Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Timeline ({filteredActivities.length})</CardTitle>
          <CardDescription>
            Showing {filteredActivities.length} of {activities.length} activities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredActivities.length === 0 ? (
              <div className="text-center py-8 text-waldorf-clay">No activities found</div>
            ) : (
              filteredActivities.slice(0, 30).map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-4 p-4 rounded-lg border border-waldorf-sage/20 hover:bg-waldorf-cream/10 transition-colors"
                >
                  <div className="flex-shrink-0 mt-1">
                    <div className="w-2 h-2 rounded-full bg-waldorf-sage" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {getActionBadge(activity.action)}
                          <span className="text-sm font-medium text-waldorf-brown">
                            {activity.userName}
                          </span>
                          <span className="text-xs text-waldorf-clay">
                            {activity.userEmail}
                          </span>
                        </div>
                        <p className="text-sm text-waldorf-clay mb-2">{activity.description}</p>
                        {activity.metadata && (
                          <div className="flex gap-2 flex-wrap">
                            {Object.entries(activity.metadata).map(([key, value]) => (
                              <Badge key={key} variant="outline" className="text-xs">
                                {key}: {String(value)}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className="text-xs text-waldorf-clay whitespace-nowrap">
                          {getRelativeTime(activity.timestamp)}
                        </span>
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          {filteredActivities.length > 30 && (
            <div className="mt-4 text-center text-sm text-waldorf-clay">
              Showing first 30 of {filteredActivities.length} activities
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
