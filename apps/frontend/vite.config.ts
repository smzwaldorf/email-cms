import { defineConfig, loadEnv, type Plugin } from 'vite' // Trigger rebuild
import react from '@vitejs/plugin-react'
import path from 'path'
import type { IncomingMessage, ServerResponse } from 'node:http'

function logoutFramePolicy(authOrigin: string): Plugin {
  const middleware = (request: IncomingMessage, response: ServerResponse, next: () => void) => {
    if (request.url?.split('?')[0] === '/logout/local') {
      response.setHeader('Content-Security-Policy', `frame-ancestors ${authOrigin}`)
      response.removeHeader('X-Frame-Options')
      response.setHeader('Cache-Control', 'no-store')
    }
    next()
  }
  return {
    name: 'cms-logout-frame-policy',
    configureServer: server => { server.middlewares.use(middleware) },
    configurePreviewServer: server => { server.middlewares.use(middleware) },
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, '../..'), 'VITE_')
  const authOrigin = new URL(env.VITE_SMZ_AUTH_ISSUER || 'http://localhost:3000/api/auth').origin
  return {
  envDir: path.resolve(__dirname, '../..'),
  plugins: [react(), logoutFramePolicy(authOrigin)],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    open: true,
    proxy: { '/api': { target: env.VITE_BACKEND_URL || 'http://localhost:8787', changeOrigin: false } },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
    // Code splitting configuration for optimal chunk sizes
    // Reduces main bundle and enables better caching
    rollupOptions: {
      output: {
        // Manual code splitting strategy for better optimization
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            return 'vendor'
          }
          // Feature chunks: Authentication UI separated from main bundle
          if (id.includes('src/components/auth') || id.includes('src/context/AuthContext')) {
            return 'auth'
          }
          // Article editor chunk: Lazy loaded, not in initial bundle
          if (id.includes('ArticleEditor')) {
            return 'editor'
          }
          // Admin dashboard chunk: Only loaded when admin accesses dashboard
          if (id.includes('AdminDashboard') || id.includes('admin')) {
            return 'admin'
          }
        },
        // Optimize chunk names for better readability
        chunkFileNames: 'chunks/[name]-[hash].js',
        entryFileNames: '[name]-[hash].js',
      },
    },
    // Increase chunk size warnings threshold to 1000kb for this project
    // (larger than default 500kb due to rich auth feature set)
    chunkSizeWarningLimit: 1000,
    // Optimize CSS output
    cssCodeSplit: true,
    // Report compression results
    reportCompressedSize: true,
  },
  }
})
