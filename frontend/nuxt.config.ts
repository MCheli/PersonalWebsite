// https://nuxt.com/docs/api/configuration/nuxt-config
//
// Everything about Mark (title, description, JSON-LD) is set per page from
// content/ via useHead; this file holds only what is true of every page.

// Enough of `process` to read NODE_ENV without pulling @types/node into the typecheck.
declare const process: { env: Record<string, string | undefined> }

export default defineNuxtConfig({
  devtools: { enabled: process.env.NODE_ENV !== 'production' },
  typescript: {
    strict: true,
    typeCheck: false
  },
  css: [
    '@fontsource/jetbrains-mono/latin-400.css',
    '@fontsource/jetbrains-mono/latin-500.css',
    '@fontsource/jetbrains-mono/latin-700.css',
    '~/assets/css/terminal.css'
  ],
  vite: {
    build: {
      // Keep the woff2 files as files: inlining them as base64 bloats every HTML response.
      assetsInlineLimit: 0
    }
  },
  routeRules: {
    '/**': {
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Content-Security-Policy': "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
      }
    }
  },
  runtimeConfig: {
    public: {
      // Where `weather` and `message` call the Flask API. Relative by default:
      // the homelab nginx routes www.markcheli.com/api/* to flask-api, so the
      // browser never crosses origins. Override with NUXT_PUBLIC_API_BASE —
      // local dev sets it to http://localhost:5000 (the API listening directly).
      apiBase: '/api'
    }
  }
})
