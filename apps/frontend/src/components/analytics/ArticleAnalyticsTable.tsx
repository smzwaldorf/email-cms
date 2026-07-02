import React, { useState, useMemo } from 'react';
import { Eye, MousePointerClick, Clock, Flame, ChevronUp, ChevronDown, Search } from 'lucide-react';
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
  
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
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

  const SortIcon = ({ field }: { field: SortField }) => {
      if (sortField !== field) return <div className="w-4 h-4 ml-1 opacity-0 group-hover:opacity-30"><ChevronDown className="w-4 h-4" /></div>;
      return <div className="w-4 h-4 ml-1 text-brand-primary">{sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</div>;
  };

  const renderHeader = (label: string, field: SortField, widthClass: string, icon?: React.ReactNode, alignRight = true) => (
      <div 
          className={`${widthClass} py-3 px-4 font-medium cursor-pointer group hover:bg-brand-neutral-50 transition-colors flex items-center ${alignRight ? 'justify-end' : 'justify-start'}`}
          onClick={() => handleSort(field)}
      >
          {!alignRight && icon && <span className="mr-2">{icon}</span>}
          {label}
          {alignRight && icon && <span className="ml-1">{icon}</span>}
          <SortIcon field={field} />
      </div>
  );

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const article = sortedData[index];
    return (
      <div style={style} className="flex items-center border-b border-brand-neutral-50 hover:bg-brand-neutral-50 transition-colors" data-testid="article-row">
        <div className="w-[40%] px-4 py-2">
            <Link to={`/admin/analytics/article/${article.id}`} className="group block">
                <div className="font-medium text-brand-neutral-800 group-hover:text-brand-primary transition-colors truncate" title={article.title}>{article.title}</div>
                <div className="text-xs text-brand-neutral-400">{article.publishedAt}</div>
            </Link>
        </div>
        <div className="w-[12%] px-4 py-2 text-right tabular-nums text-brand-neutral-600 font-medium">
             <Link to={`/admin/analytics/article/${article.id}/readers`} className="hover:text-brand-primary hover:underline decoration-brand-primary/30 underline-offset-2">
                {article.uniqueViews.toLocaleString()}
            </Link>
        </div>
        <div className="w-[12%] px-4 py-2 text-right tabular-nums text-brand-neutral-600">
            {article.views.toLocaleString()}
        </div>
        <div className="w-[12%] px-4 py-2 text-right tabular-nums text-brand-neutral-600">
            {article.clicks.toLocaleString()}
        </div>
        <div className="w-[12%] px-4 py-2 text-right tabular-nums text-brand-neutral-600">
            {article.avgTimeSpentFormatted || '-'}
        </div>
        <div className="w-[12%] px-4 py-2 text-right">
             <HotnessBadge score={article.hotnessScore} latency={article.avgReadLatencyMinutes} />
        </div>
      </div>
    );
  };

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
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 border border-brand-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 w-full sm:w-64"
            />
        </div>
      </div>
      
      {/* Header Row */}
      <div className="flex bg-brand-neutral-50 text-xs text-brand-neutral-500 uppercase tracking-wider border-b border-brand-neutral-100">
         {renderHeader('Article Title', 'title', 'w-[40%]', null, false)}
         {renderHeader('Unique', 'uniqueViews', 'w-[12%]', <Eye className="w-4 h-4" />)}
         {renderHeader('Views', 'views', 'w-[12%]', null)}
         {renderHeader('Clicks', 'clicks', 'w-[12%]', <MousePointerClick className="w-4 h-4" />)}
         {renderHeader('Avg. Time', 'avgTimeSpent', 'w-[12%]', <Clock className="w-4 h-4" />)}
         {renderHeader('Hotness', 'hotnessScore', 'w-[12%]', <Flame className="w-4 h-4" />)}
      </div>

      <div className="w-full">
         {sortedData.length > 0 ? (
            <div style={{ height: 500, overflowY: 'auto' }}>
                {sortedData.map((item, index) => (
                    <Row 
                        key={item.id} 
                        index={index} 
                        style={{ height: 72, width: '100%' }} 
                    />
                ))}
            </div>
         ) : (
            <div className="px-6 py-12 text-center text-brand-neutral-400">
                {searchTerm ? 'No articles found matching your search.' : 'No articles found for this period.'}
            </div>
         )}
      </div>
    </div>
  );
};
