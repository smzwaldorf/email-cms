import type { SupabaseClient } from '@supabase/supabase-js'
import type { BackendConfig } from '#/config'
import { newsletterDeliveryService } from '#/services/newsletterDeliveryService'

interface NewsletterDeliveryJobRow {
  id: string
  batch_id: string
  job_type: 'prepare_batch' | string
  status: 'queued' | 'running' | 'succeeded' | 'failed' | string
  attempts: number
  max_attempts: number
  run_after: string
  locked_at: string | null
  locked_by: string | null
  started_at: string | null
  completed_at: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}

function nowIso(): string {
  return new Date().toISOString()
}

export class NewsletterDeliveryWorker {
  constructor(
    private readonly config: BackendConfig,
    private readonly supabase: SupabaseClient,
  ) {}

  async runOnce(): Promise<number> {
    const { data, error } = await this.supabase
      .from('newsletter_delivery_jobs')
      .select('*')
      .eq('status', 'queued')
      .lte('run_after', nowIso())
      .order('created_at', { ascending: true })
      .limit(this.config.workerBatchSize)

    if (error) {
      throw new Error(`Failed to read newsletter delivery jobs: ${error.message}`)
    }

    const jobs = (data ?? []) as NewsletterDeliveryJobRow[]
    let processed = 0
    for (const job of jobs) {
      const claimed = await this.claim(job)
      if (!claimed) continue
      await this.process(claimed)
      processed += 1
    }
    return processed
  }

  private async claim(job: NewsletterDeliveryJobRow): Promise<NewsletterDeliveryJobRow | null> {
    const { data, error } = await this.supabase
      .from('newsletter_delivery_jobs')
      .update({
        status: 'running',
        locked_at: nowIso(),
        locked_by: this.config.workerId,
        attempts: job.attempts + 1,
        started_at: job.started_at ?? nowIso(),
      })
      .eq('id', job.id)
      .eq('status', 'queued')
      .select('*')
      .maybeSingle()

    if (error) {
      throw new Error(`Failed to claim newsletter delivery job ${job.id}: ${error.message}`)
    }
    return (data as NewsletterDeliveryJobRow | null) ?? null
  }

  private async process(job: NewsletterDeliveryJobRow): Promise<void> {
    try {
      if (job.job_type !== 'prepare_batch') {
        throw new Error(`Unsupported newsletter delivery job type: ${job.job_type}`)
      }

      await newsletterDeliveryService.processQueuedBatch(job.batch_id)
      await this.supabase
        .from('newsletter_delivery_jobs')
        .update({
          status: 'succeeded',
          completed_at: nowIso(),
          locked_at: null,
          locked_by: null,
          last_error: null,
        })
        .eq('id', job.id)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const retryable = job.attempts < job.max_attempts
      await this.supabase
        .from('newsletter_delivery_jobs')
        .update({
          status: retryable ? 'queued' : 'failed',
          run_after: retryable ? new Date(Date.now() + 60_000).toISOString() : job.run_after,
          locked_at: null,
          locked_by: null,
          last_error: message,
          completed_at: retryable ? null : nowIso(),
        })
        .eq('id', job.id)
    }
  }
}
