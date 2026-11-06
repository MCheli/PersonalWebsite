#!/usr/bin/env node
/**
 * Render the Open Graph / Twitter card image (1200x630 PNG) to frontend/public/og.png.
 *
 *   make og-image      (node scripts/og_image.mjs [--out path])
 *
 * Everything on the card comes from content/: name, title, company and location from
 * resume.json (basics + current role) and services.json host; the host
 * name from services.json for the prompt line. If basics.image is set (e.g.
 * /headshot.jpg, PRODUCT.md decision D2) the file under frontend/public is placed as a
 * circle on the right. Commit the PNG; nuxt.config points og:image at /og.png.
 */
import fs from 'node:fs'
import path from 'node:path'
import { contentDir, frontendDir, launchBrowser, readJson, repoRoot } from './lib/browser.mjs'

const args = process.argv.slice(2)
const outIdx = args.indexOf('--out')
const OUT = path.resolve(repoRoot, outIdx >= 0 ? args[outIdx + 1] : path.join(frontendDir, 'public', 'og.png'))

const resume = readJson(path.join(contentDir, 'resume.json'))
const catalog = readJson(path.join(contentDir, 'services.json'))
const basics = resume.basics

const name = basics.name
const current = (resume.work && resume.work[0]) || {}
const title = current.position || basics.label
const company = current.name || ''
const location = [basics.location?.city, basics.location?.region].filter(Boolean).join(', ')
const host = catalog.host?.name || '83rr-poweredge'
const site = (basics.url || 'https://www.markcheli.com').replace(/^https?:\/\//, '')

let imageDataUrl = null
if (basics.image) {
  const file = path.join(frontendDir, 'public', basics.image.replace(/^\//, ''))
  if (fs.existsSync(file)) {
    const ext = path.extname(file).slice(1).toLowerCase()
    const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`
    imageDataUrl = `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`
  } else {
    console.warn(`og-image: basics.image ${basics.image} not found under frontend/public; rendering without it`)
  }
}

// Prefer the site's own JetBrains Mono (installed by the frontend as @fontsource/jetbrains-mono)
// over the system monospace fallback.
function fontFaces() {
  const dir = path.join(frontendDir, 'node_modules', '@fontsource', 'jetbrains-mono', 'files')
  const faces = []
  for (const [weight, file] of [[400, 'jetbrains-mono-latin-400-normal.woff2'], [700, 'jetbrains-mono-latin-700-normal.woff2']]) {
    const f = path.join(dir, file)
    if (!fs.existsSync(f)) continue
    const data = fs.readFileSync(f).toString('base64')
    faces.push(`@font-face { font-family: "JetBrains Mono"; font-weight: ${weight}; src: url(data:font/woff2;base64,${data}) format("woff2"); }`)
  }
  return faces.join('\n')
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

const html = `<!doctype html>
<html><head><meta charset="utf-8">
<style>
  ${fontFaces()}
  html, body { margin: 0; padding: 0; }
  body {
    width: 1200px; height: 630px; background: #0a0a0a; color: #e6e6e6;
    font-family: "JetBrains Mono", "Fira Mono", "DejaVu Sans Mono", ui-monospace, Menlo, Consolas, monospace;
    display: flex; flex-direction: column; justify-content: center; box-sizing: border-box;
    padding: 72px 80px; position: relative; overflow: hidden;
  }
  .prompt { color: #4ade80; font-size: 28px; margin-bottom: 36px; }
  .prompt .cmd { color: #e6e6e6; }
  .name { font-size: 84px; font-weight: 700; line-height: 1.05; color: #ffffff; letter-spacing: -1px; }
  .title { font-size: 34px; margin-top: 26px; color: #e6e6e6; line-height: 1.3; }
  .company { color: #4ade80; font-size: 30px; margin-top: 10px; }
  .meta { font-size: 26px; margin-top: 22px; color: #9ca3af; }
  .site { position: absolute; left: 80px; bottom: 56px; font-size: 24px; color: #60a5fa; }
  .text { max-width: ${imageDataUrl ? '720px' : '1040px'}; }
  .photo {
    position: absolute; right: 80px; top: 50%; transform: translateY(-50%);
    width: 300px; height: 300px; border-radius: 50%; object-fit: cover;
    border: 4px solid #4ade80; box-shadow: 0 0 0 10px rgba(74, 222, 128, 0.12);
  }
  .rule { position: absolute; left: 0; right: 0; top: 0; height: 6px; background: linear-gradient(90deg, #4ade80, #60a5fa); }
</style></head>
<body>
  <div class="rule"></div>
  <div class="text">
    <div class="prompt">user@${esc(host)}:~$ <span class="cmd">whoami</span></div>
    <div class="name">${esc(name)}</div>
    <div class="title">${esc(title)}</div>
    ${company ? `<div class="company">${esc(company)}</div>` : ''}
    <div class="meta">${esc(location)}</div>
  </div>
  ${imageDataUrl ? `<img class="photo" src="${imageDataUrl}" alt="">` : ''}
  <div class="site">${esc(site)}</div>
</body></html>`

const browser = await launchBrowser()
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
  await page.setContent(html, { waitUntil: 'load' })
  await page.evaluate(() => document.fonts?.ready)
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  await page.screenshot({ path: OUT, type: 'png', clip: { x: 0, y: 0, width: 1200, height: 630 } })
  console.log(`og-image: wrote ${path.relative(repoRoot, OUT)} (${name} — ${title}${company ? ' · ' + company : ''}, ${location}${imageDataUrl ? ', with photo' : ''})`)
} finally {
  await browser.close()
}
