import {
  EmailPlatformAdapter,
  EmailPlatformConfig,
  EmailPlatformSubscriberSnapshot,
  EmailPlatformSyncOutcome,
  EmailPlatformSyncRequest,
  KitApiError,
} from '../../types/emailPlatform.ts'
import { computePayloadFingerprint } from './utils.ts'

interface KitSubscriberResponse {
  subscriber: {
    id: number
    first_name?: string | null
    email_address: string
    state: string
    created_at?: string
    fields?: Record<string, string>
    tagged_at?: string
  }
}

interface KitTag {
  id: number
  name: string
  created_at?: string
  tagged_at?: string
}

interface KitCustomField {
  id: number
  name: string
  key: string
  label: string
}

export class KitAdapter implements EmailPlatformAdapter {
  private readonly baseHeaders: HeadersInit

  constructor(
    private readonly config: EmailPlatformConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.baseHeaders = {
      'Content-Type': 'application/json',
      'X-Kit-Api-Key': this.config.apiToken,
    }
  }

  async upsertSubscriber(input: EmailPlatformSyncRequest): Promise<EmailPlatformSyncOutcome> {
    await this.ensureCustomFields(Object.keys(input.payload.customFields))

    const subscriberResponse = await this.request<KitSubscriberResponse>('/v4/subscribers', {
      method: 'POST',
      body: JSON.stringify({
        email_address: input.payload.emailAddress,
        first_name: input.payload.firstName ?? null,
        state: input.payload.state,
        fields: input.payload.customFields,
      }),
    })

    const subscriberId = String(subscriberResponse.subscriber.id)
    const desiredTags = await this.ensureTags(input.payload.tagNames)
    const currentTags = await this.listSubscriberTags(subscriberId)
    const currentClassTags = currentTags.filter((tag) =>
      tag.name.startsWith(this.config.classTagPrefix),
    )
    const desiredTagIds = new Set(desiredTags.map((tag) => tag.id))

    for (const tag of desiredTags) {
      if (!currentTags.some((currentTag) => currentTag.id === tag.id)) {
        await this.request<KitSubscriberResponse>(`/v4/tags/${tag.id}/subscribers/${subscriberId}`, {
          method: 'POST',
          body: JSON.stringify({}),
        })
      }
    }

    for (const tag of currentClassTags) {
      if (!desiredTagIds.has(tag.id)) {
        await this.request<void>(`/v4/tags/${tag.id}/subscribers/${subscriberId}`, {
          method: 'DELETE',
        })
      }
    }

    const snapshot = await this.getSubscriberSnapshot(subscriberId)

    return {
      externalSubscriberId: subscriberId,
      externalEmailAddress: snapshot.emailAddress,
      providerState: snapshot.state,
      providerVersionMarker: snapshot.providerVersionMarker,
      syncedTagNames: snapshot.tagNames,
      syncedTagIds: desiredTags.map((tag) => tag.id),
      syncedFieldKeys: Object.keys(snapshot.fields),
      raw: snapshot.raw,
    }
  }

  async getSubscriberSnapshot(externalSubscriberId: string): Promise<EmailPlatformSubscriberSnapshot> {
    const subscriberResponse = await this.request<KitSubscriberResponse>(
      `/v4/subscribers/${externalSubscriberId}`,
      { method: 'GET' },
    )
    const tags = await this.listSubscriberTags(externalSubscriberId)
    const providerVersionMarker = await computePayloadFingerprint({
      id: externalSubscriberId,
      email: subscriberResponse.subscriber.email_address,
      state: subscriberResponse.subscriber.state,
      fields: subscriberResponse.subscriber.fields ?? {},
      tags: tags.map((tag) => tag.name).sort((left, right) => left.localeCompare(right)),
    })

    return {
      externalSubscriberId,
      emailAddress: subscriberResponse.subscriber.email_address,
      state: subscriberResponse.subscriber.state,
      fields: subscriberResponse.subscriber.fields ?? {},
      tagNames: tags.map((tag) => tag.name).sort((left, right) => left.localeCompare(right)),
      providerVersionMarker,
      raw: {
        subscriber: subscriberResponse.subscriber,
        tags,
      },
    }
  }

