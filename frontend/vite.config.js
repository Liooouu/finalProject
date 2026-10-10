import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

const backend = process.env.VITE_BACKEND_ORIGIN || 'http://localhost:5000'

export default defineConfig({
  plugins: [
    tailwindcss(),
  ],
  server: {
    host: true,        // listen on all network interfaces
    port: 5173,
    proxy: {
      '/api': { target: backend, changeOrigin: true },
      '/uploads': { target: backend, changeOrigin: true },
    },
  },
})