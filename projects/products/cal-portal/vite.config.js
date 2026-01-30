import { defineConfig } from 'vite'

// Proxy the Clawdbot Gateway so Cal Portal can call it without CORS issues.
// This keeps requests same-origin (http://127.0.0.1:517x) and forwards to http://127.0.0.1:18789
export default defineConfig({
  server: {
    // Stable fixed port for Cal Portal.
    // strictPort=true makes Vite fail if 5174 is already in use (instead of auto-choosing another port).
    port: 5174,
    strictPort: true,
    proxy: {
      '/v1': {
        target: 'http://127.0.0.1:18789',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