  private async listSubscriberTags(subscriberId: string): Promise<KitTag[]> {
    const response = await this.request<{ tags: KitTag[] }>(
      `/v4/subscribers/${subscriberId}/tags?per_page=500`,
      { method: 'GET' },
    )
    return response.tags ?? []
  }

  private async ensureTags(tagNames: string[]): Promise<KitTag[]> {
    const uniqueTagNames = Array.from(new Set(tagNames))

    if (uniqueTagNames.length === 0) {
      return []
    }

    const tagListResponse = await this.request<{ tags: KitTag[] }>('/v4/tags?per_page=500', {
      method: 'GET',
    })
    const knownTags = new Map(
      (tagListResponse.tags ?? []).map((tag) => [tag.name.toLowerCase(), tag]),
    )

    for (const tagName of uniqueTagNames) {
      if (!knownTags.has(tagName.toLowerCase())) {
        const createdTag = await this.request<{ tag: KitTag }>('/v4/tags', {
          method: 'POST',
          body: JSON.stringify({ name: tagName }),
        })
        knownTags.set(tagName.toLowerCase(), createdTag.tag)
      }
    }

    return uniqueTagNames.map((tagName) => {
      const tag = knownTags.get(tagName.toLowerCase())
      if (!tag) {
        throw new KitApiError(`Failed to resolve Kit tag "${tagName}".`, {
          retryable: false,
        })
      }

      return tag
    })
  }

  private async ensureCustomFields(fieldKeys: string[]): Promise<KitCustomField[]> {
    const uniqueFieldKeys = Array.from(new Set(fieldKeys))

    if (uniqueFieldKeys.length === 0) {
      return []
    }

    const fieldListResponse = await this.request<{ custom_fields: KitCustomField[] }>(
      '/v4/custom_fields?per_page=500',
      { method: 'GET' },
    )
    const knownFields = new Map(
      (fieldListResponse.custom_fields ?? []).flatMap((field) => [
        [field.key.toLowerCase(), field],
        [field.label.toLowerCase(), field],
      ]),
    )

    for (const fieldKey of uniqueFieldKeys) {
      if (!knownFields.has(fieldKey.toLowerCase())) {
        const createdField = await this.request<{ custom_field: KitCustomField }>(
          '/v4/custom_fields',
          {
            method: 'POST',
            body: JSON.stringify({ label: fieldKey }),
          },
        )
        knownFields.set(fieldKey.toLowerCase(), createdField.custom_field)
      }
    }

    return uniqueFieldKeys.map((fieldKey) => {
      const field = knownFields.get(fieldKey.toLowerCase())
      if (!field) {
        throw new KitApiError(`Failed to resolve Kit custom field "${fieldKey}".`, {
          retryable: false,
        })
      }

      return field
    })
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    let response: Response

    try {
      response = await this.fetchImpl(`${this.config.apiBaseUrl}${path}`, {
        ...init,
        headers: {
          ...this.baseHeaders,
          ...(init.headers ?? {}),
        },
      })
    } catch (error) {
      throw new KitApiError(
        error instanceof Error ? error.message : 'Network error while calling Kit API.',
        {
          retryable: true,
          context: { path, method: init.method ?? 'GET' },
        },
      )
    }

    if (response.status === 204) {
      return undefined as T
    }

    const responseText = await response.text()
    const responseJson = responseText ? JSON.parse(responseText) : null

    if (!response.ok) {
      throw new KitApiError(
        this.extractApiErrorMessage(responseJson) ??
          `Kit API request failed with status ${response.status}.`,
        {
          retryable: response.status === 408 || response.status === 429 || response.status >= 500,
          statusCode: response.status,
          context: { path, method: init.method ?? 'GET', response: responseJson },
        },
      )
    }

    return responseJson as T
  }

  private extractApiErrorMessage(responseJson: unknown): string | undefined {
    if (!responseJson || typeof responseJson !== 'object') {
      return undefined
    }

    const errors = (responseJson as { errors?: string[] }).errors
    if (Array.isArray(errors) && errors.length > 0) {
      return errors.join(', ')
    }

    return undefined
  }
}
