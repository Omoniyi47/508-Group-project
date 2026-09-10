import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode, command }) => {
  const plugins = [react(), tailwindcss()]

  // Production API forwarding is configured in vercel.json, not Vite's dev server.
  if (command === 'build') return { plugins }

  const env = loadEnv(mode, process.cwd(), '')
  const port = Number(env.VITE_PORT)

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('VITE_PORT must be a positive integer')
  }
  if (!env.VITE_API_PROXY_TARGET) {
    throw new Error('Missing required environment variable: VITE_API_PROXY_TARGET')
  }

  return {
    plugins,
    server: {
      port,
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET,
          changeOrigin: true,
        },
      },
    },
  }
})
