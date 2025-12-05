import React from 'react';
import { Eye, MousePointerClick, Clock } from 'lucide-react';

interface ArticleMetric {
  id: string;
  title: string;
  publishedAt: string;
  views: number;
  clicks: number;
  avgTimeSpent: string; // e.g. "2m 30s"
}

interface ArticleAnalyticsTableProps {
  data: ArticleMetric[];
}

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
                <Eye className="w-4 h-4" /> Views
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
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-neutral-100">
            {data.map((article) => (
              <tr key={article.id} className="hover:bg-brand-neutral-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-medium text-brand-neutral-800">{article.title}</div>
                  <div className="text-xs text-brand-neutral-400">{article.publishedAt}</div>
                </td>
                <td className="px-6 py-4 text-right tabular-nums text-brand-neutral-600">
                  {article.views.toLocaleString()}
                </td>
                <td className="px-6 py-4 text-right tabular-nums text-brand-neutral-600">
                  {article.clicks.toLocaleString()}
                </td>
                <td className="px-6 py-4 text-right tabular-nums text-brand-neutral-600">
                  {article.avgTimeSpent}
                </td>
              </tr>
            ))}
            {data.length === 0 && (
                <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-brand-neutral-400">
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
