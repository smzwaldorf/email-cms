import React, { useState, useMemo } from 'react';
import { Eye, MousePointerClick, Clock, Flame, ChevronUp, ChevronDown, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatReadLatency } from '@/hooks/useAnalyticsQuery';

interface ArticleMetric {
  id: string;
  title: string;
  publishedAt: string;

  views: number;
  uniqueViews: number;
  clicks: number;
  avgTimeSpent: number; // Seconds
  avgTimeSpentFormatted: string; // e.g. "2m 30s"
  hotnessScore?: number; // 0-100
  avgReadLatencyMinutes?: number;
}

interface ArticleAnalyticsTableProps {
  data: ArticleMetric[];
}

// Helper component for hotness badge
const HotnessBadge: React.FC<{ score?: number; latency?: number }> = ({ score, latency }) => {
  if (score === undefined) return <span className="text-brand-neutral-400">-</span>;
  
  let emoji = '❄️';
  let label = 'Cold';
  let bgColor = 'bg-blue-100 text-blue-700';
  
  if (score >= 70) {
    emoji = '🔥';
    label = 'Hot';
    bgColor = 'bg-red-100 text-red-700';
  } else if (score >= 40) {
    emoji = '☀️';
    label = 'Warm';
    bgColor = 'bg-orange-100 text-orange-700';
  }
  
  const latencyStr = latency !== undefined ? formatReadLatency(latency) : '';
  
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${bgColor}`}>
        {emoji} {label}
      </span>
      {latencyStr && (
        <span className="text-xs text-brand-neutral-400">{latencyStr} avg</span>
      )}
    </div>
  );
};

type SortField = keyof ArticleMetric;
type SortDirection = 'asc' | 'desc';

export const ArticleAnalyticsTable: React.FC<ArticleAnalyticsTableProps> = ({ data }) => {
  const [sortField, setSortField] = useState<SortField>('views');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setPage(1); // Reset to first page on sort
  };

  const filteredData = useMemo(() => {
    return data.filter(article => 
      article.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [data, searchTerm]);

  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      
      if (aValue === undefined && bValue === undefined) return 0;
      if (aValue === undefined) return 1;
      if (bValue === undefined) return -1;

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue) 
          : bValue.localeCompare(aValue);
      }
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortField, sortDirection]);

  const paginatedData = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return sortedData.slice(startIndex, startIndex + pageSize);
  }, [sortedData, page]);

  const totalPages = Math.ceil(sortedData.length / pageSize);

  const SortIcon = ({ field }: { field: SortField }) => {
      if (sortField !== field) return <div className="w-4 h-4 ml-1 opacity-0 group-hover:opacity-30"><ChevronDown className="w-4 h-4" /></div>;
      return <div className="w-4 h-4 ml-1 text-brand-primary">{sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</div>;
  };

  const renderHeader = (label: string, field: SortField, icon?: React.ReactNode, alignRight = true) => (
      <th 
          className={`px-6 py-4 font-medium cursor-pointer group hover:bg-brand-neutral-50 transition-colors ${alignRight ? 'text-right' : 'text-left'}`}
          onClick={() => handleSort(field)}
      >
          <div className={`flex items-center ${alignRight ? 'justify-end' : 'justify-start'}`}>
              {!alignRight && icon && <span className="mr-2">{icon}</span>}
              {label}
              {alignRight && icon && <span className="ml-1">{icon}</span>}
              <SortIcon field={field} />
          </div>
      </th>
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-brand-neutral-100 overflow-hidden">
      <div className="p-6 border-b border-brand-neutral-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h3 className="text-lg font-semibold text-brand-neutral-800">Article Performance</h3>
        
        {/* Search Input */}
        <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-neutral-400" />
            <input 
                type="text" 
                placeholder="Search articles..." 
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                className="pl-9 pr-4 py-2 border border-brand-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 w-full sm:w-64"
            />
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-brand-neutral-50 text-brand-neutral-500">
            <tr>
              {renderHeader('Article Title', 'title', null, false)}
              {renderHeader('Unique', 'uniqueViews', <Eye className="w-4 h-4" />)}
              {renderHeader('Views', 'views', null)}
              {renderHeader('Clicks', 'clicks', <MousePointerClick className="w-4 h-4" />)}
              {renderHeader('Avg. Time', 'avgTimeSpent', <Clock className="w-4 h-4" />)}
              {renderHeader('Hotness', 'hotnessScore', <Flame className="w-4 h-4" />)}
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-neutral-100">
            {paginatedData.map((article) => (
              <tr key={article.id} className="hover:bg-brand-neutral-50 transition-colors">
                <td className="px-6 py-4">
                  <Link to={`/admin/analytics/article/${article.id}/readers`} className="group">
                      <div className="font-medium text-brand-neutral-800 group-hover:text-brand-primary transition-colors">{article.title}</div>
                      <div className="text-xs text-brand-neutral-400">{article.publishedAt}</div>
                  </Link>
                </td>
                <td className="px-6 py-4 text-right tabular-nums text-brand-neutral-600 font-medium">
                  <Link to={`/admin/analytics/article/${article.id}/readers`} className="hover:text-brand-primary hover:underline decoration-brand-primary/30 underline-offset-2">
                    {article.uniqueViews.toLocaleString()}
                  </Link>
                </td>
                <td className="px-6 py-4 text-right tabular-nums text-brand-neutral-600">
                  {article.views.toLocaleString()}
                </td>
                <td className="px-6 py-4 text-right tabular-nums text-brand-neutral-600">
                  {article.clicks.toLocaleString()}
                </td>
                <td className="px-6 py-4 text-right tabular-nums text-brand-neutral-600">
                  {article.avgTimeSpentFormatted || '-'}
                </td>
                <td className="px-6 py-4 text-right">
                  <HotnessBadge score={article.hotnessScore} latency={article.avgReadLatencyMinutes} />
                </td>
              </tr>
            ))}
            {paginatedData.length === 0 && (
                <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-brand-neutral-400">
                        {searchTerm ? 'No articles found matching your search.' : 'No articles found for this period.'}
                    </td>
                </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-brand-neutral-100 flex items-center justify-between">
              <div className="text-sm text-brand-neutral-500">
                  Showing <span className="font-medium">{(page - 1) * pageSize + 1}</span> to <span className="font-medium">{Math.min(page * pageSize, sortedData.length)}</span> of <span className="font-medium">{sortedData.length}</span> results
              </div>
              <div className="flex items-center gap-2">
                  <button 
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      aria-label="Previous Page"
                      className="p-2 border border-brand-neutral-200 rounded-lg hover:bg-brand-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                      <ChevronLeft className="w-4 h-4 text-brand-neutral-600" />
                  </button>
                  <span className="text-sm font-medium text-brand-neutral-700">
                      Page {page} of {totalPages}
                  </span>
                  <button 
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      aria-label="Next Page"
                      className="p-2 border border-brand-neutral-200 rounded-lg hover:bg-brand-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                      <ChevronRight className="w-4 h-4 text-brand-neutral-600" />
                  </button>
              </div>
          </div>
      )}
    </div>
  );
};

