import { storageService } from '@/services/storageService'

/** Default signed URL TTL for inline previews (short). */
const DEFAULT_STORAGE_SIGN_TTL_SECONDS = 300

/** Signed URL TTL for email HTML (images must load when the message is opened days later). */
export const EMAIL_HTML_STORAGE_SIGN_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 days

/**
 * Replace storage:// tokens in HTML with signed URLs
 * @param html HTML content containing storage:// tokens
 * @param expiresInSeconds Supabase signed URL lifetime (default short TTL for page previews)
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
