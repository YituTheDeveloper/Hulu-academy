import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

// @next/env is CommonJS in this Next.js version, so use createRequire to
// reliably access its named API from this ESM config file.
const require = createRequire(import.meta.url)
const { loadEnvConfig } = require('@next/env')

// The monorepo keeps its local secrets in the workspace root, not apps/mini-app.
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
// Next loads env files for apps/mini-app before evaluating this config. Force
// @next/env to reload so it replaces that cached app-directory lookup with the
// workspace-root env files.
loadEnvConfig(workspaceRoot, process.env.NODE_ENV === 'development', console, true)

// Keep the configured public hostname allowed when Next.js is accessed through
// a named Cloudflare Tunnel. Quick Tunnels use a random trycloudflare.com host.
let configuredMiniAppHostname
try {
  configuredMiniAppHostname = new URL(process.env.MINI_APP_URL || '').hostname
} catch {
  configuredMiniAppHostname = undefined
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow development assets to load through Cloudflare Quick and named Tunnels.
  allowedDevOrigins: [
    '*.trycloudflare.com',
    ...(configuredMiniAppHostname ? [configuredMiniAppHostname] : []),
  ],

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ]
  },

  // External packages
  serverExternalPackages: ['@prisma/client', 'prisma', '@prisma/adapter-pg', 'pg'],

  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },

  // Transpile workspace packages
  transpilePackages: ['@hulu/db', '@hulu/validation', '@hulu/shared', '@hulu/telegram'],
}

export default nextConfig
