import { describe, expect, it } from 'vitest'

import { canViewArticle, canViewNewsletter, type ReaderViewer } from '#/services/readerVisibility'

const parent: ReaderViewer = { id: 'parent-1', role: 'parent', classIds: ['A1', 'B2'] }
const teacher: ReaderViewer = { id: 'teacher-1', role: 'teacher', classIds: ['A1'] }
const admin: ReaderViewer = { id: 'admin-1', role: 'admin', classIds: [] }
const student: ReaderViewer = { id: 'student-1', role: 'student', classIds: [] }

describe('canViewNewsletter', () => {
  it('lets anyone read a published newsletter', () => {
    expect(canViewNewsletter({ status: 'published' }, null)).toBe(true)
    expect(canViewNewsletter({ status: 'published' }, student)).toBe(true)
  })

  it('hides draft and archived newsletters from anonymous and parent viewers', () => {
    expect(canViewNewsletter({ status: 'draft' }, null)).toBe(false)
    expect(canViewNewsletter({ status: 'archived' }, parent)).toBe(false)
  })

  it('lets admins and teachers read unpublished newsletters', () => {
    expect(canViewNewsletter({ status: 'draft' }, admin)).toBe(true)
    expect(canViewNewsletter({ status: 'archived' }, teacher)).toBe(true)
  })
})

describe('canViewArticle', () => {
  it('hides soft-deleted articles from every role, including admin', () => {
    expect(
      canViewArticle(
        { status: 'published', deleted_at: '2026-01-01T00:00:00Z', visibility_type: 'public' },
        admin,
      ),
    ).toBe(false)
  })

  it('lets anonymous viewers read published public articles only', () => {
    expect(
      canViewArticle({ status: 'published', deleted_at: null, visibility_type: 'public' }, null),
    ).toBe(true)
    expect(
      canViewArticle(
        {
          status: 'published',
          deleted_at: null,
          visibility_type: 'class_restricted',
          restricted_to_classes: ['A1'],
        },
        null,
      ),
    ).toBe(false)
    expect(
      canViewArticle({ status: 'draft', deleted_at: null, visibility_type: 'public' }, null),
    ).toBe(false)
  })

  it('lets parents read class-restricted articles for their children only', () => {
    expect(
      canViewArticle(
        {
          status: 'published',
          deleted_at: null,
          visibility_type: 'class_restricted',
          restricted_to_classes: ['A1'],
        },
        parent,
      ),
    ).toBe(true)
    expect(
      canViewArticle(
        {
          status: 'published',
          deleted_at: null,
          visibility_type: 'class_restricted',
          restricted_to_classes: ['C3'],
        },
        parent,
      ),
    ).toBe(false)
  })

  it('lets teachers read class-restricted articles for assigned classes only', () => {
    expect(
      canViewArticle(
        {
          status: 'published',
          deleted_at: null,
          visibility_type: 'class_restricted',
          restricted_to_classes: ['A1'],
        },
        teacher,
      ),
    ).toBe(true)
    expect(
      canViewArticle(
        {
          status: 'published',
          deleted_at: null,
          visibility_type: 'class_restricted',
          restricted_to_classes: ['B2'],
        },
        teacher,
      ),
    ).toBe(false)
  })

  it('lets admins read drafts and class-restricted articles', () => {
    expect(
      canViewArticle({ status: 'draft', deleted_at: null, visibility_type: 'public' }, admin),
    ).toBe(true)
    expect(
      canViewArticle(
        {
          status: 'published',
          deleted_at: null,
          visibility_type: 'class_restricted',
          restricted_to_classes: ['Z9'],
        },
        admin,
      ),
    ).toBe(true)
  })

  it('does not give students class-restricted access', () => {
    expect(
      canViewArticle(
        {
          status: 'published',
          deleted_at: null,
          visibility_type: 'class_restricted',
          restricted_to_classes: ['A1'],
        },
        student,
      ),
    ).toBe(false)
  })
})
