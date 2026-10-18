import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

/** The backend's development port when nothing names one (docs/03 section 1). */
const DEFAULT_BACKEND_PORT = '8091'
const PORT_LINE = /^[ \t]*PORT[ \t]*=[ \t]*["']?(\d{2,5})["']?[ \t]*$/m

/** The PORT line's value in an env file's text, or undefined; no other line is looked at. */
export const portOf = (text: string): string | undefined => PORT_LINE.exec(text)?.[1]

/** The port the backend's env file sets, or undefined. Only the PORT line is taken; no other value of the file is kept,
 *  used or printed (it holds secrets). A missing file is undefined. */
function backendPort(file: string): string | undefined {
  try {
    return portOf(readFileSync(fileURLToPath(new URL(`../backend/${file}`, import.meta.url)), 'utf8'))
  } catch {
    return undefined
  }
}

/* The admin is served by the admin backend at /admin/ (docs/26 section 4.1), so every built address is under that
 * base. In development Vite answers on 5172 (docs/26 D9) and forwards the backend's routes, which keeps the page
 * same-origin: no CORS. The backend is ADMIN_BACKEND_URL when set; else the port of the backend's own `.env` (the
 * owner's runs on the PORT there), then of its `dev.env`, then 8091. */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'ADMIN_')
  const port = backendPort('.env') ?? backendPort('dev.env') ?? DEFAULT_BACKEND_PORT
  const backend = env.ADMIN_BACKEND_URL || `http://127.0.0.1:${port}`
  const forward = { target: backend, changeOrigin: true }
  /* The backend's routes the page reaches: the API, the live streams and logos the Preview plays, its test page, and
     the root health read. */
  const proxy = { '/api': forward, '/live': forward, '/logos': forward, '/test': forward, '/healthz': forward }

  return {
    base: '/admin/',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        /* The family UI library and the request layer are consumed as source (docs/27 section 3), never built. */
        '@giga/ui': fileURLToPath(new URL('../shared/ui/src', import.meta.url)),
        '@giga/http': fileURLToPath(new URL('../shared/http/src', import.meta.url)),
      },
      /* One copy of each runtime package, whichever folder a file sits in: the library's imports resolve to this app's. */
      dedupe: ['react', 'react-dom', 'framer-motion', 'zustand', 'lucide-react', 'zod', 'allotment', '@tanstack/react-table', '@tanstack/react-virtual'],
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
    server: {
      host: '127.0.0.1',
      port: 5172,
      strictPort: true,
      /* The repository root has no workspaces, so Vite would answer 403 for ../shared (docs/27 section 3). */
      fs: { allow: [fileURLToPath(new URL('../..', import.meta.url))] },
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
      proxy,
    },
    preview: {
      host: '127.0.0.1',
      port: 5272,
      strictPort: true,
      proxy,
    },
  }
})
