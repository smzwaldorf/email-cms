/**
 * The frontend adminService is a thin proxy that forwards calls to the
 * backend admin RPC endpoint. Business-logic tests live in
 * apps/backend/tests/unit/services/. These tests only pin the forwarding
 * contract.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockAdminRpc, mockAdminApi } = vi.hoisted(() => ({
  mockAdminRpc: vi.fn(),
  mockAdminApi: {
    getPublishReadiness: vi.fn(),
    publishAndDeliver: vi.fn(),
    listDeliveryBatches: vi.fn(),
    createResendBatch: vi.fn(),
    listDeliveryRecipients: vi.fn(),
  },
}))

vi.mock('@/services/backendApi', () => ({
  adminRpc: mockAdminRpc,
  adminApi: mockAdminApi,
}))

import { adminService } from '@/services/adminService'

describe('adminService proxy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('forwards arbitrary methods to the admin RPC endpoint with their args', async () => {
    const newsletters = [{ id: 'newsletter-1' }]
    mockAdminRpc.mockResolvedValue(newsletters)

    const result = await adminService.fetchNewsletters({ status: 'published' })

    expect(mockAdminRpc).toHaveBeenCalledWith('admin', 'fetchNewsletters', [
      { status: 'published' },
    ])
    expect(result).toBe(newsletters)
  })

  it('propagates RPC failures to the caller', async () => {
    mockAdminRpc.mockRejectedValue(new Error('backend unavailable'))

    await expect(adminService.deleteUser('user-1')).rejects.toThrow('backend unavailable')
    expect(mockAdminRpc).toHaveBeenCalledWith('admin', 'deleteUser', ['user-1'])
  })

  it('routes publishNewsletterWithDelivery through the dedicated delivery endpoint', async () => {
    const newsletter = { id: 'newsletter-1', status: 'published' }
    mockAdminApi.publishAndDeliver.mockResolvedValue({ newsletter, batch: { id: 'batch-1' } })

    const result = await adminService.publishNewsletterWithDelivery('newsletter-1', {
      mode: 'all',
    })

    expect(mockAdminApi.publishAndDeliver).toHaveBeenCalledWith({
      newsletterId: 'newsletter-1',
      audience: { mode: 'all' },
    })
    expect(mockAdminRpc).not.toHaveBeenCalled()
    expect(result).toBe(newsletter)
  })

  it('routes delivery batch reads through the dedicated endpoints', async () => {
    const batches = [{ id: 'batch-1' }]
    mockAdminApi.listDeliveryBatches.mockResolvedValue(batches)

    await expect(adminService.fetchNewsletterDeliveryBatches('newsletter-1')).resolves.toBe(
      batches,
    )
    expect(mockAdminApi.listDeliveryBatches).toHaveBeenCalledWith('newsletter-1')
  })
})
