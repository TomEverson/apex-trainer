import { defineConfig, type Plugin } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import tsConfigPaths from 'vite-tsconfig-paths'

// `import { env } from 'cloudflare:workers'` is a Workers-runtime virtual
// module — it doesn't exist in the browser. This stub intercepts it in the
// client environment so Vite's import-analysis doesn't throw when a client
// component is in the same import graph as a server file that imports env.ts.
function stubCloudflareWorkersForClient(): Plugin {
  const STUB = 'export const env = new Proxy({}, { get() { throw new Error("cloudflare:workers is server-only") } })'
  return {
    name: 'stub-cloudflare-workers-for-client',
    enforce: 'pre',
    transform(code) {
      if (this.environment?.name === 'ssr') return null
      if (!code.includes('cloudflare:workers')) return null
      return { code: code.replace(/from\s+['"]cloudflare:workers['"]/g, 'from "/__cloudflare_workers_stub__.js"'), map: null }
    },
    resolveId(id) {
      if (this.environment?.name === 'ssr') return null
      if (id === '/__cloudflare_workers_stub__.js') return '\0/__cloudflare_workers_stub__.js'
      return null
    },
    load(id) {
      if (this.environment?.name === 'ssr') return null
      if (id === '\0/__cloudflare_workers_stub__.js') return STUB
      return null
    },
  }
}

export default defineConfig({
  plugins: [
    stubCloudflareWorkersForClient(),
    tsConfigPaths({ projects: ['./tsconfig.json'] }),
    tailwindcss(),
    tanstackStart({
      srcDirectory: 'src',
      start: { entry: './start.tsx' },
      server: { entry: './server.ts' },
    }),
    react(),
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
  ],
  build: {
    rollupOptions: {
      external: ['cloudflare:workers'],
    },
  },
})
