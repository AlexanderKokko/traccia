import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import path from 'path'

/**
 * Builds the whole app into ONE index.html that runs by double-clicking it —
 * no server, no install. Used to hand the app to someone who has no tooling.
 *
 * Code splitting is turned off because there is nothing to split into: every
 * route has to be inlined for the file to work offline.
 */
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  define: { __SINGLE_FILE__: 'true' },
  resolve: {
    alias: { '@': path.resolve(process.cwd(), './src') },
  },
  build: {
    outDir: 'dist-singlefile',
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
})
