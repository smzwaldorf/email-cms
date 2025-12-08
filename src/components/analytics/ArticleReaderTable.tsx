import React from 'react';
import { ArticleReader } from '@/services/analyticsAggregator';
import { User, Clock, Users } from 'lucide-react';

interface ArticleReaderTableProps {
    data: ArticleReader[];
}

export const ArticleReaderTable: React.FC<ArticleReaderTableProps> = ({ data }) => {
    if (!data || data.length === 0) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-brand-neutral-100 p-8 flex flex-col items-center justify-center text-brand-neutral-400 min-h-[300px]">
                <User className="w-12 h-12 mb-3 opacity-20" />
                <p>No reader data available for this article.</p>
            </div>
        );
    }

    // Sort by role (Parents first), then last viewed
    const sortedData = [...data].sort((a, b) => {
        if (a.role !== b.role) return a.role.localeCompare(b.role);
        return new Date(b.lastViewed).getTime() - new Date(a.lastViewed).getTime();
    });

    return (
        <div className="bg-white rounded-xl shadow-sm border border-brand-neutral-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-brand-neutral-100 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-brand-neutral-800">Article Readers</h3>
                <div className="text-xs text-brand-neutral-500">
                    {data.length} Unique Viewers
                </div>
            </div>
            
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-brand-neutral-200">
                    <thead className="bg-brand-neutral-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-brand-neutral-500 uppercase tracking-wider">User</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-brand-neutral-500 uppercase tracking-wider">Role</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-brand-neutral-500 uppercase tracking-wider">Class / Students</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-brand-neutral-500 uppercase tracking-wider">Last Viewed</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-brand-neutral-500 uppercase tracking-wider">Views</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-brand-neutral-100">
                        {sortedData.map((reader) => (
                            <tr key={reader.userId} className="hover:bg-brand-neutral-50/50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-brand-neutral-100 flex items-center justify-center text-brand-neutral-500">
                                            <User className="w-4 h-4" />
                                        </div>
                                        <div className="ml-3">
                                            <div className="text-sm font-medium text-brand-neutral-900">{reader.email}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                        reader.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'
                                    }`}>
                                        {reader.role}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-brand-neutral-900 flex flex-col gap-0.5">
                                        <div className="flex items-center gap-1.5 text-brand-neutral-600">
                                            <Users className="w-3 h-3" />
                                            <span className="font-medium">{reader.className.join(', ') || '-'}</span>
                                        </div>
                                        {reader.studentNames.length > 0 && (
                                            <div className="text-xs text-brand-neutral-400 pl-4">
                                                {reader.studentNames.join(', ')}
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-brand-neutral-500">
                                    <div className="flex items-center gap-1.5">
                                        <Clock className="w-3 h-3" />
                                        {new Date(reader.lastViewed).toLocaleString()}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-brand-neutral-500">
                                    {reader.viewCount}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
