import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useClassHistory } from '@/hooks/useAnalyticsQuery';
import { TrendChart } from '@/components/analytics/TrendChart';
import { ArrowLeft, School } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';

export const ClassAnalyticsPage: React.FC = () => {
    const { className } = useParams<{ className: string }>();
    const decodedClassName = decodeURIComponent(className || '');
    const navigate = useNavigate();
    
    // Fetch last 12 weeks of history
    const { history, loading: historyLoading } = useClassHistory(decodedClassName);

    if (!decodedClassName) return <div>班級名稱無效</div>;

    // Calculate average stats from history
    const avgStats = React.useMemo(() => {
        if (!history || history.length === 0) return null;
        const average = (values: (number | null)[]) => {
            const available = values.filter((value): value is number => value !== null);
            return available.length ? available.reduce((sum, value) => sum + value, 0) / available.length : null;
        };
        return {
            openRate: average(history.map(point => point.openRate)),
            clickRate: average(history.map(point => point.clickRate))
        };
    }, [history]);

    return (
        <AdminLayout activeTab="analytics">
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => navigate('/admin/analytics')}
                        className="p-2 hover:bg-brand-neutral-100 rounded-lg text-brand-neutral-500 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-brand-neutral-800 flex items-center gap-2">
                            <School className="w-6 h-6 text-brand-primary" />
                            {decodedClassName}
                        </h1>
                        <p className="text-brand-neutral-500 text-sm mt-1">
                            歷史互動成效
                        </p>
                    </div>
                </div>

                {/* Overview Cards */}
                {avgStats && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-6 rounded-xl border border-brand-neutral-100 shadow-sm">
                            <div className="text-sm text-brand-neutral-500 mb-1">平均開信率（12 週）</div>
                            <div className="text-2xl font-bold text-brand-neutral-900">{avgStats.openRate === null ? '—' : `${avgStats.openRate.toFixed(1)}%`}</div>
                        </div>
                        <div className="bg-white p-6 rounded-xl border border-brand-neutral-100 shadow-sm">
                            <div className="text-sm text-brand-neutral-500 mb-1">平均點擊率（12 週）</div>
                            <div className="text-2xl font-bold text-brand-neutral-900">{avgStats.clickRate === null ? '—' : `${avgStats.clickRate.toFixed(1)}%`}</div>
                        </div>
                        <div className="bg-white p-6 rounded-xl border border-brand-neutral-100 shadow-sm">
                            <div className="text-sm text-brand-neutral-500 mb-1">資料筆數</div>
                            <div className="text-2xl font-bold text-brand-neutral-900">{history.length} 週</div>
                        </div>
                    </div>
                )}

                {/* Charts */}
                <div className="bg-white rounded-xl shadow-sm border border-brand-neutral-100 p-6">
                    {historyLoading ? (
                        <div className="h-[300px] flex items-center justify-center text-brand-neutral-400">正在載入歷史資料...</div>
                    ) : (
                        <TrendChart data={history} title="互動歷史" />
                    )}
                </div>
                
                {/* Future: Student List Table */}
            </div>
        </AdminLayout>
    );
};
