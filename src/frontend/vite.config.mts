import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5171,
    strictPort: true,
    /* Polling file watch, so edits show up on a network or synced drive too; hot module reload pushes each change into
     * the open page without a full reload. Development only. */
    watch: {
      usePolling: true,
      interval: 100,
    },
    hmr: {
      host: '127.0.0.1',
      overlay: true,
    },
    proxy: {
      '/api': { target: 'http://127.0.0.1:8090', changeOrigin: true, ws: true },
      '/ws': { target: 'http://127.0.0.1:8090', changeOrigin: true, ws: true },
    },
  },
})
