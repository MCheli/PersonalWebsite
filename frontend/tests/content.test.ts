import { describe, expect, it } from 'vitest'
import {
  ContentError,
  containerCount,
  content,
  currentWork,
  dateRange,
  featuredFirst,
  formatDate,
  previousWork,
  publicServices,
  serviceHref,
  validateCatalog,
  validateNow,
  validateProjects,
  validateResume
} from '~/utils/content'
import { cloneContent } from './helpers'

describe('content loading', () => {
  it('loads the four real files', () => {
    expect(content.resume.basics.name).toBe('Mark Cheli')
    expect(content.projects.projects.length).toBeGreaterThan(0)
    expect(content.catalog.categories.length).toBeGreaterThan(0)
    expect(Array.isArray(content.now.items)).toBe(true)
  })

  it('rejects a resume missing a required key, naming it', () => {
    const c = cloneContent()
    const broken = { ...c.resume, basics: { ...c.resume.basics, summary: undefined } }
    delete (broken.basics as Record<string, unknown>).summary
    expect(() => validateResume(broken)).toThrow(ContentError)
    expect(() => validateResume(broken)).toThrow('resume.json: missing required key "basics.summary"')
  })

  it('rejects duplicate project slugs', () => {
    const c = cloneContent()
    c.projects.projects.push({ ...c.projects.projects[0]! })
    expect(() => validateProjects(c.projects)).toThrow(/duplicate slug/)
  })

  it('rejects duplicate service names', () => {
    const c = cloneContent()
    c.catalog.categories[0]!.services.push({ name: 'plex' })
    expect(() => validateCatalog(c.catalog)).toThrow(/duplicate service name "plex"/)
  })

  it('rejects a now.json whose items is not an array', () => {
    expect(() => validateNow({ updated: '2026', items: 'x' })).toThrow(/items/)
    expect(() => validateNow({ items: [] })).toThrow(/updated/)
  })
})

describe('derived views', () => {
  it('containerCount honours containers[] and external', () => {
    const c = cloneContent()
    c.catalog.categories = [{
      id: 'x',
      title: 'X',
      services: [
        { name: 'a' },
        { name: 'b', external: true },
        { name: 'c', containers: [] },
        { name: 'd', containers: ['d1', 'd2'] }
      ]
    }]
    expect(containerCount(c.catalog)).toBe(3)
  })

  it('publicServices excludes LAN-only categories and services and url-less entries', () => {
    const names = publicServices(content.catalog).map(s => s.name)
    expect(names).toContain('plex')
    expect(names).not.toContain('grafana')
    expect(names).not.toContain('daily-report')
    expect(names).not.toContain('asa')
  })

  it('serviceHref adds https:// when the catalog omits it', () => {
    expect(serviceHref({ name: 'x', url: 'minecraft.markcheli.com:25565' })).toBe('https://minecraft.markcheli.com:25565')
    expect(serviceHref({ name: 'x', url: 'https://a.example' })).toBe('https://a.example')
    expect(serviceHref({ name: 'x' })).toBeUndefined()
  })

  it('featuredFirst keeps file order within each group', () => {
    const slugs = featuredFirst(content.projects).map(p => p.slug)
    const featured = content.projects.projects.filter(p => p.featured).map(p => p.slug)
    expect(slugs.slice(0, featured.length)).toEqual(featured)
  })

  it('currentWork is the entry with no endDate; previousWork is the rest', () => {
    expect(currentWork(content.resume)?.position).toBe('Director, Product Operations & Strategy')
    expect(previousWork(content.resume)).toHaveLength(content.resume.work.length - 1)
  })

  it('formats dates', () => {
    expect(formatDate('2022-01')).toBe('Jan 2022')
    expect(formatDate('2016')).toBe('2016')
    expect(dateRange('2019-01', '2020-01')).toBe('Jan 2019 – Jan 2020')
    expect(dateRange('2022-01')).toBe('Jan 2022 – present')
  })
})
