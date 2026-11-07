/**
 * <title>, description, canonical and OG/Twitter tags, from resume.json.
 * Pages call `pageHead()` and hand the result to useHead; nothing about Mark
 * is typed into a meta tag by hand.
 */
import type { Resume } from '~/types/content'
import { siteUrl } from '~/utils/content'

export const OG_IMAGE_PATH = '/og.png'

export interface PageSeo {
  /** Route path, e.g. "/resume". */
  path: string
  /** Page-specific part of the title; omitted on the home page. */
  title?: string
  description?: string
}

export interface HeadInput {
  title: string
  link: { rel: 'canonical', href: string }[]
  meta: ({ name: string, content: string } | { property: string, content: string })[]
}

export const siteTitle = (resume: Resume): string => `${resume.basics.name} — ${resume.basics.label}`

export const siteDescription = (resume: Resume): string => resume.basics.summary

export const pageHead = (resume: Resume, page: PageSeo): HeadInput => {
  const base = siteUrl(resume)
  const url = `${base}${page.path}`
  const title = page.title === undefined ? siteTitle(resume) : `${page.title} — ${resume.basics.name}`
  const description = page.description ?? siteDescription(resume)
  const image = `${base}${OG_IMAGE_PATH}`
  return {
    title,
    link: [{ rel: 'canonical', href: url }],
    meta: [
      { name: 'description', content: description },
      { name: 'author', content: resume.basics.name },
      { name: 'robots', content: 'index, follow, max-snippet:-1, max-image-preview:large' },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:type', content: page.path === '/' ? 'website' : 'article' },
      { property: 'og:url', content: url },
      { property: 'og:site_name', content: base.replace(/^https?:\/\/(www\.)?/, '') },
      { property: 'og:image', content: image },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: image }
    ]
  }
}
