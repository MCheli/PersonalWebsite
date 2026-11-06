/**
 * `open <name>` and the bare-name shortcut (typing `tallied` or `grafana`
 * opens it). Every target derives from content/: project slugs, service
 * names and the three fixed shortcuts.
 */
import type { SiteContent } from '~/types/content'
import type { Command } from '~/types/terminal'
import { findProject, findService, profileByNetwork, serviceHref } from '~/utils/content'
import { a, blank, error, kv, muted, success, text } from './blocks'

export const RESUME_PDF_PATH = '/Mark-Cheli-Resume.pdf'

export interface OpenTarget {
  name: string
  url: string
  /** What the target is, for the listing. */
  kind: 'shortcut' | 'project' | 'service'
  label: string
}

const projectUrl = (p: { url?: string, demo?: string, repo?: string }): string | undefined =>
  p.url ?? p.demo ?? p.repo

/** Every name `open` accepts, in listing order: shortcuts, projects, services. */
export const openTargets = (content: SiteContent): OpenTarget[] => {
  const targets: OpenTarget[] = []
  const linkedin = profileByNetwork(content.resume, 'LinkedIn')
  const github = profileByNetwork(content.resume, 'GitHub')
  if (linkedin) targets.push({ name: 'linkedin', url: linkedin.url, kind: 'shortcut', label: 'LinkedIn profile' })
  if (github) targets.push({ name: 'github', url: github.url, kind: 'shortcut', label: 'GitHub profile' })
  targets.push({ name: 'resume-pdf', url: RESUME_PDF_PATH, kind: 'shortcut', label: 'Resume as PDF' })

  for (const project of content.projects.projects) {
    const url = projectUrl(project)
    if (url !== undefined && !targets.some(t => t.name === project.slug)) {
      targets.push({ name: project.slug, url, kind: 'project', label: project.name })
    }
  }
  for (const category of content.catalog.categories) {
    for (const service of category.services) {
      const url = serviceHref(service)
      if (url !== undefined && !targets.some(t => t.name === service.name)) {
        targets.push({ name: service.name, url, kind: 'service', label: service.description ?? service.name })
      }
    }
  }
  return targets
}

export const resolveOpenTarget = (content: SiteContent, name: string): OpenTarget | undefined => {
  const key = name.toLowerCase()
  const direct = openTargets(content).find(t => t.name === key)
  if (direct) return direct
  // A project or service with no url still resolves to its repo so `open` never dead-ends.
  const project = findProject(content.projects, key)
  if (project?.repo !== undefined) return { name: key, url: project.repo, kind: 'project', label: project.name }
  const service = findService(content.catalog, key)
  if (service?.repo !== undefined) return { name: key, url: service.repo, kind: 'service', label: service.name }
  return undefined
}

export const open: Command = {
  name: 'open',
  description: 'Open a project, service or shortcut in a new tab',
  usage: 'open <name>',
  longDescription:
    'Opens a project url, a service url or a shortcut (linkedin, github, resume-pdf) in a new tab. ' +
    'Typing the bare name does the same thing.',
  run: (args, ctx) => {
    const name = args[0]
    if (name === undefined) {
      const targets = openTargets(ctx.content)
      const group = (kind: OpenTarget['kind']) =>
        targets.filter(t => t.kind === kind).map(t => ({ key: t.name, value: [a(t.url, t.label)] }))
      return [
        text('Usage: open <name>. Names you can open:'),
        blank(),
        text('Shortcuts', 'info'),
        kv(group('shortcut')),
        text('Projects', 'info'),
        kv(group('project')),
        text('Services', 'info'),
        kv(group('service'))
      ]
    }
    const target = resolveOpenTarget(ctx.content, name)
    if (target === undefined) {
      return [error(`open: nothing called "${name}"`), muted("Type 'open' alone to list what can be opened.")]
    }
    ctx.open(target.url)
    return [success(`Opening ${target.label}`), kv([{ key: target.name, value: [a(target.url)] }])]
  }
}
