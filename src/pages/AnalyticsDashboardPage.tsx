import React, { useMemo } from 'react';
import { useNewsletterMetrics, useGenerateSnapshots, useTrendStats, useArticleStats, useAvailableWeeks, useClassEngagement, useTopicHotness, useAllClasses } from '@/hooks/useAnalyticsQuery';
import { KPICard } from '@/components/analytics/KPICard';
import { TrendChart } from '@/components/analytics/TrendChart';
import { ArticleAnalyticsTable } from '@/components/analytics/ArticleAnalyticsTable';
import { ClassComparisonTable } from '@/components/analytics/ClassComparisonTable';
import { ClassComparisonChart } from '@/components/analytics/ClassComparisonChart';
import { RefreshCw, Download, Calendar, Filter } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';

import { useParams, useNavigate } from 'react-router-dom';
import { useAnalytics } from '@/context/AnalyticsContext';

export const AnalyticsDashboardPage: React.FC = () => {
    const { weekNumber } = useParams<{ weekNumber: string }>();
    const navigate = useNavigate();
    
    // Global Context State
    const { 
        selectedWeek, setSelectedWeek,
        selectedClass, setSelectedClass,
        timeRange, setTimeRange,
        classViewMode, setClassViewMode,
        hasBeenHidden
    } = useAnalytics();

    const { weeks, loading: weeksLoading } = useAvailableWeeks();
    const { classes: allClasses, loading: allClassesLoading } = useAllClasses();
    
    // Sync state with URL param
    React.useEffect(() => {
        if (weekNumber && weekNumber !== selectedWeek) {
            setSelectedWeek(weekNumber);
        }
    }, [weekNumber, selectedWeek, setSelectedWeek]);

    // Set default selected week when weeks load (if no URL param and no context state)
    React.useEffect(() => {
        if (weeks.length > 0 && !selectedWeek && !weekNumber) {
             // @ts-ignore
             const defaultWeek = weeks[0].week_number || weeks[0].toString();
             setSelectedWeek(defaultWeek);
        }
    }, [weeks, selectedWeek, weekNumber, setSelectedWeek]);
    
    const { metrics, loading: metricsLoading, refreshing: metricsRefreshing, refetch: refetchMetrics } = useNewsletterMetrics(selectedWeek, selectedClass);
    const { stats: articleData, loading: articlesLoading, refreshing: articlesRefreshing, refetch: refetchArticles } = useArticleStats(selectedWeek);
    const { trend: trendData, loading: trendsLoading, refreshing: trendsRefreshing, refetch: refetchTrends } = useTrendStats(selectedClass);
    const { data: classEngagement, loading: classLoading, refreshing: classesRefreshing, refetch: refetchClasses } = useClassEngagement(selectedWeek);
    const { hotness: hotnessData, refreshing: hotnessRefreshing, refetch: refetchHotness } = useTopicHotness(selectedWeek);
    const { generate, generating } = useGenerateSnapshots();

    const isRefreshing = metricsRefreshing || articlesRefreshing || trendsRefreshing || classesRefreshing || hotnessRefreshing;

    const handleRefresh = () => {
        if (hasBeenHidden) {
            window.location.reload();
            return;
        }
        refetchMetrics();
        refetchArticles();
        refetchTrends();
        refetchClasses();
        refetchHotness();
    };
    
    const handleWeekChange = (newWeek: string) => {
        setSelectedWeek(newWeek);
        navigate(`/admin/analytics/week/${newWeek}`);
    };

    // Format duration helper
    const formatDuration = (seconds?: number) => {
        if (!seconds) return '-';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}m ${s}s`;
    };

    // Filter trend data based on time range
    const filteredTrendData = useMemo(() => {
        if (!trendData) return [];
        const limit = parseInt(timeRange);
        return trendData.slice(0, limit).reverse();
    }, [trendData, timeRange]);

    // Merge hotness score into article data
    const enhancedArticleData = useMemo(() => {
        if (!articleData) return [];
        return articleData.map(article => {
            const hotness = hotnessData?.find(h => h.articleId === article.id);
            return {
                ...article,
                hotnessScore: hotness?.hotnessScore,
                avgReadLatencyMinutes: hotness?.avgReadLatencyMinutes
            };
        });
    }, [articleData, hotnessData]);

    return (
        <AdminLayout activeTab="analytics">
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-brand-neutral-800">Analytics Dashboard</h1>
                        <p className="text-brand-neutral-500 text-sm mt-1">Real-time performance metrics</p>
                    </div>
                    
                    <div className="flex items-center gap-3">
                         <div className="relative">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-neutral-400" />
                            <select 
                                value={selectedClass}
                                onChange={(e) => setSelectedClass(e.target.value)}
                                className="pl-9 pr-4 py-2 border border-brand-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 min-w-[140px]"
                                disabled={allClassesLoading}
                            >
                                <option value="">All Classes</option>
                                {allClasses.map(cls => (
                                    <option key={cls} value={cls}>{cls}</option>
                                ))}
                            </select>
                        </div>

                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-neutral-400" />
                            <select 
                                value={selectedWeek} 
                                onChange={(e) => handleWeekChange(e.target.value)}
                                className="pl-9 pr-4 py-2 border border-brand-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 min-w-[140px]"
                                disabled={weeksLoading}
                            >
                                {weeks.map(week => (
                                    // @ts-ignore
                                    <option key={week.week_number} value={week.week_number}>
                                        {/* @ts-ignore */}
                                        {week.week_number} ({new Date(week.release_date).toLocaleDateString()})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <button 
                            onClick={handleRefresh}
                            className="p-2 text-brand-neutral-600 hover:bg-white rounded-lg border border-transparent hover:border-brand-neutral-200 transition-all disabled:opacity-50"
                            title="Reload Data"
                            disabled={isRefreshing && !hasBeenHidden}
                        >
                            <RefreshCw className={`w-5 h-5 ${isRefreshing && !hasBeenHidden ? 'animate-spin' : ''}`} />
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
                        trend={0} 
                        tooltip="Percentage of recipients who opened the email. (Unique Opens / Total Sent)"
                        icon={<div className="p-2 bg-purple-50 rounded-lg text-purple-600"><EyeIcon /></div>}
                    />
                    <KPICard 
                        title="Click Rate" 
                        value={`${metrics?.clickRate.toFixed(1) || 0}%`} 
                        animateValue={metrics?.clickRate}
                        suffix="%"
                        loading={metricsLoading}
                        trend={0} 
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
                        trend={0}
                        tooltip="Average active reading time per session. (Estimated based on heartbeats)"
                        icon={<div className="p-2 bg-orange-50 rounded-lg text-orange-600"><TimeIcon /></div>}
                    />
                </div>

                {/* Charts & Tables Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-8">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-brand-neutral-100">
                             <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-semibold text-brand-neutral-800">Engagement Trend</h3>
                                <div className="bg-brand-neutral-50 rounded-lg p-1 flex text-xs font-medium">
                                    <button 
                                        onClick={() => setTimeRange('4')}
                                        className={`px-3 py-1.5 rounded-md transition-all ${timeRange === '4' ? 'bg-white shadow text-brand-primary' : 'text-brand-neutral-500 hover:text-brand-neutral-700'}`}
                                    >
                                        Last 4 Weeks
                                    </button>
                                    <button 
                                        onClick={() => setTimeRange('12')}
                                        className={`px-3 py-1.5 rounded-md transition-all ${timeRange === '12' ? 'bg-white shadow text-brand-primary' : 'text-brand-neutral-500 hover:text-brand-neutral-700'}`}
                                    >
                                        Last 12 Weeks
                                    </button>
                                </div>
                            </div>
                            {trendsLoading ? (
                                <div className="h-[300px] flex items-center justify-center font-medium text-brand-neutral-500">
                                    Loading Trend...
                                </div>
                            ) : (
                                <TrendChart 
                                    data={filteredTrendData} 
                                    // Title removed from chart prop as we have it in header now
                                />
                            )}
                        </div>
                        
                        {articlesLoading ? (
                            <div className="h-[200px] bg-white rounded-xl flex items-center justify-center font-medium text-brand-neutral-500">
                                Loading Articles...
                            </div>
                        ) : (
                            <ArticleAnalyticsTable data={enhancedArticleData} />
                        )}
                    </div>
                    
                    <div className="space-y-6">
                        {/* Comparison Widget */}
                        <div className="h-full flex flex-col space-y-4">
                             <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-brand-neutral-100 shadow-sm">
                                <h3 className="font-semibold text-brand-neutral-800 ml-2">Class Performance</h3>
                                <div className="flex bg-brand-neutral-50 rounded-lg p-1">
                                    <button 
                                        onClick={() => setClassViewMode('table')}
                                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${classViewMode === 'table' ? 'bg-white shadow text-brand-primary' : 'text-brand-neutral-500 hover:text-brand-neutral-700'}`}
                                    >
                                        Table
                                    </button>
                                    <button 
                                        onClick={() => setClassViewMode('chart')}
                                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${classViewMode === 'chart' ? 'bg-white shadow text-brand-primary' : 'text-brand-neutral-500 hover:text-brand-neutral-700'}`}
                                    >
                                        Chart
                                    </button>
                                </div>
                            </div>

                            {classLoading ? (
                                <div className="h-[200px] bg-white rounded-xl flex items-center justify-center border border-brand-neutral-100 font-medium text-brand-neutral-400">
                                    Loading Class Data...
                                </div>
                            ) : (
                                <>
                                    {classViewMode === 'table' ? (
                                        <ClassComparisonTable data={classEngagement} />
                                    ) : (
                                        <ClassComparisonChart data={classEngagement} metric="openRate" />
                                    )}
                                </>
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
