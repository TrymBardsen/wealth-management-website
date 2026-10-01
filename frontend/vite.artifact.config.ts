import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Builds the app as a self-contained Claude artifact: no Express API, the
// API's service code and the /data JSON run in the page instead, and
// reports are written through the artifact's `sample` capability.
// `npm run build:artifact` then packs the output into one HTML file.
const here = path.dirname(fileURLToPath(import.meta.url))
const SWAPS: Record<string, string> = {
  [path.resolve(here, '../api/src/dataset.ts')]: path.resolve(here, 'src/artifact/dataset.ts'),
  [path.resolve(here, 'src/api/client.ts')]: path.resolve(here, 'src/artifact/localClient.ts'),
}

function artifactSwaps(): Plugin {
  return {
    name: 'artifact-swaps',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true })
      return resolved && SWAPS[resolved.id] ? SWAPS[resolved.id] : null
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [artifactSwaps(), react()],
  define: { 'import.meta.env.VITE_ARTIFACT': JSON.stringify('true') },
  build: {
    outDir: 'dist-artifact',
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
})
