import { backendRequestOptional } from '@/services/backendApi'
import type { FileMetadata, FileObject, ListOptions, StorageOperationResult, StorageProvider, UploadOptions, UploadProgressCallback } from '@/types/storage'

/** Private R2 objects are accessed through the CMS API, using the current session. */
export class BackendStorageAdapter implements StorageProvider {
  getProviderName() { return 'CloudflareR2' }
  async upload(_bucket: string, _path: string, _file: File | Blob, _options?: UploadOptions, _onProgress?: UploadProgressCallback): Promise<StorageOperationResult> {
    throw new Error('Use the media upload API so storage and database records stay consistent')
  }
  getPublicUrl(bucket: string, path: string) { return `storage://${bucket}/${path}` }
  async getSignedUrl(bucket: string, path: string, _expiresIn?: number): Promise<string> {
    if (bucket !== 'media') throw new Error('Unknown media bucket')
    const search = new URLSearchParams({ path })
    return (await backendRequestOptional<{ url: string }>(`/api/media/sign?${search}`)).url
  }
  async download(bucket: string, path: string): Promise<Blob> {
    const response = await fetch(await this.getSignedUrl(bucket, path))
    if (!response.ok) throw new Error('Failed to download media')
    return response.blob()
  }
  async exists(bucket: string, path: string): Promise<boolean> {
    try { return (await fetch(await this.getSignedUrl(bucket, path), { method: 'HEAD' })).ok } catch { return false }
  }
  async getMetadata(_bucket: string, _path: string): Promise<FileMetadata> { throw new Error('Read media metadata through the CMS media library') }
  async list(_bucket: string, _path: string, _options?: ListOptions): Promise<FileObject[]> { throw new Error('List media through the CMS media library') }
  async delete(_bucket: string, _path: string): Promise<StorageOperationResult> { throw new Error('Use media deletion preflight to protect article references') }
  async copy(_bucket: string, _source: string, _destination: string): Promise<StorageOperationResult> { throw new Error('Reuse media in article content without copying its object') }
  async move(_bucket: string, _source: string, _destination: string): Promise<StorageOperationResult> { throw new Error('Media object keys are immutable') }
}
