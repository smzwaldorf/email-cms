import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto'
import { runtimeEnvironment } from '#/runtime/environment'

export const randomSessionId = () => randomBytes(32).toString('base64url')
export const hashSessionId = (value: string) => createHash('sha256').update(value).digest('hex')
function key(): Buffer {
  const secret = runtimeEnvironment().CMS_SESSION_SECRET
  if (!secret || !/^[a-f0-9]{64}$/i.test(secret)) throw new Error('CMS_SESSION_SECRET must be 32 random bytes encoded as hex')
  return Buffer.from(secret, 'hex')
}
export function seal(value: unknown, purpose: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  cipher.setAAD(Buffer.from(purpose))
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), encrypted].map(part => part.toString('base64url')).join('.')
}
export function unseal<T>(value: string, purpose: string): T {
  const parts = value.split('.')
  if (parts.length !== 3) throw new Error('Invalid session ciphertext')
  const [iv, tag, encrypted] = parts.map(part => Buffer.from(part, 'base64url'))
  const cipher = createDecipheriv('aes-256-gcm', key(), iv)
  cipher.setAAD(Buffer.from(purpose))
  cipher.setAuthTag(tag)
  return JSON.parse(Buffer.concat([cipher.update(encrypted), cipher.final()]).toString('utf8')) as T
}
