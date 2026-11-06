#!/usr/bin/env node
/**
 * Print /resume to frontend/public/Mark-Cheli-Resume.pdf with Playwright (print media,
 * Letter, 0.5in margins) and write the sidecar Mark-Cheli-Resume.pdf.json:
 *   { "generatedFrom": <resume.json meta.lastModified>, "generatedAt": <ISO timestamp> }
 * scripts/check_resume_pdf.py (make check-resume-pdf, CI) fails when resume.json is newer
 * than generatedFrom. Commit the PDF and the sidecar together.
 *
 *   make resume-pdf                                # after `make build`
 *   TOUR_BASE_URL=http://localhost:3000 node scripts/resume_pdf.mjs   # against a running server
 *   node scripts/resume_pdf.mjs --format A4
 *
 * Fails clearly when /resume does not exist (404) so a PDF of the wrong page is never written.
 */
import fs from 'node:fs'
import path from 'node:path'
import { contentDir, frontendDir, launchBrowser, readJson, repoRoot, resolveBase, sleep } from './lib/browser.mjs'

const args = process.argv.slice(2)
const fmtIdx = args.indexOf('--format')
const FORMAT = fmtIdx >= 0 ? args[fmtIdx + 1] : 'Letter'
const OUT = path.join(frontendDir, 'public', 'Mark-Cheli-Resume.pdf')
const SIDECAR = OUT + '.json'

const resume = readJson(path.join(contentDir, 'resume.json'))
const lastModified = resume.meta?.lastModified
if (!lastModified) {
  console.error('resume-pdf: content/resume.json has no meta.lastModified')
  process.exit(2)
}

const { baseUrl, stop } = await resolveBase()
let browser
let exitCode = 0
try {
  browser = await launchBrowser()
  const page = await browser.newPage({ viewport: { width: 1000, height: 1400 } })
  const resp = await page.goto(`${baseUrl}/resume`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  const status = resp?.status()
  if (status !== 200) {
    throw new Error(`/resume returned ${status}; the resume page is not built (no PDF written)`)
  }
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await page.waitForSelector('[data-tour-ready], main, h1', { timeout: 8000 }).catch(() => {})
  // The page must actually be the resume, not the terminal's catch-all route.
  const looksLikeResume = await page.evaluate((name) => {
    // innerText: rendered text only, so hidden SSR blocks do not count
    // eslint-disable-next-line unicorn/prefer-dom-node-text-content
    const text = document.body.innerText || ''
    return text.includes(name) && /experience|work|education/i.test(text) && !document.querySelector('input[type="text"]')
  }, resume.basics.name)
  if (!looksLikeResume) {
    throw new Error('/resume did not render a resume page (expected the name plus Work/Education sections and no terminal input); no PDF written')
  }
  await page.emulateMedia({ media: 'print' })
  await page.evaluate(() => document.fonts?.ready)
  await sleep(300)
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  await page.pdf({
    path: OUT,
    format: FORMAT,
    printBackground: true,
    preferCSSPageSize: false,
    margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' },
    displayHeaderFooter: false,
  })
  fs.writeFileSync(SIDECAR, JSON.stringify({ generatedFrom: lastModified, generatedAt: new Date().toISOString() }, null, 2) + '\n')
  const size = fs.statSync(OUT).size
  console.log(`resume-pdf: wrote ${path.relative(repoRoot, OUT)} (${FORMAT}, ${(size / 1024).toFixed(0)} kB) from resume.json ${lastModified}; sidecar ${path.basename(SIDECAR)}`)
} catch (e) {
  console.error(`resume-pdf: ${String(e).split('\n')[0]}`)
  exitCode = 1
} finally {
  if (browser) await browser.close().catch(() => {})
  stop()
}
process.exit(exitCode)
