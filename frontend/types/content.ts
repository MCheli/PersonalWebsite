/**
 * Types for the four content files in content/. These are the only shapes the
 * site knows about Mark; every page and command reads through them.
 *
 * resume.json follows JSON Resume v1 (https://jsonresume.org/schema). Only the
 * fields the site renders are typed; extra fields in the JSON are ignored.
 */

// ---------------------------------------------------------------------------
// resume.json
// ---------------------------------------------------------------------------

export interface ResumeProfile {
  network: string
  username?: string
  url: string
}

export interface ResumeLocation {
  city: string
  region: string
  countryCode: string
}

export interface ResumeBasics {
  name: string
  label: string
  email: string
  url: string
  summary: string
  image?: string
  location: ResumeLocation
  profiles: ResumeProfile[]
}

export interface WorkEntry {
  name: string
  location?: string
  position: string
  url?: string
  startDate: string
  endDate?: string
  summary: string
  highlights: string[]
}

export interface EducationEntry {
  institution: string
  url?: string
  area: string
  studyType: string
  startDate: string
  endDate?: string
  score?: string
  courses?: string[]
}

export interface Certificate {
  name: string
  date: string
  issuer: string
  url?: string
}

export interface SkillGroup {
  name: string
  level?: string
  keywords: string[]
}

export interface Language {
  language: string
  fluency: string
}

export interface Interest {
  name: string
  keywords: string[]
}

export interface ResumeMeta {
  canonical?: string
  version?: string
  lastModified: string
}

export interface Resume {
  basics: ResumeBasics
  work: WorkEntry[]
  education: EducationEntry[]
  certificates: Certificate[]
  skills: SkillGroup[]
  languages?: Language[]
  interests: Interest[]
  meta: ResumeMeta
}

// ---------------------------------------------------------------------------
// projects.json
// ---------------------------------------------------------------------------

export type ProjectStatus = 'active' | 'pre-release' | 'done' | 'archived'

export interface Project {
  slug: string
  name: string
  tagline: string
  description: string
  highlights: string[]
  stack: string[]
  repo?: string
  url?: string
  demo?: string
  status: ProjectStatus
  started: string
  featured: boolean
}

export interface ProjectsFile {
  updated: string
  projects: Project[]
}

// ---------------------------------------------------------------------------
// services.json (the homelab catalog)
// ---------------------------------------------------------------------------

export interface Host {
  name: string
  displayName: string
  hardware: string
  os: string
  kernel: string
  cpu: string
  memory: string
  stack: string
  repo?: string
}

export interface Profile {
  name: string
  title: string
  company: string
  location: string
  email: string
  website: string
  linkedin: string
  github: string
}

export interface Service {
  name: string
  url?: string
  description?: string
  repo?: string
  lanOnly?: boolean
  /** Runs on other hardware, proxied by the R630. */
  external?: boolean
  /** Real container names when they differ from `name`; empty when not a container. */
  containers?: string[]
  compose?: string
}

export interface Category {
  id: string
  title: string
  lanOnly?: boolean
  services: Service[]
}

export interface Catalog {
  updated: string
  host: Host
  profile: Profile
  categories: Category[]
}

// ---------------------------------------------------------------------------
// now.json
// ---------------------------------------------------------------------------

export interface Now {
  updated: string
  /** Rendered only when non-empty (PRODUCT.md decision D1). */
  openTo: string
  items: string[]
}

// ---------------------------------------------------------------------------
// Everything together
// ---------------------------------------------------------------------------

export interface SiteContent {
  resume: Resume
  projects: ProjectsFile
  catalog: Catalog
  now: Now
}
