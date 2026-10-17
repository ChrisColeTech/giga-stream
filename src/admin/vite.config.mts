import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

/* The admin is served by the admin backend at /admin/ (docs/26 section 4.1), so every built address is under that
 * base. In development Vite answers on 5172 (docs/26 D9) and forwards the backend's routes, which keeps the page
 * same-origin: no CORS. ADMIN_BACKEND_URL overrides the backend's development address (docs/03 section 1: 8091). */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'ADMIN_')
  const backend = env.ADMIN_BACKEND_URL || 'http://127.0.0.1:8091'
  const forward = { target: backend, changeOrigin: true }

  return {
    base: '/admin/',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
    server: {
      host: '127.0.0.1',
      port: 5172,
      strictPort: true,
      /* Polling file watch, so edits show up on a network or synced drive too; hot module reload pushes each change
       * into the open page without a full reload. Development only. */
      watch: {
        usePolling: true,
        interval: 100,
      },
      hmr: {
        host: '127.0.0.1',
        overlay: true,
      },
      proxy: {
        '/api': forward,
        '/live': forward,
        '/logos': forward,
      },
    },
    preview: {
      host: '127.0.0.1',
      port: 5272,
      strictPort: true,
      proxy: {
        '/api': forward,
        '/live': forward,
        '/logos': forward,
      },
    },
  }
})
