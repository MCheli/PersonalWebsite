/**
 * The one place content/*.json crosses from "JSON on disk" to typed data.
 *
 * `loadContent()` casts each file once and checks the keys the site cannot
 * live without, so a broken JSON fails the build (and the test run) with a
 * message naming the file and the key, instead of rendering a blank page.
 */
import resumeJson from '~/content/resume.json'
import projectsJson from '~/content/projects.json'
import servicesJson from '~/content/services.json'
import nowJson from '~/content/now.json'
import type {
  Catalog,
  Now,
  Project,
  ProjectsFile,
  Resume,
  ResumeProfile,
  Service,
  SiteContent,
  WorkEntry
} from '~/types/content'

export class ContentError extends Error {
  constructor(file: string, message: string) {
    super(`content/${file}: ${message}`)
    this.name = 'ContentError'
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const requireKeys = (file: string, value: unknown, keys: string[], path = ''): Record<string, unknown> => {
  if (!isRecord(value)) throw new ContentError(file, `${path || 'root'} must be an object`)
  for (const key of keys) {
    if (!(key in value)) throw new ContentError(file, `missing required key "${path}${key}"`)
  }
  return value
}

const requireArray = (file: string, value: unknown, path: string): unknown[] => {
  if (!Array.isArray(value)) throw new ContentError(file, `"${path}" must be an array`)
  return value
}

const requireString = (file: string, value: unknown, path: string): string => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ContentError(file, `"${path}" must be a non-empty string`)
  }
  return value
}

export const validateResume = (raw: unknown): Resume => {
  const file = 'resume.json'
  const root = requireKeys(file, raw, ['basics', 'work', 'education', 'skills', 'meta'])
  const basics = requireKeys(file, root.basics, ['name', 'label', 'email', 'url', 'summary', 'location', 'profiles'], 'basics.')
  requireKeys(file, basics.location, ['city', 'region', 'countryCode'], 'basics.location.')
  requireArray(file, basics.profiles, 'basics.profiles').forEach((p, i) =>
    requireKeys(file, p, ['network', 'url'], `basics.profiles[${i}].`)
  )
  requireArray(file, root.work, 'work').forEach((w, i) =>
    requireKeys(file, w, ['name', 'position', 'startDate', 'summary', 'highlights'], `work[${i}].`)
  )
  requireArray(file, root.education, 'education')
  requireArray(file, root.skills, 'skills').forEach((s, i) =>
    requireKeys(file, s, ['name', 'keywords'], `skills[${i}].`)
  )
  requireString(file, requireKeys(file, root.meta, ['lastModified'], 'meta.').lastModified, 'meta.lastModified')
  return raw as Resume
}

export const validateProjects = (raw: unknown): ProjectsFile => {
  const file = 'projects.json'
  const root = requireKeys(file, raw, ['updated', 'projects'])
  const seen = new Set<string>()
  requireArray(file, root.projects, 'projects').forEach((p, i) => {
    const project = requireKeys(
      file, p,
      ['slug', 'name', 'tagline', 'description', 'highlights', 'stack', 'status', 'started', 'featured'],
      `projects[${i}].`
    )
    const slug = requireString(file, project.slug, `projects[${i}].slug`)
    if (seen.has(slug)) throw new ContentError(file, `duplicate slug "${slug}"`)
    seen.add(slug)
  })
  return raw as ProjectsFile
}

export const validateCatalog = (raw: unknown): Catalog => {
  const file = 'services.json'
  const root = requireKeys(file, raw, ['updated', 'host', 'categories'])
  requireKeys(file, root.host, ['name', 'displayName', 'hardware', 'os', 'kernel', 'cpu', 'memory', 'stack'], 'host.')
  const seen = new Set<string>()
  requireArray(file, root.categories, 'categories').forEach((c, i) => {
    const category = requireKeys(file, c, ['id', 'title', 'services'], `categories[${i}].`)
    requireArray(file, category.services, `categories[${i}].services`).forEach((s, j) => {
      const service = requireKeys(file, s, ['name'], `categories[${i}].services[${j}].`)
      const name = requireString(file, service.name, `categories[${i}].services[${j}].name`)
      if (seen.has(name)) throw new ContentError(file, `duplicate service name "${name}"`)
      seen.add(name)
    })
  })
  return raw as Catalog
}

export const validateNow = (raw: unknown): Now => {
  const file = 'now.json'
  const root = requireKeys(file, raw, ['updated', 'items'])
  requireArray(file, root.items, 'items')
  requireString(file, root.updated, 'updated')
  return raw as Now
}

export const loadContent = (): SiteContent => ({
  resume: validateResume(resumeJson),
  projects: validateProjects(projectsJson),
  catalog: validateCatalog(servicesJson),
  now: validateNow(nowJson)
})

/** The site's content, validated once at module load (build time under SSR). */
export const content: SiteContent = loadContent()

// ---------------------------------------------------------------------------
// Derived views used by more than one renderer
// ---------------------------------------------------------------------------

export const allServices = (catalog: Catalog): Service[] =>
  catalog.categories.flatMap(c => c.services)

export const findService = (catalog: Catalog, name: string): Service | undefined =>
  allServices(catalog).find(s => s.name === name)

export const findProject = (projects: ProjectsFile, slug: string): Project | undefined =>
  projects.projects.find(p => p.slug === slug)

/** Services a visitor can open from the internet: has a url, not LAN-only. */
export const publicServices = (catalog: Catalog): Service[] =>
  catalog.categories
    .filter(c => !c.lanOnly)
    .flatMap(c => c.services)
    .filter(s => s.url !== undefined && !s.lanOnly)

/** Count of Docker containers the catalog describes, honouring `containers` and `external`. */
export const containerCount = (catalog: Catalog): number =>
  allServices(catalog).reduce((sum, s) => {
    if (s.external) return sum
    if (s.containers !== undefined) return sum + s.containers.length
    return sum + 1
  }, 0)

export const serviceCount = (catalog: Catalog): number => allServices(catalog).length

export const featuredFirst = (projects: ProjectsFile): Project[] =>
  [...projects.projects].sort((a, b) => Number(b.featured) - Number(a.featured))

export const currentWork = (resume: Resume): WorkEntry | undefined =>
  resume.work.find(w => w.endDate === undefined) ?? resume.work[0]

export const previousWork = (resume: Resume): WorkEntry[] => {
  const current = currentWork(resume)
  return resume.work.filter(w => w !== current)
}

export const profileByNetwork = (resume: Resume, network: string): ResumeProfile | undefined =>
  resume.basics.profiles.find(p => p.network.toLowerCase() === network.toLowerCase())

export const locationLine = (resume: Resume): string =>
  `${resume.basics.location.city}, ${resume.basics.location.region}`

/** Everything a link to a service needs: urls in the catalog may omit the scheme (minecraft:25565). */
export const serviceHref = (service: Service): string | undefined => {
  if (service.url === undefined) return undefined
  return service.url.startsWith('http') ? service.url : `https://${service.url}`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2022-01" → "Jan 2022", "2016" → "2016". */
export const formatDate = (value: string): string => {
  const [year, month] = value.split('-')
  if (year === undefined) return value
  if (month === undefined) return year
  const index = Number(month) - 1
  const name = MONTHS[index]
  return name === undefined ? value : `${name} ${year}`
}

export const dateRange = (start: string, end?: string): string =>
  `${formatDate(start)} – ${end === undefined ? 'present' : formatDate(end)}`

/** basics.url without a trailing slash, for building canonical links. */
export const siteUrl = (resume: Resume): string => resume.basics.url.replace(/\/$/, '')
