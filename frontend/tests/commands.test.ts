import { describe, expect, it } from 'vitest'
import { blockHrefs, blocksText } from '~/commands/blocks'
import { execute } from '~/commands/execute'
import { commands } from '~/commands/registry'
import type { OutputBlock } from '~/types/terminal'
import { content, publicServices } from '~/utils/content'
import { cloneContent, makeContext } from './helpers'

const run = (line: string, ctx = makeContext()): Promise<OutputBlock[]> => execute(line, ctx)
const runText = async (line: string, ctx = makeContext()): Promise<string> => blocksText(await run(line, ctx))

describe('help', () => {
  it('lists every registry command with its description', async () => {
    const text = await runText('help')
    for (const c of commands) {
      expect(text).toContain(c.name)
      expect(text).toContain(c.description)
    }
  })

  it('shows aliases next to the command', async () => {
    expect(await runText('help')).toContain('homelab, services')
    expect(await runText('?')).toContain('help, ?')
  })

  it('help <cmd> gives usage and the long description', async () => {
    const text = await runText('help projects')
    expect(text).toContain('projects [all | <slug>]')
    expect(text).toContain('projects <slug>')
  })

  it('help <alias> resolves the alias', async () => {
    expect(await runText('help services')).toContain('homelab —')
  })

  it('help <unknown> says so', async () => {
    expect(await runText('help bogus')).toContain('no command called "bogus"')
  })
})

describe('about', () => {
  it('is built from resume.json basics', async () => {
    const text = await runText('about')
    expect(text).toContain(content.resume.basics.name)
    expect(text).toContain(content.resume.basics.label)
    expect(text).toContain(content.resume.basics.summary)
    expect(text).toContain('Ashland, MA')
  })

  it('about reflects a changed summary', async () => {
    const c = cloneContent()
    c.resume.basics.summary = 'A one-line summary used by a test.'
    const text = await runText('about', makeContext({ content: c }))
    expect(text).toContain('A one-line summary used by a test.')
  })
})

describe('resume', () => {
  it('prints headline, current role with highlights, previous roles, education and skills', async () => {
    const text = await runText('resume')
    const current = content.resume.work[0]!
    expect(text).toContain(content.resume.basics.label)
    expect(text).toContain(current.position)
    for (const h of current.highlights) expect(text).toContain(h)
    for (const w of content.resume.work.slice(1)) {
      expect(text).toContain(w.position)
      expect(text).toContain(w.name)
    }
    for (const e of content.resume.education) expect(text).toContain(e.institution)
    for (const s of content.resume.skills) {
      expect(text).toContain(s.name)
      for (const k of s.keywords) expect(text).toContain(k)
    }
  })

  it('formats date ranges from YYYY-MM', async () => {
    const text = await runText('resume')
    expect(text).toContain('Jan 2022 – present')
    expect(text).toContain('Feb 2021 – Jan 2022')
  })

  it('ends with links to /resume and the PDF', async () => {
    const hrefs = blockHrefs(await run('resume'))
    expect(hrefs).toContain('/resume')
    expect(hrefs).toContain('/Mark-Cheli-Resume.pdf')
  })

  it('resume reflects changed highlights and keywords', async () => {
    const c = cloneContent()
    c.resume.work[0]!.highlights = ['Highlight injected by a test']
    c.resume.skills[0]!.keywords.push('Test-only keyword')
    const text = await runText('resume', makeContext({ content: c }))
    expect(text).toContain('Highlight injected by a test')
    expect(text).toContain('Test-only keyword')
  })
})

