import { describe, expect, it } from 'vitest'
import { deepLinkCommands } from '~/commands/registry'
import { content, siteUrl } from '~/utils/content'
import { homeJsonLd, jobTitle, personJsonLd, resumeJsonLd } from '~/utils/jsonld'
import { OG_IMAGE_PATH, pageHead, siteTitle } from '~/utils/seo'
import { cloneContent } from './helpers'
import robots from '~/public/robots.txt?raw'
import sitemap from '~/public/sitemap.xml?raw'


describe('sitemap.xml and robots.txt', () => {
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]!)
  const base = siteUrl(content.resume)

  it('lists the three pages', () => {
    expect(locs).toContain(`${base}/`)
    expect(locs).toContain(`${base}/resume`)
    expect(locs).toContain(`${base}/projects`)
  })

  it('lists exactly the registry deepLink commands as ?cmd= entries', () => {
    const cmds = locs
      .filter(l => l.includes('?cmd='))
      .map(l => decodeURIComponent(l.split('?cmd=')[1]!))
      .sort()
    expect(cmds).toEqual([...deepLinkCommands()].sort())
  })

  it('has no other entries', () => {
    expect(locs).toHaveLength(3 + deepLinkCommands().length)
  })

  it('robots.txt allows everything and points at the sitemap', () => {
    expect(robots).toMatch(/User-agent: \*\s+Allow: \//)
    expect(robots).not.toMatch(/Disallow: \/\S/)
    expect(robots).toContain(`Sitemap: ${base}/sitemap.xml`)
  })
})

describe('JSON-LD', () => {
  it('Person is built from resume.json', () => {
    const p = personJsonLd(content.resume)
    expect(p['@type']).toBe('Person')
    expect(p.name).toBe(content.resume.basics.name)
    expect(p.jobTitle).toBe('Director, Product Operations & Strategy')
    expect(p.worksFor).toEqual({ '@type': 'Organization', name: 'PTC — Onshape', url: 'https://www.onshape.com' })
    expect(p.address.addressLocality).toBe('Ashland')
    expect(p.address.addressRegion).toBe('MA')
    expect(p.sameAs).toEqual(content.resume.basics.profiles.map(x => x.url))
    expect(p.url).toBe('https://www.markcheli.com/')
    expect(p.image).toBeUndefined()
  })

  it('picks up a headshot when basics.image is set', () => {
    const c = cloneContent()
    c.resume.basics.image = '/headshot.jpg'
    expect(personJsonLd(c.resume).image).toBe('https://www.markcheli.com/headshot.jpg')
  })

  it('home graph has Person and WebSite; resume graph has the Person', () => {
    const home = homeJsonLd(content.resume)
    expect(home['@context']).toBe('https://schema.org')
    expect(home['@graph'].map(n => n['@type'])).toEqual(['Person', 'WebSite'])
    const site = home['@graph'][1]
    expect(site).toMatchObject({ name: 'markcheli.com', author: { '@id': 'https://www.markcheli.com/#person' } })
    expect(resumeJsonLd(content.resume)['@graph'].map(n => n['@type'])).toEqual(['Person'])
  })

  it('jobTitle comes from the current role, falling back to the label', () => {
    const c = cloneContent()
    c.resume.work = []
    expect(jobTitle(c.resume)).toBe('Director, Product Operations & Strategy')
  })
})

describe('page head', () => {
  it('title and description derive from resume.json basics', () => {
    expect(siteTitle(content.resume)).toBe('Mark Cheli — Director, Product Operations & Strategy · Onshape (PTC)')
    const head = pageHead(content.resume, { path: '/' })
    expect(head.title).toBe(siteTitle(content.resume))
    expect(head.meta).toContainEqual({ name: 'description', content: content.resume.basics.summary })
    expect(head.title).not.toContain('Developer')
  })

  it('og:image and twitter:image point at /og.png with summary_large_image', () => {
    const head = pageHead(content.resume, { path: '/' })
    expect(OG_IMAGE_PATH).toBe('/og.png')
    expect(head.meta).toContainEqual({ property: 'og:image', content: 'https://www.markcheli.com/og.png' })
    expect(head.meta).toContainEqual({ name: 'twitter:image', content: 'https://www.markcheli.com/og.png' })
    expect(head.meta).toContainEqual({ name: 'twitter:card', content: 'summary_large_image' })
    expect(head.meta).toContainEqual({ property: 'og:image:width', content: '1200' })
    expect(head.meta).toContainEqual({ property: 'og:image:height', content: '630' })
  })

  it('canonical and og:url follow the page path', () => {
    const head = pageHead(content.resume, { path: '/resume', title: 'Resume' })
    expect(head.link).toEqual([{ rel: 'canonical', href: 'https://www.markcheli.com/resume' }])
    expect(head.meta).toContainEqual({ property: 'og:url', content: 'https://www.markcheli.com/resume' })
    expect(head.title).toBe('Resume — Mark Cheli')
  })
})
