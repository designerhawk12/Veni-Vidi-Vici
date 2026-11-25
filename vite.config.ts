import { defineConfig, loadEnv, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, '.', '')
  const guardianApiEnabled =
    command === 'serve' && mode === 'development' && env.GUARDIAN_API_ENABLED !== 'false'
  const proxy: Record<string, ProxyOptions> = guardianApiEnabled
    ? {
      '/api': {
        target: env.GUARDIAN_API_TARGET || 'http://127.0.0.1:8000',
        changeOrigin: true,
        configure: (proxyServer) => {
          proxyServer.on('proxyReq', (proxyRequest) => {
            const path = proxyRequest.path.split('?', 1)[0]
            const requestedRole = proxyRequest.getHeader('x-guardian-role')
            proxyRequest.removeHeader('x-guardian-role')
            const isVendorCall = path === '/api/evidence/replies'
            const isAgentCall =
              path === '/api/actions' ||
              /^\/api\/actions\/[0-9a-f-]+\/(claim|revisions)$/.test(path)
            const token = isVendorCall
              ? env.VENDOR_TOKEN
              : isAgentCall
                ? (requestedRole === 'catering' ? env.CATERING_TOKEN : env.INVITATIONS_TOKEN)
                : env.OWNER_TOKEN
            if (token) proxyRequest.setHeader('Authorization', `Bearer ${token}`)
          })
        },
      },
    }
    : {}

  return {
    plugins: [react(), tailwindcss()],
    define: {
      __GUARDIAN_API_ENABLED__: JSON.stringify(guardianApiEnabled),
    },
    server: {
      host: '127.0.0.1',
      proxy,
    },
  }
})
