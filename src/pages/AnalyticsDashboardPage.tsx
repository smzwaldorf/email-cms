import React, { useState, useMemo } from 'react';
import { useNewsletterMetrics, useGenerateSnapshots, useTrendStats, useArticleStats, useAvailableWeeks, useClassEngagement, useTopicHotness } from '@/hooks/useAnalyticsQuery';
import { KPICard } from '@/components/analytics/KPICard';
import { TrendChart } from '@/components/analytics/TrendChart';
import { ArticleAnalyticsTable } from '@/components/analytics/ArticleAnalyticsTable';
import { ClassComparisonTable } from '@/components/analytics/ClassComparisonTable';
import { RefreshCw, Download, Calendar } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';

export const AnalyticsDashboardPage: React.FC = () => {
    const [selectedWeek, setSelectedWeek] = useState<string>('');
    const { weeks, loading: weeksLoading } = useAvailableWeeks();
    const [timeRange, setTimeRange] = React.useState<'4' | '12'>('12');
    
    // Set default selected week when weeks load
    React.useEffect(() => {
        if (weeks.length > 0 && !selectedWeek) {
            setSelectedWeek(weeks[0].week_number);
        }
    }, [weeks, selectedWeek]);
    
    const { metrics, loading: metricsLoading, refetch: refetchMetrics } = useNewsletterMetrics(selectedWeek);
    const { stats: articleData, loading: articlesLoading, refetch: refetchArticles } = useArticleStats(selectedWeek);
    const { trend: trendData, loading: trendsLoading, refetch: refetchTrends } = useTrendStats();
    const { data: classEngagement, loading: classLoading, refetch: refetchClasses } = useClassEngagement(selectedWeek);
    const { hotness: hotnessData, refetch: refetchHotness } = useTopicHotness(selectedWeek);
    const { generate, generating } = useGenerateSnapshots();

    // Filter Trends based on Range
    const displayTrends = React.useMemo(() => {
        if (!trendData) return [];
        const limit = parseInt(timeRange);
        // trendData is commonly sorted Oldest -> Newest (Week 1, Week 2...)
        // If we want "Last 4 Weeks", we take the LAST 4 items.
        // If trendData is [W1, W2, W3... W12], slice(-4) gives [W9, W10, W11, W12]
        // Which is correct for a "Trend over time" chart.
        return trendData.slice(-limit);
    }, [trendData, timeRange]);

    // Merge hotness data into article stats
    const enrichedArticleData = useMemo(() => {
        if (!articleData || articleData.length === 0) return articleData;
        
        const hotnessMap = new Map(hotnessData.map(h => [h.articleId, h]));
        
        return articleData.map(article => {
            const hotness = hotnessMap.get(article.id);
            return {
                ...article,
                hotnessScore: hotness?.hotnessScore,
                avgReadLatencyMinutes: hotness?.avgReadLatencyMinutes
            };
        });
    }, [articleData, hotnessData]);



    // Track if the tab has been hidden/backgrounded since load
    const hasBeenHidden = React.useRef(false);

    React.useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                hasBeenHidden.current = true;
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, []);

    const handleManualRefresh = () => {
        // If the tab was backgrounded, force a hard reload to ensure clean connection state
        if (hasBeenHidden.current) {
            console.log('🔄 Tab was backgrounded, performing hard reload...');
            window.location.reload();
            return;
        }

        // Otherwise, just refetch data (soft refresh)
        refetchMetrics();
        refetchArticles();
        refetchClasses();
        refetchTrends();
        refetchHotness();
    };

    // Calculate Trends
    const trends = useMemo(() => {
        if (!metrics || !trendData || trendData.length === 0 || !selectedWeek) {
            return { openRate: 0, clickRate: 0, timeSpent: 0 };
        }

        const currentIndex = trendData.findIndex(t => t.name === selectedWeek);
        // We need previous week data.
        // trendData is commonly sorted Ascending (oldest first) if it comes from our reverse loop logic which pushes in order of processing, 
        // wait. aggregator.getTrendStats processes reverse(descending) -> Ascending. 
        // So [Week1, Week2, Week3].
        // If selected is Week3 (index 2), prev is Week2 (index 1).
        
        if (currentIndex <= 0) return { openRate: 0, clickRate: 0, timeSpent: 0 };
        
        const currentParams = trendData[currentIndex];
        const prevParams = trendData[currentIndex - 1];
        
        // Note: trends in KPICard usually expect absolute difference for percentages (pp)
        // and percentage change for values? Or just simple diff?
        // Let's assume absolute difference for Rates, and Percentage Change for Time.
        
        const openRateTrend = currentParams.openRate - prevParams.openRate;
        const clickRateTrend = currentParams.clickRate - prevParams.clickRate;
        
        // Time is seconds.
        const currentTime = (currentParams as any).avgTimeSpent || 0; // Cast as any because we just added it and Interface might not be updated in context yet? No, it's run-time safe. interface needs update in TrendChart.tsx? No, trendData comes from hook type.
        const prevTime = (prevParams as any).avgTimeSpent || 0;
        
        // Avoid division by zero
        const timeTrend = prevTime === 0 ? 0 : ((currentTime - prevTime) / prevTime) * 100;

        return {
            openRate: openRateTrend,
            clickRate: clickRateTrend,
            timeSpent: timeTrend
        };
    }, [metrics, trendData, selectedWeek]); // Use full trendData here for accuracy

    const formatDuration = (seconds?: number) => {
        if (!seconds) return '-';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}m ${s}s`;
    };



    return (
        <AdminLayout activeTab="analytics">
            <div className="space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-brand-neutral-800">Analytics Dashboard</h1>
                        <p className="text-brand-neutral-500">Overview of newsletter performance and engagement.</p>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        {/* Time Range Selector */}
                        <div className="flex bg-brand-neutral-100 rounded-lg p-1">
                            <button
                                onClick={() => setTimeRange('4')}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                                    timeRange === '4' 
                                    ? 'bg-white text-brand-neutral-800 shadow-sm' 
                                    : 'text-brand-neutral-500 hover:text-brand-neutral-700'
                                }`}
                            >
                                Last 4 Weeks
                            </button>
                            <button
                                onClick={() => setTimeRange('12')}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                                    timeRange === '12' 
                                    ? 'bg-white text-brand-neutral-800 shadow-sm' 
                                    : 'text-brand-neutral-500 hover:text-brand-neutral-700'
                                }`}
                            >
                                Last 12 Weeks
                            </button>
                        </div>

                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-neutral-400" />
                            <select 
                                value={selectedWeek}
                                onChange={(e) => setSelectedWeek(e.target.value)}
                                className="pl-9 pr-4 py-2 border border-brand-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                                disabled={weeksLoading}
                            >
                                {weeksLoading ? (
                                    <option>Loading...</option>
                                ) : (
                                    weeks.map(week => (
                                        <option key={week.week_number} value={week.week_number}>
                                            {/* Format: Week 01, 2025 */}
                                            {/* Basic formatting assuming standard week number format like '2025-W01' */}
                                            {week.week_number.replace('-', ' ')}
                                        </option>
                                    ))
                                )}
                            </select>
                        </div>



                        <button 
                            onClick={handleManualRefresh}
                            className="p-2 text-brand-neutral-600 hover:bg-white rounded-lg border border-transparent hover:border-brand-neutral-200 transition-all"
                            title="Reload Data"
                        >
                            <RefreshCw className="w-5 h-5" />
                        </button>

                        <button 
                            onClick={() => generate()} 
                            disabled={generating}
                            className="px-3 py-2 text-xs font-medium text-brand-neutral-600 bg-brand-neutral-50 hover:bg-brand-neutral-100 rounded-lg border border-brand-neutral-200 transition-colors disabled:opacity-50 whitespace-nowrap"
                            title="Generate Daily Snapshot (Admin)"
                        >
                            {generating ? 'Generating...' : 'Generate Shapshot'}
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
                        animateValue={metrics?.openRate}
                        suffix="%"
                        loading={metricsLoading}
                        trend={trends.openRate} 
                        tooltip="Percentage of recipients who opened the email. (Unique Opens / Total Sent)"
                        icon={<div className="p-2 bg-purple-50 rounded-lg text-purple-600"><EyeIcon /></div>}
                    />
                    <KPICard 
                        title="Click Rate" 
                        value={`${metrics?.clickRate.toFixed(1) || 0}%`} 
                        animateValue={metrics?.clickRate}
                        suffix="%"
                        loading={metricsLoading}
                        trend={trends.clickRate} 
                        tooltip="Percentage of openers who clicked at least one link. (Unique Clicks / Unique Opens)"
                        icon={<div className="p-2 bg-emerald-50 rounded-lg text-emerald-600"><ClickIcon /></div>}
                    />
                    <KPICard 
                        title="Total Views" 
                        value={metrics?.totalViews.toLocaleString() || '0'} 
                        animateValue={metrics?.totalViews}
                        loading={metricsLoading}
                        // Views trend hard to calc without full view history in trendData. leaving blank or using heuristic.
                        tooltip="Total number of page views across all articles in this newsletter."
                        icon={<div className="p-2 bg-blue-50 rounded-lg text-blue-600"><ViewIcon /></div>}
                    />
                    <KPICard 
                        title="Avg. Time Spent" 
                        value={formatDuration(metrics?.avgTimeSpent)} 
                        loading={metricsLoading}
                        // No animateValue for time spent as it's formatted string
                        trend={trends.timeSpent}
                        tooltip="Average active reading time per session. (Estimated based on heartbeats)"
                        icon={<div className="p-2 bg-orange-50 rounded-lg text-orange-600"><TimeIcon /></div>}
                    />
                </div>

                {/* Charts & Tables Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-8">
                        {trendsLoading ? <div className="h-[300px] bg-white rounded-xl flex items-center justify-center">Loading Trend...</div> : <TrendChart data={displayTrends} title={`Engagement Trends (${timeRange === '4' ? 'Last 4 Weeks' : 'Last 12 Weeks'})`} />}
                        {articlesLoading ? <div className="h-[200px] bg-white rounded-xl flex items-center justify-center">Loading Articles...</div> : <ArticleAnalyticsTable data={enrichedArticleData} />}
                    </div>
                    
                    <div className="space-y-6">
                        {/* Secondary Widgets / Breakdown - Placeholder for now */}
                        <div className="h-full">
                            {classLoading ? (
                                <div className="h-[200px] bg-white rounded-xl flex items-center justify-center border border-brand-neutral-100">
                                    <span className="text-brand-neutral-400">Loading Class Data...</span>
                                </div>
                            ) : (
                                <ClassComparisonTable data={classEngagement} />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
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
