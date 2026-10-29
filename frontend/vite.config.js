import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const backend = process.env.VITE_BACKEND_ORIGIN || 'http://127.0.0.1:5000'

const backendProxy = () => ({
  target: backend,
  changeOrigin: true,
  configure(proxy) {
    proxy.on('error', (_error, _request, response) => {
      if (!response.writeHead || response.headersSent || response.writableEnded) return
      response.writeHead(503, { 'Content-Type': 'application/json', 'Retry-After': '2' })
      response.end(JSON.stringify({ code: 'BACKEND_UNAVAILABLE', message: 'TrackED server is temporarily unavailable. Please try again shortly.' }))
    })
  },
})

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    // Reports load lazily. Pre-bundle their React wrapper with the renderer so
    // discovering charts later cannot introduce a second optimized React runtime.
    include: [
      'react', 'react-dom', 'react-dom/client',
      'react/jsx-runtime', 'react/jsx-dev-runtime',
      'chart.js', 'react-chartjs-2',
    ],
  },
  server: {
    host: true,        // listen on all network interfaces
    port: 5173,
    proxy: {
      '/api': backendProxy(),
      '/uploads': backendProxy(),
    },
  },
})