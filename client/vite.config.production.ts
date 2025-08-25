import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Production-optimized Vite configuration for Railway deployment
export default defineConfig({
  plugins: [react()],
  build: {
    // Optimize for Railway's constraints
    target: 'es2015',
    minify: 'esbuild',
    sourcemap: false, // Disable source maps in production for smaller builds
    rollupOptions: {
      output: {
        // Manual chunks to reduce initial bundle size
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'router': ['react-router-dom'],
          'supabase': ['@supabase/supabase-js', '@supabase/ssr'],
          'ui-vendor': ['lucide-react'],
          'http': ['axios']
        }
      }
    },
    // Set reasonable chunk size warning limit
    chunkSizeWarningLimit: 600
  },
  // No dev server config needed for production
})