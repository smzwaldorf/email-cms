import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useArticleReaders, useArticleMetadata } from '@/hooks/useAnalyticsQuery';
import { ArticleReaderTable } from '@/components/analytics/ArticleReaderTable';
import { ArrowLeft, Clock, Calendar } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';

export const ArticleAnalyticsPage: React.FC = () => {
    const { articleId } = useParams<{ articleId: string }>();
    const navigate = useNavigate();
    
    const { metadata, loading: metaLoading } = useArticleMetadata(articleId || '');
    const { readers, loading: readersLoading } = useArticleReaders(articleId || '');

    if (!articleId) return <div>Invalid Article ID</div>;

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
                        <h1 className="text-2xl font-bold text-brand-neutral-800">
                            {metaLoading ? 'Loading Article...' : metadata?.title}
                        </h1>
                        <div className="flex items-center gap-4 text-sm text-brand-neutral-500 mt-1">
                            {metadata?.weekNumber && (
                                <span className="flex items-center gap-1.5">
                                    <Calendar className="w-4 h-4" />
                                    Week {metadata.weekNumber}
                                </span>
                            )}
                            {metadata?.publishedAt && (
                                <span className="flex items-center gap-1.5">
                                    <Clock className="w-4 h-4" />
                                    Published {new Date(metadata.publishedAt).toLocaleDateString()}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="grid grid-cols-1 gap-6">
                    {/* Reader List */}
                    <div>
                        {readersLoading ? (
                            <div className="h-[300px] bg-white rounded-xl flex items-center justify-center border border-brand-neutral-100">
                                <span className="text-brand-neutral-400">Loading Readers...</span>
                            </div>
                        ) : (
                            <ArticleReaderTable data={readers} />
                        )}
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
};
