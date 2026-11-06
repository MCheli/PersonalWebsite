// Shared Playwright helpers for the repo scripts (tour, og-image, resume-pdf).
// Playwright is a frontend devDependency; the scripts resolve it from frontend/node_modules.
import { createRequire } from 'node:module'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export const here = path.dirname(fileURLToPath(import.meta.url))
export const repoRoot = path.resolve(here, '..', '..')
export const frontendDir = path.join(repoRoot, 'frontend')
export const contentDir = path.join(repoRoot, 'content')

const require = createRequire(path.join(frontendDir, 'package.json'))
export const { chromium, devices } = require('playwright')

/**
 * Chrome to use, in order: $PLAYWRIGHT_CHROME, /usr/bin/google-chrome if present,
 * else Playwright's bundled Chromium (`npx playwright install chromium` in frontend/).
 * CI installs the bundled one; sandboxes without network use the system Chrome.
 */
export function chromeExecutable() {
  const fromEnv = process.env.PLAYWRIGHT_CHROME
  if (fromEnv) return fromEnv
  const system = '/usr/bin/google-chrome'
  if (fs.existsSync(system)) return system
  return undefined
}

export async function launchBrowser(extra = {}) {
  const executablePath = chromeExecutable()
  const opts = { headless: true, ...extra }
  if (executablePath) opts.executablePath = executablePath
  try {
    return await chromium.launch(opts)
  } catch (err) {
    if (executablePath) {
      console.warn(`browser: ${executablePath} failed (${String(err).split('\n')[0]}); trying bundled chromium`)
      return chromium.launch({ headless: true, ...extra })
    }
    throw err
  }
}

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

export async function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.unref()
    srv.on('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
  })
}

/**
 * Start the built Nuxt server (frontend/.output/server/index.mjs) on a free port.
 * Returns { baseUrl, stop }. Throws when the build is missing or the server does not
 * answer within 20s.
 */
export async function startBuiltServer() {
  const entry = path.join(frontendDir, '.output', 'server', 'index.mjs')
  if (!fs.existsSync(entry)) {
    throw new Error(`${path.relative(repoRoot, entry)} missing; run \`make build\` first`)
  }
  const port = await freePort()
  const child = spawn(process.execPath, [entry], {
    cwd: frontendDir,
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', NODE_ENV: 'production', NITRO_PORT: String(port), NITRO_HOST: '127.0.0.1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
  })
  let log = ''
  child.stdout.on('data', (d) => { log += d })
  child.stderr.on('data', (d) => { log += d })
  const stop = () => {
    try {
      if (process.platform !== 'win32') process.kill(-child.pid, 'SIGTERM')
      else child.kill()
    } catch { /* already gone */ }
  }
  const baseUrl = `http://127.0.0.1:${port}`
  const deadline = Date.now() + 20000
  while (Date.now() < deadline) {
    try {
      const r = await fetch(baseUrl + '/')
      if (r.ok) return { baseUrl, stop, log: () => log }
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250))
  }
  stop()
  throw new Error(`built server did not answer on ${baseUrl}\n${log.slice(-2000)}`)
}

/** Use TOUR_BASE_URL / the given env var when set, else start the built server. */
export async function resolveBase(envVar = 'TOUR_BASE_URL') {
  const external = process.env[envVar]
  if (external) return { baseUrl: external.replace(/\/$/, ''), stop: () => {}, log: () => '' }
  return startBuiltServer()
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
