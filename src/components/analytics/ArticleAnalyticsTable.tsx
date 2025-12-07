import React from 'react';
import { Eye, MousePointerClick, Clock, Flame } from 'lucide-react';
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

export const ArticleAnalyticsTable: React.FC<ArticleAnalyticsTableProps> = ({ data }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-brand-neutral-100 overflow-hidden">
      <div className="p-6 border-b border-brand-neutral-100">
        <h3 className="text-lg font-semibold text-brand-neutral-800">Article Performance</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-brand-neutral-50 text-brand-neutral-500">
            <tr>
              <th className="px-6 py-4 font-medium">Article Title</th>
              <th className="px-6 py-4 font-medium text-right flex items-center justify-end gap-1">
                <Eye className="w-4 h-4 ml-1" /> Unique
              </th>
              <th className="px-6 py-4 font-medium text-right">
                Views
              </th>
              <th className="px-6 py-4 font-medium text-right">
                <div className="flex items-center justify-end gap-1">
                  <MousePointerClick className="w-4 h-4" /> Clicks
                </div>
              </th>
              <th className="px-6 py-4 font-medium text-right">
                 <div className="flex items-center justify-end gap-1">
                  <Clock className="w-4 h-4" /> Avg. Time
                </div>
              </th>
              <th className="px-6 py-4 font-medium text-right">
                <div className="flex items-center justify-end gap-1">
                  <Flame className="w-4 h-4" /> Hotness
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-neutral-100">
            {data.map((article) => (
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
            {data.length === 0 && (
                <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-brand-neutral-400">
                        No articles found for this period.
                    </td>
                </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

