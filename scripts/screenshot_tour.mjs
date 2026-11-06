#!/usr/bin/env node
/**
 * Screenshot tour: every route and tour command at phone (390x844) and desktop
 * (1440x900) width, full page, into artifacts/screens/<name>/{mobile,desktop}.png.
 *
 *   make tour                                   # builds nothing: run `make build` first
 *   node scripts/screenshot_tour.mjs            # starts frontend/.output/server/index.mjs on a free port
 *   TOUR_BASE_URL=http://localhost:3000 node scripts/screenshot_tour.mjs   # against a running server
 *   node scripts/screenshot_tour.mjs --out artifacts/tmp/screens          # elsewhere (not committed)
 *   node scripts/screenshot_tour.mjs --allow-overflow                     # report overflow, do not fail
 *   node scripts/screenshot_tour.mjs home cmd-about resume                # only these captures
 *
 * Captures (name -> path):
 *   home          /
 *   cmd-<command> /?cmd=<command>   for each command in the registry marked for the tour
 *   resume        /resume
 *   projects      /projects
 *
 * Commands come from frontend/commands/registry.json when it exists (entries with
 * `tour: true`, or every entry when the flag is absent); otherwise the list below.
 *
 * Readiness: waits for an element with [data-tour-ready], else networkidle + 800 ms.
 * A route that answers 404 is skipped with a warning (the page may not exist yet).
 * Horizontal overflow (document.scrollingElement.scrollWidth > innerWidth) is recorded
 * per capture and fails the run (exit 1) unless --allow-overflow. A log of every
 * capture goes to <out>/tour-log.json.
 *
 * Browser: $PLAYWRIGHT_CHROME, else /usr/bin/google-chrome, else Playwright's bundled
 * Chromium (`npx playwright install --with-deps chromium` in frontend/).
 */
import fs from 'node:fs'
import path from 'node:path'
import { devices, frontendDir, launchBrowser, readJson, repoRoot, resolveBase, sleep } from './lib/browser.mjs'

// frontend/commands/registry.json is generated from commands/registry.ts and has the shape
// { tour: [names], deepLink: [names] } (tests/registry.test.ts keeps it in sync). The fallback
// only matters if that file is ever removed.
const FALLBACK_COMMANDS = ['about', 'resume', 'projects', 'services', 'contact', 'now', 'help', 'neofetch']

function tourCommands() {
  const registry = path.join(frontendDir, 'commands', 'registry.json')
  if (!fs.existsSync(registry)) return { commands: FALLBACK_COMMANDS, source: 'fallback list' }
  const raw = readJson(registry)
  const names = Array.isArray(raw?.tour) ? raw.tour.filter((n) => typeof n === 'string') : []
  if (names.length === 0) throw new Error(`${registry}: expected a non-empty "tour" array of command names`)
  return { commands: names, source: path.relative(repoRoot, registry) }
}

const args = process.argv.slice(2)
const allowOverflow = args.includes('--allow-overflow')
const outIdx = args.indexOf('--out')
const OUT = path.resolve(repoRoot, outIdx >= 0 ? args[outIdx + 1] : 'artifacts/screens')
const selected = args.filter((a, i) => !a.startsWith('--') && !(outIdx >= 0 && i === outIdx + 1))

const { commands, source } = tourCommands()
const CAPTURES = [
  ['home', '/'],
  ...commands.map((c) => [`cmd-${c}`, `/?cmd=${encodeURIComponent(c)}`]),
  ['resume', '/resume'],
  ['projects', '/projects'],
].filter(([name]) => selected.length === 0 || selected.includes(name))

if (CAPTURES.length === 0) {
  console.error(`tour: no such capture(s): ${selected.join(', ')}`)
  process.exit(2)
}

const VIEWPORTS = {
  mobile: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    userAgent: devices['iPhone 13'].userAgent,
  },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
}

async function settle(page) {
  // Whichever comes first: the page's own readiness marker, or network idle + 800 ms.
  const ready = page.waitForSelector('[data-tour-ready]', { timeout: 8000, state: 'attached' }).then(() => 'ready').catch(() => 'no-marker')
  const idle = page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {}).then(() => sleep(800)).then(() => 'idle')
  const first = await Promise.race([ready, idle])
  if (first === 'ready') return
  // No marker yet: the old terminal auto-types ?cmd= one character at a time, so give
  // the animation time to finish before measuring and capturing.
  if (!(await page.$('[data-tour-ready]'))) await sleep(1500)
}

