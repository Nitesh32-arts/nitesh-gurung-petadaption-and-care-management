import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Reduce noisy ECONNABORTED / ECONNRESET when client or backend closes connection during proxy
function proxyWithQuietClose(proxy) {
  proxy.on('error', (err, _req, _res) => {
    const code = err?.code || ''
    if (code === 'ECONNABORTED' || code === 'ECONNRESET' || code === 'EPIPE') {
      // Normal when tab closes, refresh, or backend restarts
      return
    }
    console.error('[vite proxy]', err.message)
  })
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        configure: proxyWithQuietClose,
      },
      '/media': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        configure: proxyWithQuietClose,
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
        configure: proxyWithQuietClose,
      },
    },
  },
})
