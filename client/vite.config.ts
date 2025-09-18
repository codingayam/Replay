import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

const resolveHttpsConfig = () => {
  const certPath = process.env.VITE_DEV_SSL_CERT || process.env.DEV_SSL_CERT;
  const keyPath = process.env.VITE_DEV_SSL_KEY || process.env.DEV_SSL_KEY;

  if (!certPath || !keyPath) {
    return undefined;
  }

  try {
    const resolvedCert = path.resolve(certPath);
    const resolvedKey = path.resolve(keyPath);

    if (!fs.existsSync(resolvedCert) || !fs.existsSync(resolvedKey)) {
      console.warn('[vite] HTTPS dev certificates not found. Falling back to HTTP.');
      return undefined;
    }

    return {
      cert: fs.readFileSync(resolvedCert),
      key: fs.readFileSync(resolvedKey)
    };
  } catch (error) {
    console.warn('[vite] Failed to load HTTPS dev certificates. Falling back to HTTP.', error);
    return undefined;
  }
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          router: ['react-router-dom'],
          supabase: ['@supabase/supabase-js', '@supabase/ssr'],
          utils: ['axios', 'lucide-react']
        }
      }
    }
  },
  server: {
    https: resolveHttpsConfig(),
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/audio': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/day_audio': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/images': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
