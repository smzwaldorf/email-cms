/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BACKEND_URL: string
  readonly VITE_APP_URL: string
  readonly VITE_SMZ_AUTH_ISSUER: string
  readonly VITE_STORAGE_PROVIDER: string
  readonly VITE_MEDIA_BUCKET: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
