import { defineConfig } from 'vite' // Trigger rebuild
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    open: true,
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
          // Vendor chunks: Supabase and other large dependencies
          if (id.includes('node_modules/supabase')) {
            return 'supabase'
          }
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
})
