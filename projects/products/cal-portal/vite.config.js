import { defineConfig } from 'vite'

// Proxy the Clawdbot Gateway so Cal Portal can call it without CORS issues.
// This keeps requests same-origin (http://127.0.0.1:517x) and forwards to http://127.0.0.1:18789
export default defineConfig({
  server: {
    proxy: {
      '/v1': {
        target: 'http://127.0.0.1:18789',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