describe('projects', () => {
  it('lists featured projects first with name, tagline, stack and links', async () => {
    const out = await run('projects')
    const text = blocksText(out)
    const featured = content.projects.projects.filter(p => p.featured)
    const notFeatured = content.projects.projects.filter(p => !p.featured)
    for (const p of featured) {
      expect(text).toContain(p.name)
      expect(text).toContain(p.tagline)
      expect(text).toContain(p.stack[0]!)
      if (p.repo !== undefined) expect(blockHrefs(out)).toContain(p.repo)
    }
    for (const p of notFeatured) expect(text).not.toContain(p.tagline)
  })

  it('projects all lists every project', async () => {
    const text = await runText('projects all')
    for (const p of content.projects.projects) expect(text).toContain(p.name)
  })

  it('projects <slug> prints the full description and highlights', async () => {
    const p = content.projects.projects.find(x => x.slug === 'tallied')!
    const text = await runText('projects tallied')
    expect(text).toContain(p.description)
    for (const h of p.highlights) expect(text).toContain(h)
    expect(text).toContain('since Mar 2026')
  })

  it('projects <bad> lists the valid slugs', async () => {
    const text = await runText('projects nope')
    expect(text).toContain('no project called "nope"')
    for (const p of content.projects.projects) expect(text).toContain(p.slug)
  })

  it('projects reflects an added fixture project', async () => {
    const c = cloneContent()
    c.projects.projects.push({
      slug: 'fixture',
      name: 'Fixture Project',
      tagline: 'Only in tests',
      description: 'Desc',
      highlights: [],
      stack: ['Vitest'],
      status: 'done',
      started: '2026',
      featured: true
    })
    const text = await runText('projects', makeContext({ content: c }))
    expect(text).toContain('Fixture Project')
    expect(text).toContain('Only in tests')
  })
})

describe('homelab', () => {
  it('renders every category and service with counts from the data', async () => {
    const text = await runText('homelab')
    for (const cat of content.catalog.categories) {
      expect(text).toContain(cat.title)
      expect(text).toContain(`${cat.services.length} ${cat.id}`)
      for (const s of cat.services) expect(text).toContain(s.name)
    }
    const total = content.catalog.categories.reduce((n, c) => n + c.services.length, 0)
    expect(text).toContain(`${total} services`)
    expect(text).toContain(`(${total} total)`)
  })

  it('services is an alias', async () => {
    expect(await runText('services')).toBe(await runText('homelab'))
  })

  it('links service urls and repos', async () => {
    const hrefs = blockHrefs(await run('homelab'))
    expect(hrefs).toContain('https://videos.markcheli.com')
    expect(hrefs).toContain('https://github.com/MCheli/tallied')
  })

  it('reflects a changed fixture (count goes up)', async () => {
    const c = cloneContent()
    c.catalog.categories[0]!.services.push({ name: 'fixture-svc', description: 'Only in tests' })
    const text = await runText('homelab', makeContext({ content: c }))
    expect(text).toContain('fixture-svc')
    expect(text).toContain(`${c.catalog.categories[0]!.services.length} custom`)
  })
})

describe('now', () => {
  it('prints the items and the updated date', async () => {
    const text = await runText('now')
    for (const item of content.now.items) expect(text).toContain(item)
    expect(text).toContain(`Updated ${content.now.updated}`)
  })

  it('reflects a changed fixture and prints nothing but items and the date', async () => {
    const c = cloneContent()
    c.now.items = ['Only item, from a test']
    c.now.updated = '2030-01-01'
    const out = await run('now', makeContext({ content: c }))
    expect(blocksText(out)).toContain('Only item, from a test')
    expect(blocksText(out)).toContain('Updated 2030-01-01')
    expect(out.map(b => b.kind)).toEqual(['heading', 'list', 'blank', 'text'])
  })
})

describe('contact', () => {
  it('prints email as mailto, the profiles and the public services from content', async () => {
    const out = await run('contact')
    const hrefs = blockHrefs(out)
    expect(hrefs).toContain(`mailto:${content.resume.basics.email}`)
    for (const p of content.resume.basics.profiles) expect(hrefs).toContain(p.url)
    for (const s of publicServices(content.catalog)) expect(blocksText(out)).toContain(s.name)
  })

  it('does not list LAN-only services', async () => {
    const text = await runText('contact')
    expect(text).not.toContain('grafana')
    expect(text).not.toContain('daily-report')
  })

  it('contact reflects a changed email', async () => {
    const c = cloneContent()
    c.resume.basics.email = 'test@example.com'
    expect(blockHrefs(await run('contact', makeContext({ content: c })))).toContain('mailto:test@example.com')
  })
})

