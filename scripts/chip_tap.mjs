#!/usr/bin/env node
/**
 * Chip-tap check: tap the `services` chip on / at phone width and capture the
 * viewport at 100 ms, 300 ms and 1200 ms after the tap, so the evidence shows
 * the command typing itself into the prompt and the output landing with the
 * echoed command line at the top of the screen (ledger SHOW-008).
 *
 *   make chip-tap                                   # after `make build`
 *   TOUR_BASE_URL=http://localhost:3000 node scripts/chip_tap.mjs
 *   node scripts/chip_tap.mjs --chip about --out artifacts/tmp/chip-tap
 *
 * Writes <out>/{t100,t300,t1200}.png and <out>/chip-tap-log.json (input value and
 * scroll position at each tick). Exits 1 when the typing was never visible, the
 * input was not empty at the end, or the echoed command is not at the top.
 */
import fs from 'node:fs'
import path from 'node:path'
import { devices, launchBrowser, repoRoot, resolveBase, sleep } from './lib/browser.mjs'

const args = process.argv.slice(2)
const argAfter = (flag, fallback) => {
  const i = args.indexOf(flag)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}
const CHIP = argAfter('--chip', 'services')
const OUT = path.resolve(repoRoot, argAfter('--out', 'artifacts/screens/chip-tap'))
const TICKS = [100, 300, 1200]

const { baseUrl, stop } = await resolveBase()
let browser
let exitCode = 0
const log = { chip: CHIP, base: baseUrl, ticks: {} }
try {
  browser = await launchBrowser()
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    userAgent: devices['iPhone 13'].userAgent,
    colorScheme: 'dark',
  })
  const page = await ctx.newPage()
  const resp = await page.goto(baseUrl + '/', { waitUntil: 'domcontentloaded', timeout: 30000 })
  if (!resp || resp.status() >= 400) throw new Error(`/ returned ${resp?.status()}`)
  await page.waitForSelector('[data-tour-ready]', { timeout: 10000, state: 'attached' })

  // CHIP comes from the command line: escape it so it matches literally, never as a pattern.
  const chipText = CHIP.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const chip = page.locator(`.command-bar .chip`, { hasText: new RegExp(`^${chipText}$`) })
  if ((await chip.count()) !== 1) throw new Error(`no chip called "${CHIP}"`)
  fs.mkdirSync(OUT, { recursive: true })

  const t0 = Date.now()
  await chip.tap({ noWaitAfter: true })
  for (const tick of TICKS) {
    const wait = t0 + tick - Date.now()
    if (wait > 0) await sleep(wait)
    const state = await page.evaluate(() => {
      const input = document.querySelector('.terminal-input')
      const lines = document.querySelectorAll('.entry-command')
      const last = lines[lines.length - 1]
      const chips = [...document.querySelectorAll('.command-bar .chip')]
      return {
        input: input ? input.value : null,
        busyChips: chips.filter((c) => c.disabled).length,
        entries: lines.length,
        lastCommandTop: last ? Math.round(last.getBoundingClientRect().top) : null,
        scrollY: Math.round(window.scrollY),
      }
    })
    state.at = Date.now() - t0
    log.ticks[`t${tick}`] = state
    const file = path.join(OUT, `t${tick}.png`)
    await page.screenshot({ path: file, fullPage: false })
    state.file = path.relative(repoRoot, file)
    console.log(`chip-tap t${tick} (${state.at} ms): input="${state.input}" entries=${state.entries} busyChips=${state.busyChips} lastCommandTop=${state.lastCommandTop} scrollY=${state.scrollY}`)
  }
  await page.close()
  await ctx.close()

  const first = log.ticks.t100
  const last = log.ticks.t1200
  const problems = []
  if (!first || !first.input || !CHIP.startsWith(first.input)) problems.push('typing not visible at 100 ms')
  if (!last || last.input !== '') problems.push('input not empty at 1200 ms')
  if (!last || last.entries < 1) problems.push('no echoed command at 1200 ms')
  if (!last || last.lastCommandTop === null || last.lastCommandTop < 0 || last.lastCommandTop > 120) {
    problems.push(`echoed command not at the top of the viewport (top=${last?.lastCommandTop})`)
  }
  log.problems = problems
  if (problems.length) {
    exitCode = 1
    for (const p of problems) console.error(`chip-tap: ${p}`)
  }
} catch (e) {
  console.error(`chip-tap: ${String(e).split('\n')[0]}`)
  exitCode = 1
} finally {
  if (browser) await browser.close().catch(() => {})
  stop()
}
fs.mkdirSync(OUT, { recursive: true })
fs.writeFileSync(path.join(OUT, 'chip-tap-log.json'), JSON.stringify(log, null, 2))
process.exit(exitCode)