const { baseUrl, stop, log: serverLog } = await resolveBase()
console.log(`tour: ${baseUrl}; commands from ${source}: ${commands.join(', ')}`)
const watchdog = setTimeout(() => {
  console.error('tour: timed out after 10 minutes')
  stop()
  process.exit(1)
}, 600000)
watchdog.unref()

const log = {}
const overflowing = []
let failures = 0
let browser
try {
  browser = await launchBrowser()
  for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
    const ctx = await browser.newContext({ ...vp, colorScheme: 'dark' })
    for (const [name, route] of CAPTURES) {
      const key = `${name}/${vpName}`
      const page = await ctx.newPage()
      const entry = { route, consoleErrors: [], failedRequests: [] }
      log[key] = entry
      page.on('console', (m) => { if (m.type() === 'error') entry.consoleErrors.push(m.text().slice(0, 300)) })
      page.on('pageerror', (e) => entry.consoleErrors.push('pageerror: ' + String(e).slice(0, 300)))
      page.on('requestfailed', (r) => entry.failedRequests.push(`${r.method()} ${r.url()} :: ${r.failure()?.errorText}`))
      try {
        const resp = await page.goto(baseUrl + route, { waitUntil: 'domcontentloaded', timeout: 30000 })
        entry.status = resp?.status()
        if (entry.status === 404) {
          entry.skipped = true
          console.warn(`${key}: SKIPPED (${route} returned 404; page not built yet?)`)
          continue
        }
        if (entry.status >= 400) throw new Error(`${route} returned ${entry.status}`)
        await settle(page)
        const metrics = await page.evaluate(() => {
          const se = document.scrollingElement || document.documentElement
          return { scrollWidth: se.scrollWidth, innerWidth: window.innerWidth, scrollHeight: se.scrollHeight }
        })
        Object.assign(entry, metrics)
        entry.overflow = metrics.scrollWidth > metrics.innerWidth
        if (entry.overflow) {
          entry.offenders = await page.evaluate(() => {
            const vw = window.innerWidth
            const out = []
            for (const el of document.querySelectorAll('body *')) {
              const r = el.getBoundingClientRect()
              if (r.right > vw + 1 && r.width > 0) {
                out.push(`${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).trim().split(/\s+/).slice(0, 2).join('.') : ''} right=${Math.round(r.right)}`)
                if (out.length >= 5) break
              }
            }
            return out
          })
          overflowing.push(`${key} (scrollWidth ${metrics.scrollWidth} > innerWidth ${metrics.innerWidth}): ${entry.offenders.join(', ') || 'no element found'}`)
        }
        const file = path.join(OUT, name, `${vpName}.png`)
        fs.mkdirSync(path.dirname(file), { recursive: true })
        await page.screenshot({ path: file, fullPage: true })
        entry.file = path.relative(repoRoot, file)
        console.log(`${key}: ok${entry.overflow ? ' (OVERFLOW)' : ''}${entry.consoleErrors.length ? ` (console errors: ${entry.consoleErrors.length})` : ''}`)
      } catch (e) {
        entry.error = String(e).slice(0, 300)
        failures++
        console.error(`${key}: FAILED ${entry.error}`)
      } finally {
        await page.close()
      }
    }
    await ctx.close()
  }
} catch (e) {
  console.error(`tour: ${String(e).split('\n')[0]}`)
  const tail = serverLog().slice(-1500)
  if (tail.trim()) console.error(tail)
  failures++
} finally {
  if (browser) await browser.close().catch(() => {})
  stop()
}

fs.mkdirSync(OUT, { recursive: true })
fs.writeFileSync(path.join(OUT, 'tour-log.json'), JSON.stringify({ capturedAt: new Date().toISOString(), base: baseUrl, captures: log }, null, 2))

const captured = Object.values(log).filter((e) => e.file).length
const skipped = Object.values(log).filter((e) => e.skipped).length
console.log(`tour: ${captured} captures, ${skipped} skipped, ${failures} failure(s), ${overflowing.length} with horizontal overflow; log at ${path.relative(repoRoot, path.join(OUT, 'tour-log.json'))}`)
if (overflowing.length) {
  console[allowOverflow ? 'warn' : 'error'](`tour: horizontal overflow${allowOverflow ? ' (allowed)' : ''}:`)
  for (const o of overflowing) console[allowOverflow ? 'warn' : 'error'](`  x ${o}`)
}
process.exit(failures || (overflowing.length && !allowOverflow) ? 1 : 0)
