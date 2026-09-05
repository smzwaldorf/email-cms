import { describe, it, expect } from 'vitest'
import { canPerformCmsAction, type CmsActor } from '@email-cms/shared'
const actor: CmsActor = { roles: ['parent', 'teacher'], teacherClassIds: ['T'], parentClassIds: ['P'] }
const article = { status: 'published', visibility_type: 'class_restricted', restricted_to_classes: ['P'] }
describe('shared CMS permissions', () => {
  it('unions parent and teacher reads without granting parent-scope writes', () => {
    expect(canPerformCmsAction(actor, 'article:view', article)).toBe(true)
    expect(canPerformCmsAction(actor, 'article:edit', article)).toBe(false)
    expect(canPerformCmsAction(actor, 'article:edit', { ...article, restricted_to_classes: ['T'] })).toBe(true)
    expect(canPerformCmsAction(actor, 'article:edit', { ...article, restricted_to_classes: ['T', 'P'] })).toBe(false)
  })
  it('fails closed for unknown roles/actions and empty restrictions', () => {
    expect(canPerformCmsAction({ ...actor, roles: ['owner'] }, 'cms:manage')).toBe(false)
    expect(canPerformCmsAction({ ...actor, roles: ['admin'] }, 'made-up')).toBe(false)
    expect(canPerformCmsAction(actor, 'article:view', { ...article, restricted_to_classes: [] })).toBe(false)
  })
  it('limits publishing and delivery to admins', () => {
    for (const action of ['newsletter:publish', 'email:deliver', 'article:delete']) {
      expect(canPerformCmsAction(actor, action, article)).toBe(false)
      expect(canPerformCmsAction({ ...actor, roles: ['admin'] }, action, article)).toBe(true)
    }
  })
  it('keeps public published reads, hides drafts and deleted content', () => {
    expect(canPerformCmsAction(null, 'article:view', { ...article, visibility_type: 'public' })).toBe(true)
    expect(canPerformCmsAction(actor, 'article:view', { ...article, status: 'draft' })).toBe(false)
    expect(canPerformCmsAction({ ...actor, roles: ['admin'] }, 'article:view', { ...article, deleted_at: 'now' })).toBe(false)
  })
})
