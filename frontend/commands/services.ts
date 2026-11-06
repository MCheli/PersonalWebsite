import type { Service } from '~/types/content'
import type { Command, Inline, TableRow } from '~/types/terminal'
import { containerCount, serviceCount, serviceHref } from '~/utils/content'
import { a, blank, heading, kv, muted, rule, table, text } from './blocks'

/** One catalog row: the name links to the service when it has a url; repo and notes go on a second line. */
const serviceRow = (s: Service): TableRow => {
  const href = serviceHref(s)
  const detail: Inline[] = []
  if (s.repo !== undefined) detail.push(a(s.repo, 'repo'))
  if (s.external) detail.push('external')
  if (s.lanOnly) detail.push('LAN only')
  const row: TableRow = { name: href === undefined ? s.name : a(href, s.name) }
  if (s.description !== undefined) row.description = s.description
  if (detail.length > 0) row.detail = detail
  return row
}

export const services: Command = {
  name: 'services',
  aliases: ['homelab'],
  description: 'Everything running on the server this site is served from',
  longDescription:
    'Every container on the Dell R630, grouped by category, from content/services.json. ' +
    'A weekly check diffs this list against the real docker-compose file so it stays true. ' +
    'Type a service name to open it.',
  deepLink: true,
  tour: true,
  run: (_args, { content }) => {
    const c = content.catalog
    const summary = c.categories.map(cat => `${cat.services.length} ${cat.id}`).join(' · ')
    return [
      heading(`${c.host.name} · ${serviceCount(c)} services · ${containerCount(c)} containers`),
      text(`${c.host.displayName} — ${c.host.hardware} · ${c.host.os} · ${c.host.stack}`, 'muted'),
      rule(),
      blank(),
      ...c.categories.flatMap(cat => [
        heading(cat.title),
        rule(),
        table(cat.services.map(serviceRow)),
        blank()
      ]),
      text(`Summary: ${summary} (${serviceCount(c)} total)`, 'muted'),
      ...(c.host.repo !== undefined
        ? [kv([{ key: 'infra', value: [a(c.host.repo)] }])]
        : []),
      muted(`Type a service name (plex, grafana, tallied-demo…) to open it. Updated ${c.updated}.`)
    ]
  }
}
