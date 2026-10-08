import { emailMediaUrl } from '#/services/r2MediaService'
import { storageService } from '#/services/storageService'

/** Default signed URL TTL for inline previews (short). */
const DEFAULT_STORAGE_SIGN_TTL_SECONDS = 300


/**
 * Replace storage:// tokens in HTML with signed URLs
 * @param html HTML content containing storage:// tokens
 * @param expiresInSeconds Restricted preview signed URL lifetime (default short TTL for page previews)
 * @returns HTML with signed URLs
 */
export async function replaceStorageTokens(
  html: string,
  expiresInSeconds: number = DEFAULT_STORAGE_SIGN_TTL_SECONDS,
): Promise<string> {
  if (!html) return ''

  // Find all storage:// tokens
  // Matches storage:// followed by non-quote, non-whitespace characters
  const regex = /storage:\/\/([^"'\s]+)/g
  const matches = html.match(regex)

  if (!matches) return html

  let newHtml = html

  // Deduplicate matches to avoid multiple requests
  const uniqueMatches = [...new Set(matches)]

  // Process all tokens in parallel
  const replacements = await Promise.all(
    uniqueMatches.map(async (token) => {
      try {
        // token is like storage://media/userId/...
        // Parse bucket and path
        const pathWithoutProtocol = token.replace('storage://', '')
        const [bucket, ...pathParts] = pathWithoutProtocol.split('/')
        const path = pathParts.join('/')

        if (bucket && path) {
          const signedUrl = await storageService.getSignedUrl(bucket, path, expiresInSeconds)
          return { token, signedUrl }
        }
      } catch (error) {
        console.error(`Failed to sign URL for ${token}:`, error)
      }
      return null
    })
  )

  // Apply replacements
  for (const replacement of replacements) {
    if (replacement) {
      // Escape special characters in token for RegExp
      const escapedToken = replacement.token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      newHtml = newHtml.replace(new RegExp(escapedToken, 'g'), replacement.signedUrl)
    }
  }

  return newHtml
}


/** Fail closed: outbound mail never contains expiring editor URLs or unapproved R2 assets. */
export async function replaceEmailStorageTokens(html: string): Promise<string> {
  const tokens = [...new Set(html.match(/storage:\/\/[^"'\s<>]+/g) ?? [])]
  for (const token of tokens) {
    if (!token.startsWith('storage://media/')) throw new Error('Unsupported email media storage')
    html = html.split(token).join(await emailMediaUrl(token.slice('storage://media/'.length)))
  }
  // Editor preview URLs sometimes survive HTML serialization. Those must not be mailed.
  if (/\/api\/media\/[^"'\s<>]+\/content\?[^"'\s<>]*token=/.test(html)) throw new Error('Outbound email contains an expiring media preview URL')
  return html
}
