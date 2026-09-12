import { serverSessionMode } from './serverSessionMode'
import { requestBackend, getAccessTokenOrNull, BackendApiError } from '@/services/backendClient'
import type { ArticleRow, NewsletterRow } from '@/types/database'
import type {
  DeliveryAudienceSelection,
  NewsletterDeliveryBatch,
  NewsletterDeliveryRecipient,
  PublishDeliveryRequest,
  ResendDeliveryRequest,
} from '@/types/emailDelivery'
import type { FileEmailTemplatePreviewResult, FileEmailTemplateSourceMetadata } from '@/types/fileEmailTemplate'

export interface BackendBatchImportUserRow {
  email: string
  name: string
  role: 'admin' | 'teacher' | 'parent' | 'student'
  status?: 'active' | 'disabled' | 'pending_approval'
}

export interface BackendBatchImportResult {
  importedCount: number
  importedUserEmails: string[]
}

export { BackendApiError }

function requireAccessToken(): string {
  const token = getAccessTokenOrNull()
  if (!token) {
    throw new BackendApiError('Admin API requires an authenticated session.', 401)
  }
  return token
}

export async function backendRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  return requestBackend<T>(path, init, serverSessionMode ? null : requireAccessToken())
}

export async function backendRequestOptional<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  return requestBackend<T>(path, init, getAccessTokenOrNull())
}

export interface ReaderWeekBundle {
  newsletter: NewsletterRow
  articles: ArticleRow[]
}

export type ReaderArticle = ArticleRow & {
  newsletter_id?: string
  week_number?: string
}

export const readerApi = {
  getWeek(idOrWeek: string): Promise<ReaderWeekBundle> {
    return backendRequestOptional<ReaderWeekBundle>(
      `/api/reader/weeks/${encodeURIComponent(idOrWeek)}`,
    )
  },

  getArticle(articleId: string, newsletterId?: string): Promise<ReaderArticle> {
    const search = new URLSearchParams()
    if (newsletterId) search.set('newsletterId', newsletterId)
    const query = search.toString()
    return backendRequestOptional<ReaderArticle>(
      `/api/reader/articles/${encodeURIComponent(articleId)}${query ? `?${query}` : ''}`,
    )
  },
}

export async function adminRpc<T>(
  service: 'admin' | 'emailTemplate' | 'newsletterDelivery' | 'fileEmailTemplate',
  method: string,
  args: unknown[] = [],
): Promise<T> {
  return backendRequest<T>('/api/admin/rpc', {
    method: 'POST',
    body: JSON.stringify({ service, method, args }),
  })
}

export const adminApi = {
  listFileTemplateSources(): Promise<FileEmailTemplateSourceMetadata[]> {
    return backendRequest<FileEmailTemplateSourceMetadata[]>('/api/admin/email/file-template-sources')
  },

  previewFileTemplateSource(sourceId: string): Promise<FileEmailTemplatePreviewResult> {
    return backendRequest<FileEmailTemplatePreviewResult>(
      `/api/admin/email/file-template-sources/${encodeURIComponent(sourceId)}/preview`,
    )
  },

  previewNewsletterEmail(input: {
    newsletterId: string
    familyId: string
    templateId?: string
  }): Promise<unknown> {
    return backendRequest<unknown>(
      `/api/admin/newsletters/${encodeURIComponent(input.newsletterId)}/preview-email`,
      {
        method: 'POST',
        body: JSON.stringify({
          familyId: input.familyId,
          templateId: input.templateId,
        }),
      },
    )
  },

  publishAndDeliver(request: PublishDeliveryRequest): Promise<{
    newsletter: unknown
    batch: NewsletterDeliveryBatch
  }> {
    return backendRequest<{ newsletter: unknown; batch: NewsletterDeliveryBatch }>(
      `/api/admin/newsletters/${encodeURIComponent(request.newsletterId)}/publish-and-deliver`,
      {
        method: 'POST',
        body: JSON.stringify({ audience: request.audience }),
      },
    )
  },

  getPublishReadiness(newsletterId: string, audience?: DeliveryAudienceSelection): Promise<unknown> {
    return backendRequest<unknown>(
      `/api/admin/newsletters/${encodeURIComponent(newsletterId)}/publish-readiness`,
      {
        method: 'POST',
        body: JSON.stringify({ audience }),
      },
    )
  },

  listDeliveryBatches(newsletterId: string): Promise<unknown> {
    return backendRequest<unknown>(
      `/api/admin/newsletters/${encodeURIComponent(newsletterId)}/delivery-batches`,
    )
  },

  createResendBatch(request: ResendDeliveryRequest): Promise<NewsletterDeliveryBatch> {
    return backendRequest<NewsletterDeliveryBatch>(
      `/api/admin/delivery-batches/${encodeURIComponent(request.parentBatchId)}/resend`,
      {
        method: 'POST',
        body: JSON.stringify({ audience: request.audience }),
      },
    )
  },

  listDeliveryRecipients(batchId: string): Promise<NewsletterDeliveryRecipient[]> {
    return backendRequest<NewsletterDeliveryRecipient[]>(
      `/api/admin/delivery-batches/${encodeURIComponent(batchId)}/recipients`,
    )
  },

  listAuthEvents(params: {
    authMethod?: string
    eventType?: string
    days?: number
  }): Promise<unknown[]> {
    const search = new URLSearchParams()
    if (params.authMethod) search.set('authMethod', params.authMethod)
    if (params.eventType) search.set('eventType', params.eventType)
    if (params.days) search.set('days', String(params.days))
    return backendRequest<unknown[]>(`/api/admin/access-control/auth-events?${search.toString()}`)
  },

  importUsers(rows: BackendBatchImportUserRow[]): Promise<BackendBatchImportResult> {
    return backendRequest<BackendBatchImportResult>('/api/admin/batch-import-users', {
      method: 'POST',
      body: JSON.stringify({ rows }),
    })
  },
}
