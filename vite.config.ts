import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
    hmr: process.env.DISABLE_HMR === 'true' ? false : undefined,
    ws: process.env.DISABLE_HMR === 'true' ? false : undefined,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
