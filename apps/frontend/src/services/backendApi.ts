import { getSupabaseClient } from '@/lib/supabase'
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

export class BackendApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message)
    this.name = 'BackendApiError'
  }
}

function backendBaseUrl(): string {
  const configured = import.meta.env.VITE_BACKEND_URL
  return (configured && configured.replace(/\/+$/, '')) || 'http://localhost:8787'
}

async function getAccessToken(): Promise<string> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.auth.getSession()
  if (error) {
    throw new BackendApiError(`Failed to read session: ${error.message}`, 401, error)
  }
  const token = data.session?.access_token
  if (!token) {
    throw new BackendApiError('Admin API requires an authenticated session.', 401)
  }
  return token
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text.trim()) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

export async function backendRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = await getAccessToken()
  const response = await fetch(`${backendBaseUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  })
  const body = await parseResponseBody(response)
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'error' in body
      ? String((body as { error: unknown }).error)
      : `Backend API request failed with status ${response.status}`
    throw new BackendApiError(message, response.status, body)
  }
  return body as T
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
