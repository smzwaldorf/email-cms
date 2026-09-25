import React, { useMemo, useEffect, useRef } from 'react';
import { useNewsletterMetrics, useGenerateSnapshots, useTrendStats, useArticleStats, useAvailableWeeks, useClassEngagement, useTopicHotness, useAllClasses } from '@/hooks/useAnalyticsQuery';
import { KPICard } from '@/components/analytics/KPICard';
import { TrendChart } from '@/components/analytics/TrendChart';
import { ArticleAnalyticsTable } from '@/components/analytics/ArticleAnalyticsTable';
import { ClassComparisonTable } from '@/components/analytics/ClassComparisonTable';
import { ClassComparisonChart } from '@/components/analytics/ClassComparisonChart';
import { RefreshCw, Download, Calendar, Filter, Radio } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';

import { useParams, useNavigate } from 'react-router-dom';
import { useAnalytics } from '@/context/AnalyticsContext';
import type { AnalyticsNewsletterWeekOption } from '@/types/analytics';

export const AnalyticsDashboardPage: React.FC = () => {
    const { weekNumber } = useParams<{ weekNumber: string }>();
    const navigate = useNavigate();
    const [tracker, setTracker] = React.useState<'resend' | 'cms'>('resend');

    // Global Context State
    const {
        selectedWeek, setSelectedWeek,
        selectedClass, setSelectedClass,
        timeRange, setTimeRange,
        classViewMode, setClassViewMode,
        liveUpdate, setLiveUpdate
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
             // Use week_number when present, otherwise fall back to newsletter UUID.
             // Avoid `.toString()` on the newsletter object, which becomes "[object Object]"
             // and breaks downstream Supabase filters.
             const defaultNewsletter = weeks[0] as AnalyticsNewsletterWeekOption;
             const defaultWeek = defaultNewsletter.week_number || defaultNewsletter.id || '';
             if (defaultWeek) {
                 setSelectedWeek(defaultWeek);
             }
        }
    }, [weeks, selectedWeek, weekNumber, setSelectedWeek]);

    // Get the newsletter UUID for the selected week
    // selectedWeek can be either week_number or newsletter id
    const selectedNewsletterId = useMemo(() => {
        if (!selectedWeek || weeks.length === 0) return '';
        const newsletter = weeks.find(
            (w: AnalyticsNewsletterWeekOption) =>
                w.week_number === selectedWeek || w.id === selectedWeek
        );
        return newsletter?.id || selectedWeek; // Fallback to selectedWeek if id not found
    }, [selectedWeek, weeks]);

    const { metrics, loading: metricsLoading, refreshing: metricsRefreshing, refetch: refetchMetrics } = useNewsletterMetrics(selectedNewsletterId, selectedClass, tracker);
    const { stats: articleData, loading: articlesLoading, refreshing: articlesRefreshing, refetch: refetchArticles } = useArticleStats(selectedNewsletterId);
    const { trend: trendData, loading: trendsLoading, refreshing: trendsRefreshing, refetch: refetchTrends } = useTrendStats(selectedClass, tracker);
    const { data: classEngagement, loading: classLoading, refreshing: classesRefreshing, refetch: refetchClasses } = useClassEngagement(selectedNewsletterId);
    const { hotness: hotnessData, refreshing: hotnessRefreshing, refetch: refetchHotness } = useTopicHotness(selectedNewsletterId);
    const { generate, generating } = useGenerateSnapshots();

    const isRefreshing = metricsRefreshing || articlesRefreshing || trendsRefreshing || classesRefreshing || hotnessRefreshing;

    const handleRefresh = () => {
        refetchMetrics();
        refetchArticles();
        refetchTrends();
        refetchClasses();
        refetchHotness();
    };

    // Live update: auto-refresh every 5 seconds
    const handleRefreshRef = useRef(handleRefresh);
    handleRefreshRef.current = handleRefresh;

    useEffect(() => {
        if (!liveUpdate) return;

        const intervalId = setInterval(() => {
            console.log('📡 即時更新：正在重新整理分析資料...');
            handleRefreshRef.current();
        }, 5000);

        return () => clearInterval(intervalId);
    }, [liveUpdate]);

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
        return trendData.slice(-limit);
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
                        <h1 className="text-2xl font-bold text-brand-neutral-800">分析儀表板</h1>
                        <p className="text-brand-neutral-500 text-sm mt-1">即時成效指標</p>
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
                                <option value="">所有班級</option>
                                {allClasses.map(cls => (
                                    <option key={cls} value={cls}>{cls}</option>
                                ))}
                            </select>
                        </div>

                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-neutral-400" />
                            <select
                                value={selectedNewsletterId}
                                onChange={(e) => {
                                    // Find the newsletter by ID and navigate using week_number or id
                                    const newsletter = weeks.find(
                                        (w: AnalyticsNewsletterWeekOption) => w.id === e.target.value
                                    );
                                    if (newsletter) {
                                        const routeKey = newsletter.week_number || newsletter.id;
                                        handleWeekChange(routeKey);
                                    }
                                }}
                                className="pl-9 pr-4 py-2 border border-brand-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 min-w-[180px]"
                                disabled={weeksLoading}
                            >
                                {weeks.map((week: AnalyticsNewsletterWeekOption) => {
                                    // Display title for newsletters without week_number
                                    const displayLabel = week.week_number
                                        ? `${week.week_number} (${new Date(week.release_date).toLocaleDateString()})`
                                        : `${week.title || '特刊'} (${new Date(week.release_date).toLocaleDateString('zh-TW')})`;
                                    return (
                                        <option key={week.id} value={week.id}>
                                            {displayLabel}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>

                        <button
                            onClick={handleRefresh}
                            className="p-2 text-brand-neutral-600 hover:bg-white rounded-lg border border-transparent hover:border-brand-neutral-200 transition-all disabled:opacity-50"
                            title="重新載入資料"
                            disabled={isRefreshing}
                        >
                            <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                        </button>

                        <button
                            onClick={() => setLiveUpdate(!liveUpdate)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                                liveUpdate
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                    : 'bg-white border-brand-neutral-200 text-brand-neutral-600 hover:bg-brand-neutral-50'
                            }`}
                            title={liveUpdate ? '停用即時更新' : '啟用即時更新（每 5 秒）'}
                        >
                            <Radio className={`w-4 h-4 ${liveUpdate ? 'animate-pulse' : ''}`} />
                            <span className="hidden sm:inline">{liveUpdate ? 'Live' : 'Live'}</span>
                        </button>

                        <button
                            onClick={() => generate()}
                            disabled={generating}
                            className="px-3 py-2 text-xs font-medium text-brand-neutral-600 bg-brand-neutral-50 hover:bg-brand-neutral-100 rounded-lg border border-brand-neutral-200 transition-colors disabled:opacity-50 whitespace-nowrap"
                            title="產生每日快照（管理員）"
                        >
                            {generating ? '產生中...' : '產生快照'}
                        </button>

                        <button className="flex items-center gap-2 px-4 py-2 bg-white border border-brand-neutral-200 rounded-lg text-sm font-medium text-brand-neutral-700 hover:bg-brand-neutral-50 transition-colors">
                            <Download className="w-4 h-4" /> 匯出
                        </button>
                    </div>
                </div>

                {/* Newsletter email engagement source */}
                <div className="flex flex-wrap items-center gap-3">
                    <label htmlFor="email-tracker" className="text-sm font-medium">電子郵件追蹤來源</label>
                    <select id="email-tracker" value={tracker}
                        onChange={event => setTracker(event.target.value as 'resend' | 'cms')}
                        className="px-3 py-2 border border-brand-neutral-200 rounded-lg text-sm">
                        <option value="resend">Resend</option>
                        <option value="cms">CMS 追蹤</option>
                    </select>
                    <p className="text-sm text-brand-neutral-500">
                        {tracker === 'resend'
                            ? 'Resend 回報的開信與點擊人數，以已送達收件人數為分母。'
                            : 'CMS 追蹤像素載入及電子郵件連結點擊，以已寄送收件人數為分母。包含代理伺服器與自動請求；圖片載入不代表真人閱讀。'}
                    </p>
                </div>
                {/* KPI Grid */}
                {metrics?.emailMetricsAvailable === false && <p className="text-sm text-brand-neutral-500">電子郵件比率目前無法顯示： {tracker === 'resend' ? '沒有 Resend 送達確認資料' : '沒有成功寄送的收件人'} 此篩選條件沒有可用資料，或無法載入送達資料。</p>}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <KPICard
                        title="開信率"
                        value={metrics?.emailMetricsAvailable === false ? '—' : `${metrics?.openRate.toFixed(1) || 0}%`}
                        animateValue={metrics?.emailMetricsAvailable === false ? undefined : metrics?.openRate}
                        suffix="%"
                        loading={metricsLoading}
                        trend={0}
                        tooltip={tracker === 'resend' ? 'Resend 不重複開信人數／已送達收件人數。圖片封鎖與預先載入會影響準確度。' : 'CMS 追蹤像素載入的不重複收件人數／已寄送收件人數。包含圖片代理與自動請求。'}
                        icon={<div className="p-2 bg-purple-50 rounded-lg text-purple-600"><EyeIcon /></div>}
                    />
                    <KPICard
                        title="點擊率"
                        value={metrics?.emailMetricsAvailable === false ? '—' : `${metrics?.clickRate.toFixed(1) || 0}%`}
                        animateValue={metrics?.emailMetricsAvailable === false ? undefined : metrics?.clickRate}
                        suffix="%"
                        loading={metricsLoading}
                        trend={0}
                        tooltip={tracker === 'resend' ? 'Resend 不重複點擊人數／已送達收件人數。計入郵件中的所有連結，也可能包含自動點擊。' : 'CMS 追蹤連結的不重複點擊人數／已寄送收件人數。只計入經過 CMS 追蹤器的連結，並包含自動請求。'}
                        icon={<div className="p-2 bg-emerald-50 rounded-lg text-emerald-600"><ClickIcon /></div>}
                    />
                    <KPICard
                        title="總瀏覽次數"
                        value={metrics?.totalViews.toLocaleString() || '0'}
                        animateValue={metrics?.totalViews}
                        loading={metricsLoading}
                        // Views trend hard to calc without full view history in trendData. leaving blank or using heuristic.
                        tooltip="Total number of page views across all articles in this newsletter."
                        icon={<div className="p-2 bg-blue-50 rounded-lg text-blue-600"><ViewIcon /></div>}
                    />
                    <KPICard
                        title="平均停留時間"
                        value={formatDuration(metrics?.avgTimeSpent)}
                        loading={metricsLoading}
                        // No animateValue for time spent as it's formatted string
                        trend={0}
                        tooltip="Average active reading time per session. (Estimated based on heartbeats)"
                        icon={<div className="p-2 bg-orange-50 rounded-lg text-orange-600"><TimeIcon /></div>}
                    />
                </div>

                {/* Engagement trend, class performance, and article details */}
                <div className="space-y-8">
                    <div className="space-y-8">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-brand-neutral-100">
                             <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-semibold text-brand-neutral-800">互動趨勢</h3>
                                <div className="bg-brand-neutral-50 rounded-lg p-1 flex text-xs font-medium">
                                    <button
                                        onClick={() => setTimeRange('4')}
                                        className={`px-3 py-1.5 rounded-md transition-all ${timeRange === '4' ? 'bg-white shadow text-brand-primary' : 'text-brand-neutral-500 hover:text-brand-neutral-700'}`}
                                    >
                                        最近 4 週
                                    </button>
                                    <button
                                        onClick={() => setTimeRange('12')}
                                        className={`px-3 py-1.5 rounded-md transition-all ${timeRange === '12' ? 'bg-white shadow text-brand-primary' : 'text-brand-neutral-500 hover:text-brand-neutral-700'}`}
                                    >
                                        最近 12 週
                                    </button>
                                </div>
                            </div>
                            {trendsLoading ? (
                                <div className="h-[300px] flex items-center justify-center font-medium text-brand-neutral-500">
                                    正在載入趨勢...
                                </div>
                            ) : (
                                <TrendChart
                                    data={filteredTrendData}
                                    tracker={tracker}
                                    // Title removed from chart prop as we have it in header now
                                />
                            )}
                        </div>


                    </div>

                    <div className="space-y-6">
                        {/* Comparison Widget */}
                        <div className="h-full flex flex-col space-y-4">
                             <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-brand-neutral-100 shadow-sm">
                                <h3 className="font-semibold text-brand-neutral-800 ml-2">班級成效</h3>
                                <div className="flex bg-brand-neutral-50 rounded-lg p-1">
                                    <button
                                        onClick={() => setClassViewMode('table')}
                                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${classViewMode === 'table' ? 'bg-white shadow text-brand-primary' : 'text-brand-neutral-500 hover:text-brand-neutral-700'}`}
                                    >
                                        表格
                                    </button>
                                    <button
                                        onClick={() => setClassViewMode('chart')}
                                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${classViewMode === 'chart' ? 'bg-white shadow text-brand-primary' : 'text-brand-neutral-500 hover:text-brand-neutral-700'}`}
                                    >
                                        圖表
                                    </button>
                                </div>
                            </div>

                            {classLoading ? (
                                <div className="h-[200px] bg-white rounded-xl flex items-center justify-center border border-brand-neutral-100 font-medium text-brand-neutral-400">
                                    正在載入班級資料...
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
                    {articlesLoading ? (
                        <div className="h-[200px] bg-white rounded-xl flex items-center justify-center font-medium text-brand-neutral-500">
                            正在載入文章...
                        </div>
                    ) : (
                        <ArticleAnalyticsTable data={enhancedArticleData} />
                    )}
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
