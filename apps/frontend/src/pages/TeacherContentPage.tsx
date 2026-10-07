import { useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { canPerformCmsAction, type CmsArticle } from '@email-cms/shared'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { useAuth } from '@/context/AuthContext'
import { hasRole } from '@/lib/rbac'
import { backendRequest } from '@/services/backendApi'
import type { NewsletterRow } from '@/types/database'
import type { CmsTableRows } from '@email-cms/shared'
import { SimpleEditor } from '@/components/tiptap-templates/simple/simple-editor'

type ArticleRow = CmsTableRows['articles'] & Pick<CmsArticle, 'teacher_edit_class_ids'> & { summary?: string | null }
type ContentView = 'newsletters' | 'newsletter' | 'articles' | 'article'
interface NewsletterBundle { newsletter: NewsletterRow; articles: ArticleRow[] }

/** Teachers use content views without publication, delivery or template controls. */
export function CmsContentPage({ view, children }: { view: ContentView; children: ReactNode }) {
  const { user } = useAuth()
  const [search] = useSearchParams()
  if (hasRole(user, 'admin')) return <>{children}</>
  if (search.get('tab') === 'users') return <Navigate to="/admin" replace />
  return <TeacherContentPage key={view} view={view} />
}

function TeacherContentPage({ view }: { view: ContentView }) {
  const { user } = useAuth()
  const { id, weekNumber, articleId } = useParams()
  const [newsletters, setNewsletters] = useState<NewsletterRow[]>([])
  const [articles, setArticles] = useState<ArticleRow[]>([])
  const [newsletter, setNewsletter] = useState<NewsletterRow | null>(null)
  const [article, setArticle] = useState<ArticleRow | null>(null)
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const actor = user ? { roles: user.roles ?? [user.role], teacherClassIds: user.teacherClassIds ?? [], parentClassIds: user.parentClassIds ?? [] } : null
  const canEdit = article && canPerformCmsAction(actor, 'article:edit', article)

  useEffect(() => {
    let active = true
    setLoading(true); setError(''); setSaved(false)
    const load = async () => {
      if (view === 'newsletters') {
        const rows = await backendRequest<NewsletterRow[]>('/api/teacher/newsletters')
        if (active) setNewsletters(rows)
      } else if (view === 'articles') {
        const rows = await backendRequest<ArticleRow[]>('/api/teacher/articles')
        if (active) setArticles(rows)
      } else if (view === 'newsletter') {
        const result = await backendRequest<NewsletterBundle>(`/api/teacher/newsletters/${encodeURIComponent(id ?? weekNumber ?? '')}`)
        if (active) { setNewsletter(result.newsletter); setArticles(result.articles) }
      } else {
        const result = await backendRequest<ArticleRow>(`/api/cms/articles/${encodeURIComponent(articleId ?? '')}`)
        if (active) { setArticle(result); setTitle(result.title); setSummary(result.summary ?? ''); setContent(result.content ?? '') }
      }
    }
    load().catch(err => { if (active) setError(err instanceof Error ? err.message : '無法載入內容') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [view, id, weekNumber, articleId, user?.id])

  const save = async () => {
    if (!article || !canEdit) return
    setSaving(true); setError(''); setSaved(false)
    try {
      const updated = await backendRequest<ArticleRow>(`/api/cms/articles/${encodeURIComponent(article.id)}`, { method: 'PATCH', body: JSON.stringify({ title, summary, content }) })
      setArticle(updated)
      setSaved(true)
    } catch (err) { setError(err instanceof Error ? err.message : '無法儲存文章') }
    finally { setSaving(false) }
  }
  const articleLink = (row: ArticleRow) => `/admin/articles/id/${encodeURIComponent(newsletter?.id ?? 'all')}/${encodeURIComponent(row.id)}`
  const fieldClass = 'w-full rounded-lg border border-waldorf-cream-300 p-3 disabled:bg-waldorf-cream-50'
  return (
    <AdminLayout activeTab={view === 'newsletters' || view === 'newsletter' ? 'newsletters' : 'articles'}
      title={newsletter?.title ?? (view === 'newsletters' ? '電子報' : view === 'article' ? '文章' : '文章列表')}
      description="查看電子報與文章；您可編輯任教班級的文章。"
      backLink={view === 'newsletter' || view === 'article' ? { to: view === 'newsletter' ? '/admin' : '/admin/articles', label: '返回列表' } : undefined}>
      {error && <p role="alert" className="mb-4 text-waldorf-rose-700">{error}</p>}
      {loading ? <p>正在載入...</p> : view === 'newsletters' ? (
        <ul className="divide-y divide-waldorf-cream-200">{newsletters.map(row => (
          <li key={row.id} className="flex items-center justify-between py-4">
            <Link className="font-semibold text-waldorf-clay-800 hover:underline" to={`/admin/newsletters/id/${row.id}`}>{row.title}</Link>
            <span className="text-sm text-waldorf-clay-500">{row.week_number ?? row.release_date} · {row.status === 'published' ? '已發布' : row.status === 'archived' ? '已封存' : '草稿'}</span>
          </li>
        ))}{!newsletters.length && <li>尚無電子報。</li>}</ul>
      ) : view === 'article' && article ? (
        <div className="space-y-4">
          <label className="block">標題<input className={fieldClass} value={title} onChange={event => setTitle(event.target.value)} disabled={!canEdit || saving} /></label>
          <label className="block">摘要<textarea className={fieldClass} value={summary} onChange={event => setSummary(event.target.value)} disabled={!canEdit || saving} /></label>
          <div><p className="mb-2">內容</p><SimpleEditor content={content} onChange={setContent} articleId={article.id} readOnly={!canEdit || saving} /></div>
          {canEdit && <button className="rounded-lg bg-waldorf-sage-600 px-4 py-2 text-white disabled:opacity-50" onClick={save} disabled={saving || !title.trim()}>{saving ? '儲存中...' : '儲存文章'}</button>}
          {saved && <p role="status">文章已儲存。</p>}
        </div>
      ) : (
        <ul className="divide-y divide-waldorf-cream-200">{articles.map(row => (
          <li key={row.id} className="py-4">
            <div className="flex items-center justify-between gap-4">
              <Link className="font-semibold text-waldorf-clay-800 hover:underline" to={articleLink(row)}>{row.title}</Link>
              {canPerformCmsAction(actor, 'article:edit', row) && <Link className="shrink-0 text-sm font-medium text-waldorf-sage-700 hover:underline" to={articleLink(row)}>編輯文章</Link>}
            </div>
            <p className="mt-1 text-sm text-waldorf-clay-500">{row.status === 'published' ? '已發布' : '草稿'} · {row.summary}</p>
          </li>
        ))}{!articles.length && <li>尚無可存取的文章。</li>}</ul>
      )}
    </AdminLayout>
  )
}
