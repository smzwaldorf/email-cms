import { mediaBucket, signedMediaUrl } from '#/services/r2MediaService'
import type { FileMetadata, FileObject, ListOptions, StorageOperationResult, StorageProvider, UploadOptions, UploadProgressCallback } from '#/types/storage'

export class R2StorageAdapter implements StorageProvider {
  getProviderName() { return 'CloudflareR2' }
  private validate(bucket: string) { if (bucket !== 'media') throw new Error('Unknown media bucket') }
  async upload(_bucket: string, _path: string, _file: File | Blob, _options?: UploadOptions, _onProgress?: UploadProgressCallback): Promise<StorageOperationResult> {
    throw new Error('Use the media upload service to commit object metadata')
  }
  getPublicUrl(bucket: string, path: string) { this.validate(bucket); return `storage://media/${path}` }
  async getSignedUrl(bucket: string, path: string, expiresIn?: number) { this.validate(bucket); return signedMediaUrl(path, expiresIn) }
  async exists(bucket: string, path: string) { this.validate(bucket); return !!await mediaBucket().head(path) }
  async download(bucket: string, path: string): Promise<Blob> {
    this.validate(bucket)
    const object = await mediaBucket().get(path)
    if (!object) throw new Error('Media not found')
    return new Blob([await object.arrayBuffer()], { type: object.httpMetadata?.contentType })
  }
  async getMetadata(bucket: string, path: string): Promise<FileMetadata> {
    this.validate(bucket)
    const object = await mediaBucket().head(path)
    if (!object) throw new Error('Media not found')
    return { name: path, size: object.size, mimeType: object.httpMetadata?.contentType ?? 'application/octet-stream', uploadedAt: object.uploaded.toISOString(), updatedAt: object.uploaded.toISOString() }
  }
  async list(bucket: string, path: string, options?: ListOptions): Promise<FileObject[]> {
    this.validate(bucket)
    const result = await mediaBucket().list({ prefix: path, limit: options?.limit })
    return result.objects.map(object => ({ name: object.key, id: object.key, created_at: object.uploaded.toISOString(), updated_at: object.uploaded.toISOString(), last_accessed_at: object.uploaded.toISOString() }))
  }
  async delete(_bucket: string, _path: string): Promise<StorageOperationResult> { throw new Error('Use media deletion preflight to protect article references') }
  async copy(_bucket: string, _source: string, _destination: string): Promise<StorageOperationResult> { throw new Error('Reuse media references instead of copying objects') }
  async move(_bucket: string, _source: string, _destination: string): Promise<StorageOperationResult> { throw new Error('Media object keys are immutable') }
}