describe('open', () => {
  it('open <shortcut> opens linkedin, github and the pdf', async () => {
    for (const [name, url] of [
      ['linkedin', 'https://www.linkedin.com/in/mark-cheli-0354a163/'],
      ['github', 'https://github.com/MCheli'],
      ['resume-pdf', '/Mark-Cheli-Resume.pdf']
    ] as const) {
      const ctx = makeContext()
      await run(`open ${name}`, ctx)
      expect(ctx.open).toHaveBeenCalledWith(url)
    }
  })

  it('open <project> prefers url, then demo, then repo', async () => {
    const ctx = makeContext()
    await run('open lidar-grade-explorer', ctx)
    expect(ctx.open).toHaveBeenCalledWith('https://github.com/MCheli/lidar-grade-explorer')
  })

  it('open with no args lists what can be opened, grouped', async () => {
    const text = await runText('open')
    expect(text).toContain('Shortcuts')
    expect(text).toContain('linkedin')
    expect(text).toContain('tallied')
    expect(text).toContain('plex')
  })

  it('open <unknown> errors without opening anything', async () => {
    const ctx = makeContext()
    const text = blocksText(await run('open nothing-here', ctx))
    expect(text).toContain('nothing called "nothing-here"')
    expect(ctx.open).not.toHaveBeenCalled()
  })
})

describe('neofetch, whoami, ls, exit, history, clear', () => {
  it('neofetch has the figlet and the host block from services.json', async () => {
    const out = await run('neofetch')
    expect(out[0]).toEqual({ kind: 'figlet' })
    const text = blocksText(out)
    expect(text).toContain(content.catalog.host.hardware)
    expect(text).toContain(content.catalog.host.os)
    expect(text).toContain(content.catalog.host.kernel)
  })

  it('whoami is one line from resume.json', async () => {
    const out = await run('whoami')
    expect(out).toHaveLength(1)
    expect(blocksText(out)).toBe(`${content.resume.basics.name} — ${content.resume.basics.label} · Ashland, MA`)
  })

  it('ls nudges toward the commands, no fake listing', async () => {
    const text = await runText('ls')
    expect(text).toContain('about/')
    expect(text).toContain('projects/')
    expect(text).not.toMatch(/\d+ mark users/)
  })

  it('exit prints a goodbye with the links and opens nothing', async () => {
    const ctx = makeContext()
    const out = await run('exit', ctx)
    expect(blocksText(out)).toContain('Thanks')
    expect(blockHrefs(out)).toContain('https://github.com/MCheli')
    expect(ctx.open).not.toHaveBeenCalled()
  })

  it('history lists the session commands in order', async () => {
    const text = await runText('history', makeContext({ history: ['help', 'about'] }))
    expect(text).toContain('1  help')
    expect(text).toContain('2  about')
    expect(await runText('history')).toContain('Nothing typed yet')
  })

  it('clear asks the terminal to clear and prints nothing', async () => {
    const ctx = makeContext()
    expect(await run('clear', ctx)).toEqual([])
    expect(ctx.clear).toHaveBeenCalledOnce()
  })
})

describe('weather', () => {
  it('renders the API response', async () => {
    const text = await runText('weather')
    expect(text).toContain('Weather in Ashland, MA')
    expect(text).toContain('61°F (feels like 59°F)')
    expect(text).toContain('Overcast Clouds')
    expect(text).toContain('55%')
    expect(text).toContain('7 mph')
  })

  it('prints a one-line error when the fetch fails', async () => {
    const ctx = makeContext({ fetchWeather: () => Promise.reject(new Error('503')) })
    const out = await run('weather', ctx)
    expect(out).toHaveLength(1)
    expect(blocksText(out)).toContain('unavailable')
  })
})
