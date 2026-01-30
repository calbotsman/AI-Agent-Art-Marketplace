import { defineConfig } from 'vite'

// Proxy the Clawdbot Gateway so Cal Portal can call it without CORS issues.
// This keeps requests same-origin (http://127.0.0.1:517x) and forwards to http://127.0.0.1:18789
export default defineConfig(() => {
  // Simple build stamp so the UI can always show "yes, you’re on the updated build".
  // We keep it deterministic + local-first (no network calls).
  const git = process.env.GIT_COMMIT || 'dev'
  const builtAt = process.env.BUILD_AT || new Date().toISOString()

  return {
    define: {
      __CAL_PORTAL_BUILD__: JSON.stringify({ git, builtAt }),
    },
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
  }
})
