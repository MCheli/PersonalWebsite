import type { Project } from '~/types/content'
import type { Command, Inline, OutputBlock } from '~/types/terminal'
import { featuredFirst, findProject, formatDate } from '~/utils/content'
import { a, blank, error, heading, kv, list, muted, text } from './blocks'

const projectLinks = (p: Project): Inline[] => {
  const links: Inline[] = []
  if (p.url !== undefined) links.push(a(p.url, 'live'))
  if (p.demo !== undefined) links.push(a(p.demo, 'demo'))
  if (p.repo !== undefined) links.push(a(p.repo, 'repo'))
  return links
}

const summaryBlocks = (projects: Project[]): OutputBlock[] =>
  projects.flatMap(p => [
    text(`${p.name} — ${p.tagline}`),
    kv([
      { key: 'stack', value: [p.stack.join(', ')] },
      { key: 'links', value: projectLinks(p) },
      { key: 'more', value: [`projects ${p.slug}`] }
    ]),
    blank()
  ])

const detailBlocks = (p: Project): OutputBlock[] => {
  const blocks: OutputBlock[] = [
    heading(p.name),
    text(p.tagline, 'info'),
    blank(),
    text(p.description),
    blank()
  ]
  if (p.highlights.length > 0) blocks.push(list(p.highlights.map(h => [h])), blank())
  blocks.push(
    kv([
      { key: 'stack', value: [p.stack.join(', ')] },
      { key: 'status', value: [`${p.status} · since ${formatDate(p.started)}`] },
      { key: 'links', value: projectLinks(p) }
    ])
  )
  return blocks
}

export const projects: Command = {
  name: 'projects',
  description: 'Things I have built, featured first',
  usage: 'projects [all | <slug>]',
  longDescription:
    "'projects' lists the featured projects; 'projects all' lists everything; " +
    "'projects <slug>' prints one project in full. Each project is also a card at /projects#<slug>.",
  deepLink: true,
  tour: true,
  run: (args, { content }) => {
    const all = featuredFirst(content.projects)
    const arg = args[0]?.toLowerCase()

    if (arg === undefined) {
      const featured = all.filter(p => p.featured)
      const rest = all.length - featured.length
      return [
        heading('Featured projects'),
        blank(),
        ...summaryBlocks(featured),
        muted(rest > 0 ? `${rest} more: 'projects all'. Detail: 'projects <slug>'. Cards: /projects` : "Detail: 'projects <slug>'. Cards: /projects")
      ]
    }

    if (arg === 'all') {
      return [
        heading(`All ${all.length} projects`),
        blank(),
        ...summaryBlocks(all),
        muted("Detail: 'projects <slug>'. Cards: /projects")
      ]
    }

    const project = findProject(content.projects, arg)
    if (project === undefined) {
      return [
        error(`projects: no project called "${arg}"`),
        text('Valid slugs:'),
        list(all.map(p => [p.slug, `— ${p.name}`]))
      ]
    }
    return detailBlocks(project)
  }
}
