import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { CmsContentPage } from '@/pages/TeacherContentPage'

const fixture = vi.hoisted(() => ({ user: { id: 'teacher', email: 'teacher@example.test', role: 'teacher', roles: ['teacher'], teacherClassIds: ['A'], parentClassIds: [] }, request: vi.fn(), adminNewsletters: vi.fn() }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: fixture.user, isAuthenticated: true, isLoading: false }) }))
vi.mock('@/services/backendApi', () => ({ backendRequest: fixture.request }))
vi.mock('@/services/adminService', () => ({ adminService: { fetchNewsletters: fixture.adminNewsletters } }))
vi.mock('@/components/tiptap-templates/simple/simple-editor', () => ({ SimpleEditor: () => <div>文章內容</div> }))

function open(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/" element={<p>Reader home</p>} />
    <Route path="/admin" element={<ProtectedRoute cmsPanel><CmsContentPage view="newsletters"><p>Admin dashboard</p></CmsContentPage></ProtectedRoute>} />
    <Route path="/admin/articles" element={<ProtectedRoute cmsPanel><CmsContentPage view="articles"><p>Admin articles</p></CmsContentPage></ProtectedRoute>} />
    <Route path="/admin/articles/id/:id/:articleId" element={<ProtectedRoute cmsPanel><CmsContentPage view="article"><p>Admin editor</p></CmsContentPage></ProtectedRoute>} />
    <Route path="/admin/media" element={<ProtectedRoute cmsPanel><p>Media panel</p></ProtectedRoute>} />
    <Route path="/admin/analytics" element={<ProtectedRoute cmsPanel><p>Analytics panel</p></ProtectedRoute>} />
    {['/admin/templates', '/admin/email-templates', '/admin/newsletters/preview'].map(route => <Route key={route} path={route} element={<ProtectedRoute requiredRole="admin"><p>Restricted panel</p></ProtectedRoute>} />)}
  </Routes></MemoryRouter>)
}
beforeEach(() => {
  vi.clearAllMocks()
  fixture.user.roles = ['teacher']
  fixture.user.role = 'teacher'
  fixture.request.mockResolvedValue([{ id: 'n1', title: 'Class newsletter', status: 'published', week_number: '2026-W41' }])
})
describe('teacher CMS panel', () => {
  it('opens newsletters with four allowed tabs and no template or preview links', async () => {
    open('/admin')
    expect(await screen.findByRole('link', { name: 'Class newsletter' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '文章' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '媒體' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '分析' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '電子郵件範本' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '電子郵件預覽' })).not.toBeInTheDocument()
    expect(fixture.adminNewsletters).not.toHaveBeenCalled()
  })
  it.each(['/admin/email-templates', '/admin/templates', '/admin/newsletters/preview'])('denies direct navigation to %s', path => {
    open(path)
    expect(screen.getByText('Reader home')).toBeInTheDocument()
    expect(screen.queryByText('Restricted panel')).not.toBeInTheDocument()
  })
  it.each([['/admin/media', 'Media panel'], ['/admin/analytics', 'Analytics panel']])('opens %s for teachers', (path, text) => {
    open(path)
    expect(screen.getByText(text)).toBeInTheDocument()
  })
  it('blocks the legacy user-management tab', async () => {
    open('/admin?tab=users')
    await waitFor(() => expect(screen.getByRole('link', { name: 'Class newsletter' })).toBeInTheDocument())
    expect(screen.queryByText('Admin dashboard')).not.toBeInTheDocument()
  })
  it('keeps admin content available to a teacher who also has the admin role', () => {
    fixture.user.roles = ['teacher', 'admin']
    open('/admin')
    expect(screen.getByText('Admin dashboard')).toBeInTheDocument()
  })
  it('blocks parent-only users from the CMS panel', () => {
    fixture.user.role = 'parent'; fixture.user.roles = ['parent']
    open('/admin')
    expect(screen.getByText('Reader home')).toBeInTheDocument()
  })
  it('opens an assigned unpublished class article and saves through the scoped API', async () => {
    const draft = { id: 'draft', title: 'Draft class article', status: 'draft', content: '<p>Original draft</p>', summary: 'Draft summary', visibility_type: 'public', teacher_edit_class_ids: ['A'] }
    fixture.request.mockImplementation(async (path: string, init?: RequestInit) => path === '/api/teacher/newsletters' ? [] : init?.method === 'PATCH' ? { ...draft, title: 'Teacher revision' } : draft)
    open('/admin/articles/id/n1/draft')
    const title = await screen.findByRole('textbox', { name: '標題' })
    expect(title).toBeEnabled()
    fireEvent.change(title, { target: { value: 'Teacher revision' } })
    fireEvent.click(screen.getByRole('button', { name: '儲存文章' }))
    expect(await screen.findByRole('status')).toHaveTextContent('文章已儲存')
    expect(fixture.request).toHaveBeenCalledWith('/api/cms/articles/draft', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ title: 'Teacher revision', summary: 'Draft summary', content: '<p>Original draft</p>' }) }))
    expect(fixture.request.mock.calls.some(([path]) => path.includes('publish'))).toBe(false)
  })
  it('does not show an edit control for draft content outside the live teaching scope', async () => {
    fixture.request.mockImplementation(async (path: string) => path === '/api/teacher/newsletters' ? [] : { id: 'draft', title: 'Unassigned draft', status: 'draft', content: '', visibility_type: 'public', teacher_edit_class_ids: ['B'] })
    open('/admin/articles/id/n1/draft')
    expect(await screen.findByRole('textbox', { name: '標題' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: '儲存文章' })).not.toBeInTheDocument()
  })
})
