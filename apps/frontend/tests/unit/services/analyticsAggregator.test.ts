import { beforeEach, describe, expect, it, vi } from 'vitest'
const rpc = vi.hoisted(() => vi.fn())
vi.mock('@/services/backendApi', () => ({ adminRpc: rpc }))
import { analyticsAggregator } from '@/services/analyticsAggregator'
beforeEach(() => vi.clearAllMocks())
describe('authorized analytics client', () => {
 it('loads newsletter metrics through the admin service', async () => {
  const metrics = { sentRecipients: 2, deliveredRecipients: 2, openRate: 50, clickRate: 0 }
  rpc.mockResolvedValue(metrics)
  expect(await analyticsAggregator.getNewsletterMetrics('n1', 'Grade 1')).toEqual(metrics)
  expect(rpc).toHaveBeenCalledWith('analytics', 'getNewsletterMetrics', ['n1', 'Grade 1', 'resend'])
 })
 it('forwards the CMS tracker selection', async () => {
  await analyticsAggregator.getNewsletterMetrics('n1', undefined, 'cms')
  expect(rpc).toHaveBeenCalledWith('analytics', 'getNewsletterMetrics', ['n1', undefined, 'cms'])
 })
 it('uses backend directory aggregation for class data', async () => {
  rpc.mockResolvedValue(['Grade 1'])
  expect(await analyticsAggregator.getAllClasses()).toEqual(['Grade 1'])
  expect(rpc).toHaveBeenCalledWith('analytics', 'getAllClasses', [])
 })
 it('propagates authorization failures instead of presenting fake zero metrics', async () => {
  rpc.mockRejectedValue(new Error('Unauthorized'))
  await expect(analyticsAggregator.getNewsletterMetrics('n1')).rejects.toThrow('Unauthorized')
 })
})

it('forwards the trend tracker and retains unavailable rates', async () => {
 const trend = [{ name: 'W1', openRate: null, clickRate: null, avgTimeSpent: 0 }]
 rpc.mockResolvedValue(trend)
 expect(await analyticsAggregator.getTrendStats(12, undefined, 'cms')).toEqual(trend)
 expect(rpc).toHaveBeenCalledWith('analytics', 'getTrendStats', [12, undefined, 'cms'])
})
