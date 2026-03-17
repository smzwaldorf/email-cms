import React, { useState } from 'react';
import { ChevronUp, ChevronDown, Users, Percent, MousePointer, Clock } from 'lucide-react';
import { ClassEngagement } from '@/services/analyticsAggregator';

interface ClassComparisonTableProps {
    data: ClassEngagement[];
}

type SortField = keyof ClassEngagement;
type SortDirection = 'asc' | 'desc';

export const ClassComparisonTable: React.FC<ClassComparisonTableProps> = ({ data }) => {
    const [sortField, setSortField] = useState<SortField>('openRate');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    const sortedData = React.useMemo(() => {
        return [...data].sort((a, b) => {
            const aValue = a[sortField];
            const bValue = b[sortField];
            
            // Handle potentially undefined or string values if any (though types say strictly numbers/strings)
             if (typeof aValue === 'string' && typeof bValue === 'string') {
                return sortDirection === 'asc' 
                    ? aValue.localeCompare(bValue) 
                    : bValue.localeCompare(aValue);
            }
            
            if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }, [data, sortField, sortDirection]);

    const formatDuration = (seconds?: number) => {
        if (!seconds) return '-';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}m ${s}s`;
    };

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <div className="w-4 h-4 ml-1 opacity-0 group-hover:opacity-30"><ChevronDown className="w-4 h-4" /></div>;
        return <div className="w-4 h-4 ml-1 text-brand-primary">{sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</div>;
    };

    const renderHeader = (label: string, field: SortField, icon?: React.ReactNode) => (
        <th 
            className="px-6 py-3 text-left text-xs font-medium text-brand-neutral-500 uppercase tracking-wider cursor-pointer group hover:bg-brand-neutral-50 transition-colors"
            onClick={() => handleSort(field)}
        >
            <div className="flex items-center">
                {icon && <span className="mr-2">{icon}</span>}
                {label}
                <SortIcon field={field} />
            </div>
        </th>
    );

    if (!data || data.length === 0) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-brand-neutral-100 p-8 flex flex-col items-center justify-center text-brand-neutral-400 min-h-[300px]">
                <Users className="w-12 h-12 mb-3 opacity-20" />
                <p>No class engagement data available.</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-brand-neutral-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-brand-neutral-100 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-brand-neutral-800">Engagement by Class</h3>
                <div className="text-xs text-brand-neutral-500">
                    {data.length} Classes
                </div>
            </div>
            
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-brand-neutral-200">
                    <thead className="bg-brand-neutral-50">
                        <tr>
                            {renderHeader('Class', 'className')}
                            {renderHeader('Open Rate', 'openRate', <Percent className="w-4 h-4" />)}
                            {renderHeader('Active Parents', 'activeUsers', <Users className="w-4 h-4" />)}
                            {renderHeader('Clicks', 'clickCount', <MousePointer className="w-4 h-4" />)}
                            {renderHeader('Avg Time', 'avgDailyTime', <Clock className="w-4 h-4" />)}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-brand-neutral-100">
                        {sortedData.map((row) => (
                            <tr key={row.className} className="hover:bg-brand-neutral-50/50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-brand-neutral-900">{row.className}</div>
                                </td>
                                
                                <td className="px-6 py-4 whitespace-nowrap align-middle">
                                    <div className="w-full max-w-[140px]">
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="font-medium text-brand-neutral-700">{row.openRate.toFixed(1)}%</span>
                                        </div>
                                        <div className="w-full bg-brand-neutral-100 rounded-full h-2 overflow-hidden">
                                            <div 
                                                className={`h-full rounded-full transition-all duration-500 ${
                                                    row.openRate > 70 ? 'bg-emerald-500' :
                                                    row.openRate > 40 ? 'bg-brand-primary' : 'bg-amber-500'
                                                }`} 
                                                style={{ width: `${Math.min(row.openRate, 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                </td>
            
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-brand-neutral-600">
                                    <span className="font-medium text-brand-neutral-900">{row.activeUsers}</span>
                                    <span className="text-brand-neutral-400 mx-1">/</span>
                                    <span className="text-brand-neutral-400">{row.totalUsers}</span>
                                </td>

                                <td className="px-6 py-4 whitespace-nowrap text-sm text-brand-neutral-600">
                                    {row.clickCount}
                                </td>

                                <td className="px-6 py-4 whitespace-nowrap text-sm text-brand-neutral-600">
                                    {formatDuration(row.avgDailyTime)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
