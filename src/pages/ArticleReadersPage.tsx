import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { analyticsAggregator, ArticleReader } from '@/services/analyticsAggregator';
import { ArrowLeft, Search, Filter } from 'lucide-react';
import ArticleService from '@/services/ArticleService';

export const ArticleReadersPage: React.FC = () => {
    const { articleId } = useParams<{ articleId: string }>();
    const navigate = useNavigate();
    
    const [readers, setReaders] = useState<ArticleReader[]>([]);
    const [loading, setLoading] = useState(true);
    const [articleTitle, setArticleTitle] = useState('');
    
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedClass, setSelectedClass] = useState<string>('All Classes');

    useEffect(() => {
        async function loadData() {
            if (!articleId) return;
            setLoading(true);
            try {
                // Fetch Article Title
                try {
                    const article = await ArticleService.getArticleById(articleId);
                    setArticleTitle(article?.title || 'Unknown Article');
                } catch (e) {
                    setArticleTitle('Unknown Article');
                }

                // Fetch Readers
                const data = await analyticsAggregator.getArticleReaders(articleId);
                setReaders(data);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, [articleId]);

    // Extract all unique classes for filter
    const allClasses = Array.from(new Set(readers.flatMap(r => r.className))).sort();

    // Filter Logic
    const filteredReaders = readers.filter(reader => {
        const matchesSearch = 
            reader.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
            reader.studentNames.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()));
        
        const matchesClass = selectedClass === 'All Classes' || reader.className.includes(selectedClass);

        return matchesSearch && matchesClass;
    });

    return (
        <AdminLayout title="Article Readers">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <button 
                        onClick={() => navigate(-1)} 
                        className="flex items-center text-sm text-brand-neutral-500 hover:text-brand-neutral-700 mb-4 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
                    </button>
                    <h1 className="text-2xl font-bold text-brand-neutral-800">
                        Readers for: <span className="text-brand-primary">{articleTitle}</span>
                    </h1>
                    <p className="mt-1 text-brand-neutral-500">
                        {loading ? 'Loading...' : `Total ${readers.length} unique readers found.`}
                    </p>
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-neutral-400" />
                        <input 
                            type="text" 
                            placeholder="Search by email or student name..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-brand-neutral-200 rounded-lg focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all"
                        />
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-brand-neutral-500" />
                        <select 
                            value={selectedClass} 
                            onChange={(e) => setSelectedClass(e.target.value)}
                            className="px-4 py-2 border border-brand-neutral-200 rounded-lg focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all min-w-[200px]"
                        >
                            <option value="All Classes">All Classes</option>
                            {allClasses.map(cls => (
                                <option key={cls} value={cls}>{cls}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-xl shadow-sm border border-brand-neutral-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-brand-neutral-50 text-brand-neutral-500">
                                <tr>
                                    <th className="px-6 py-4 font-medium">Reader (Parent/Teacher)</th>
                                    <th className="px-6 py-4 font-medium">Role</th>
                                    <th className="px-6 py-4 font-medium">Related Student(s)</th>
                                    <th className="px-6 py-4 font-medium">Class(es)</th>
                                    <th className="px-6 py-4 font-medium text-right">View Count</th>
                                    <th className="px-6 py-4 font-medium text-right">Last Viewed</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-brand-neutral-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-8 text-center text-brand-neutral-400">
                                            Loading readers data...
                                        </td>
                                    </tr>
                                ) : filteredReaders.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-8 text-center text-brand-neutral-400">
                                            No readers found matching your filters.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredReaders.map((reader) => (
                                        <tr key={reader.userId} className="hover:bg-brand-neutral-50 transition-colors">
                                            <td className="px-6 py-4 font-medium text-brand-neutral-800">
                                                {reader.email}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                                                    reader.role === 'teacher' ? 'bg-purple-100 text-purple-700' :
                                                    reader.role === 'admin' ? 'bg-gray-100 text-gray-700' :
                                                    'bg-blue-100 text-blue-700'
                                                }`}>
                                                    {reader.role}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-brand-neutral-600">
                                                {reader.studentNames.length > 0 ? reader.studentNames.join(', ') : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-brand-neutral-600">
                                                {reader.className.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {reader.className.map(c => (
                                                            <span key={c} className="px-2 py-0.5 bg-brand-neutral-100 rounded text-xs">
                                                                {c}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-right tabular-nums text-brand-neutral-600">
                                                {reader.viewCount}
                                            </td>
                                            <td className="px-6 py-4 text-right tabular-nums text-brand-neutral-500 text-xs">
                                                {reader.lastViewed}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
};
