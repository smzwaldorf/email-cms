import { describe, expect, it } from 'vitest'

import { resolveArticleTargetClassIds } from '#/services/newsletterDeliveryService'

describe('newsletter article targeting', () => {
  it('keeps explicitly shared rows shared', () => {
    expect(resolveArticleTargetClassIds({ articleId: 'shared', targetingMode: 'shared', targetClassIds: null })).toBeNull()
    expect(resolveArticleTargetClassIds({ articleId: 'legacy', targetingMode: null, targetClassIds: [] })).toBeNull()
  })

  it('fails closed when a targeted row has no usable class target', () => {
    expect(() => resolveArticleTargetClassIds({ articleId: 'malformed', targetingMode: 'targeted', targetClassIds: null }))
      .toThrow('targeted but has no class targets')
    expect(() => resolveArticleTargetClassIds({ articleId: 'empty', targetingMode: 'targeted', targetClassIds: [] }))
      .toThrow('targeted but has no class targets')
  })
})
