import React, { useState } from 'react';
import { useNewsletterMetrics, useGenerateSnapshots } from '@/hooks/useAnalyticsQuery';
import { KPICard } from '@/components/analytics/KPICard';
import { TrendChart } from '@/components/analytics/TrendChart';
import { ArticleAnalyticsTable } from '@/components/analytics/ArticleAnalyticsTable';
import { RefreshCw, Download, Calendar } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout'; // Assuming standard layout

export const AnalyticsDashboardPage: React.FC = () => {
    // State for filters
    const [selectedWeek, setSelectedWeek] = useState('2025-W01');
    const { metrics, loading } = useNewsletterMetrics(selectedWeek);
    const { generate, generating } = useGenerateSnapshots();

    // Mock data for graphs (Phase 7 will attach real historical data)
    const mockTrendData = [
        { name: 'Week 48', openRate: 45, clickRate: 12 },
        { name: 'Week 49', openRate: 52, clickRate: 15 },
        { name: 'Week 50', openRate: 48, clickRate: 14 },
        { name: 'Week 51', openRate: 61, clickRate: 18 },
        { name: 'Week 52', openRate: 55, clickRate: 16 },
        { name: 'Week 01', openRate: metrics ? metrics.openRate : 0, clickRate: metrics ? metrics.clickRate : 0 },
    ];

    // Mock data for table
    const mockArticleData = [
        { id: '1', title: 'Main Lesson: Geometric Drawing', publishedAt: 'Jan 5, 2025', views: metrics?.totalViews || 120, clicks: 45, avgTimeSpent: '4m 12s' },
        { id: '2', title: 'Upcoming Field Trip', publishedAt: 'Jan 5, 2025', views: 98, clicks: 23, avgTimeSpent: '1m 30s' },
        { id: '3', title: 'Parent Evening Summary', publishedAt: 'Jan 5, 2025', views: 85, clicks: 12, avgTimeSpent: '2m 45s' },
    ];

    return (
        <div className="min-h-screen bg-brand-neutral-50 p-8 space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-brand-neutral-800">Analytics Dashboard</h1>
                    <p className="text-brand-neutral-500">Overview of newsletter performance and engagement.</p>
                </div>
                
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-neutral-400" />
                        <select 
                            value={selectedWeek}
                            onChange={(e) => setSelectedWeek(e.target.value)}
                            className="pl-9 pr-4 py-2 border border-brand-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                        >
                            <option value="2025-W01">Week 01, 2025</option>
                            <option value="2024-W52">Week 52, 2024</option>
                             {/* Add dynamic week fetching later */}
                        </select>
                    </div>

                    <button 
                        onClick={() => generate()} 
                        disabled={generating}
                        className="p-2 text-brand-neutral-600 hover:bg-white rounded-lg border border-transparent hover:border-brand-neutral-200 transition-all"
                        title="Refresh Data"
                    >
                        <RefreshCw className={`w-5 h-5 ${generating ? 'animate-spin' : ''}`} />
                    </button>
                    
                    <button className="flex items-center gap-2 px-4 py-2 bg-white border border-brand-neutral-200 rounded-lg text-sm font-medium text-brand-neutral-700 hover:bg-brand-neutral-50 transition-colors">
                        <Download className="w-4 h-4" /> Export
                    </button>
                </div>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <KPICard 
                    title="Open Rate" 
                    value={`${metrics?.openRate.toFixed(1) || 0}%`} 
                    trend={5.2} 
                    icon={<div className="p-2 bg-purple-50 rounded-lg text-purple-600"><EyeIcon /></div>}
                />
                <KPICard 
                    title="Click Rate" 
                    value={`${metrics?.clickRate.toFixed(1) || 0}%`} 
                    trend={-1.5}
                    icon={<div className="p-2 bg-emerald-50 rounded-lg text-emerald-600"><ClickIcon /></div>}
                />
                <KPICard 
                    title="Total Views" 
                    value={metrics?.totalViews.toLocaleString() || '0'} 
                    trend={12.5}
                    icon={<div className="p-2 bg-blue-50 rounded-lg text-blue-600"><ViewIcon /></div>}
                />
                <KPICard 
                    title="Avg. Time Spent" 
                    value="3m 42s" 
                    trend={0}
                    icon={<div className="p-2 bg-orange-50 rounded-lg text-orange-600"><TimeIcon /></div>}
                />
            </div>

            {/* Charts & Tables Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <TrendChart data={mockTrendData} />
                    <ArticleAnalyticsTable data={mockArticleData} />
                </div>
                
                <div className="space-y-6">
                    {/* Secondary Widgets / Breakdown - Placeholder for now */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-brand-neutral-100 h-full">
                         <h3 className="text-lg font-semibold text-brand-neutral-800 mb-4">Engagement by Class</h3>
                         <div className="space-y-4">
                            {['Class 1', 'Class 2', 'Class 3'].map((cls, i) => (
                                <div key={i} className="flex justify-between items-center text-sm">
                                    <span className="text-brand-neutral-600">{cls}</span>
                                    <div className="w-32 h-2 bg-brand-neutral-100 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-brand-primary rounded-full" 
                                            style={{ width: `${60 + i * 10}%` }}
                                        />
                                    </div>
                                    <span className="font-medium">{60 + i * 10}%</span>
                                </div>
                            ))}
                         </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Simple Icons
const EyeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
);
const ClickIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 4.1 12 6"/><path d="m5.1 8-2.9-.8"/><path d="m6 12-1.9 2"/><path d="M7.2 2.2 8 5.1"/><path d="M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z"/></svg>
);
const ViewIcon = () => (
     <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
);
const TimeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
);
