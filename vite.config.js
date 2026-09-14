import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  define: { __SINGLE_FILE__: 'false' },
  resolve: {
    alias: { '@': path.resolve(process.cwd(), './src') },
  },
  server: { port: 5180 },
})
