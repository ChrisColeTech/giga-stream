import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      /* The family UI library and the request layer are consumed as source (docs/27 section 3), never built. */
      '@giga/ui': fileURLToPath(new URL('../shared/ui/src', import.meta.url)),
      '@giga/http': fileURLToPath(new URL('../shared/http/src', import.meta.url)),
    },
    /* One copy of each runtime package, whichever folder a file sits in: the library's imports resolve to this app's. */
    dedupe: ['react', 'react-dom', 'framer-motion', 'zustand', 'lucide-react'],
  },
  server: {
    host: '127.0.0.1',
    port: 5171,
    strictPort: true,
    /* The repository root has no workspaces, so Vite would answer 403 for ../shared (docs/27 section 3). */
    fs: { allow: [fileURLToPath(new URL('../..', import.meta.url))] },
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
  /* The production build in a browser (`npm run preview`): its own port, talking to the production fileserver, so it never
   * collides with the dev server and the dev stack (docs/03 section 1). */
  preview: {
    host: '127.0.0.1',
    port: 5271,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8190', changeOrigin: true, ws: true },
      '/ws': { target: 'http://127.0.0.1:8190', changeOrigin: true, ws: true },
    },
  },
})
