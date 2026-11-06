/** schema.org structured data, built from resume.json rather than typed by hand. */
import type { Resume } from '~/types/content'
import { currentWork, siteUrl } from '~/utils/content'

export interface PersonJsonLd {
  '@type': 'Person'
  '@id': string
  name: string
  url: string
  email: string
  jobTitle: string
  description: string
  image?: string
  worksFor?: { '@type': 'Organization', name: string, url?: string }
  address: { '@type': 'PostalAddress', addressLocality: string, addressRegion: string, addressCountry: string }
  sameAs: string[]
}

export interface WebSiteJsonLd {
  '@type': 'WebSite'
  '@id': string
  url: string
  name: string
  description: string
  author: { '@id': string }
  inLanguage: string
}

export interface JsonLdGraph {
  '@context': 'https://schema.org'
  '@graph': (PersonJsonLd | WebSiteJsonLd)[]
}

/** The job title without the " · Company" suffix the label carries. */
export const jobTitle = (resume: Resume): string => {
  const role = currentWork(resume)
  return role?.position ?? resume.basics.label.split(' · ')[0] ?? resume.basics.label
}

export const personJsonLd = (resume: Resume): PersonJsonLd => {
  const base = siteUrl(resume)
  const role = currentWork(resume)
  const person: PersonJsonLd = {
    '@type': 'Person',
    '@id': `${base}/#person`,
    name: resume.basics.name,
    url: `${base}/`,
    email: resume.basics.email,
    jobTitle: jobTitle(resume),
    description: resume.basics.summary,
    address: {
      '@type': 'PostalAddress',
      addressLocality: resume.basics.location.city,
      addressRegion: resume.basics.location.region,
      addressCountry: resume.basics.location.countryCode
    },
    sameAs: resume.basics.profiles.map(p => p.url)
  }
  if (resume.basics.image !== undefined) person.image = `${base}${resume.basics.image}`
  if (role) {
    person.worksFor = role.url === undefined
      ? { '@type': 'Organization', name: role.name }
      : { '@type': 'Organization', name: role.name, url: role.url }
  }
  return person
}

export const websiteJsonLd = (resume: Resume): WebSiteJsonLd => {
  const base = siteUrl(resume)
  return {
    '@type': 'WebSite',
    '@id': `${base}/#website`,
    url: `${base}/`,
    name: base.replace(/^https?:\/\/(www\.)?/, ''),
    description: `${resume.basics.name}: ${resume.basics.label}. Resume, projects and homelab.`,
    author: { '@id': `${base}/#person` },
    inLanguage: 'en-US'
  }
}

export const homeJsonLd = (resume: Resume): JsonLdGraph => ({
  '@context': 'https://schema.org',
  '@graph': [personJsonLd(resume), websiteJsonLd(resume)]
})

export const resumeJsonLd = (resume: Resume): JsonLdGraph => ({
  '@context': 'https://schema.org',
  '@graph': [personJsonLd(resume)]
})
