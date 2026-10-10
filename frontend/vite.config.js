import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// The app calls the API and user uploads with relative URLs (/api, /uploads)
// so that production can serve everything from one origin through nginx. In
// development nothing serves those paths, so they are proxied to the backend.
const backend = process.env.VITE_BACKEND_ORIGIN || 'http://localhost:5000'

export default defineConfig({
  plugins: [
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/api': { target: backend, changeOrigin: true },
      '/uploads': { target: backend, changeOrigin: true },
    },
  },
})
