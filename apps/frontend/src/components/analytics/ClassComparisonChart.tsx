import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ClassEngagement } from '@/services/analyticsAggregator';

interface ClassComparisonChartProps {
    data: ClassEngagement[];
    metric?: 'openRate' | 'clickRate' | 'avgDailyTime';
}

export const ClassComparisonChart: React.FC<ClassComparisonChartProps> = ({ data, metric = 'openRate' }) => {
    // Sort top 10 for chart clarity
    const chartData = React.useMemo(() => {
        return [...data]
            .sort((a, b) => b[metric] - a[metric])
            .slice(0, 10);
    }, [data, metric]);

    if (!data || data.length === 0) {
        return (
            <div className="h-[300px] flex items-center justify-center text-brand-neutral-400 bg-white rounded-xl border border-brand-neutral-100">
                No class data available for comparison
            </div>
        );
    }

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-brand-neutral-100">
            <h3 className="text-lg font-semibold text-brand-neutral-800 mb-6">
                Top Classes by {metric === 'openRate' ? 'Open Rate' : metric === 'clickRate' ? 'Click Rate' : 'Time Spent'}
            </h3>
            <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={chartData}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                        <XAxis type="number" hide />
                        <YAxis 
                            dataKey="className" 
                            type="category" 
                            tick={{ fill: '#6B7280', fontSize: 12 }} 
                            width={100}
                        />
                        <Tooltip 
                            cursor={{ fill: '#F3F4F6' }}
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar 
                            dataKey={metric} 
                            fill={metric === 'openRate' ? '#8B5CF6' : '#10B981'} 
                            radius={[0, 4, 4, 0]} 
                            barSize={20}
                            name={metric === 'openRate' ? 'Open Rate %' : metric === 'clickRate' ? 'Click Rate %' : 'Seconds'}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
