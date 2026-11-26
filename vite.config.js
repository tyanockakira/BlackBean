import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { localOrderApi } from './server/vite-order-api.js'

function isPublicKey(key) {
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return true
  if (!/^[\w-]+\.[\w-]+\.[\w-]+$/.test(key)) return false
  try {
    return JSON.parse(Buffer.from(key.split('.')[1], 'base64url')).role === 'anon'
  } catch {
    return false
  }
}

function checkSupabaseEnv(env, hosted) {
  const { VITE_SUPABASE_URL: value, VITE_SUPABASE_ANON_KEY: key = '' } = env
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error('Set VITE_SUPABASE_URL to the Supabase project origin.')
  }
  const loopback = url && /^(localhost|127(?:\.\d+){3}|\[::1\])$/.test(url.hostname)
  const validScheme = url?.protocol === 'https:' || (!hosted && loopback && url.protocol === 'http:')
  const publicHost = url && /\.[a-z]{2,}$/i.test(url.hostname) && !/\.(?:local|localhost)$/i.test(url.hostname)
  if (!validScheme || (hosted && !publicHost) || url.username || url.password
    || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Set VITE_SUPABASE_URL to the Supabase project origin. Hosted builds require a public HTTPS origin.')
  }
  if (!isPublicKey(key)) {
    throw new Error('Set VITE_SUPABASE_ANON_KEY to a Supabase publishable or legacy anon key.')
  }
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), ['VITE_', 'TURNSTILE_', 'SUPABASE_SERVER_KEY'])
  const hosted = mode === 'hosted' || process.env.VERCEL === '1'
  if (command === 'build') {
    checkSupabaseEnv(env, hosted)
    if (hosted && (!env.VITE_TURNSTILE_SITE_KEY || /^[123]x0{20}[A-Z]{2}$/.test(env.VITE_TURNSTILE_SITE_KEY)
      || env.VITE_TURNSTILE_SITE_KEY === env.TURNSTILE_SECRET_KEY)) {
      throw new Error('Set VITE_TURNSTILE_SITE_KEY to the production Turnstile site key.')
    }
  }
  return {
    plugins: [react(), !hosted && localOrderApi(env)],
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            // Keep shared SVG icons together instead of fetching a chunk per icon.
            groups: [{ name: 'icons', test: /[\\/]lucide-react[\\/]/ }],
          },
        },
      },
    },
  }
})
