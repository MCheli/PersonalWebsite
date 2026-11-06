import type { Service } from '~/types/content'
import type { Command, Inline } from '~/types/terminal'
import { containerCount, serviceCount, serviceHref } from '~/utils/content'
import { a, blank, heading, kv, muted, rule, text } from './blocks'

const serviceValue = (s: Service): Inline[] => {
  const value: Inline[] = []
  const href = serviceHref(s)
  if (href !== undefined && s.url !== undefined) value.push(a(href, s.url))
  if (s.description !== undefined) value.push(s.description)
  if (s.repo !== undefined) value.push(a(s.repo, 'repo'))
  if (s.external) value.push('(external)')
  return value
}

export const homelab: Command = {
  name: 'homelab',
  aliases: ['services'],
  description: 'The service catalog of the server this site runs on',
  longDescription:
    'Every container on the Dell R630, grouped by category, from content/services.json. ' +
    'A weekly check diffs this list against the real docker-compose file so it stays true.',
  deepLink: true,
  tour: true,
  run: (_args, { content }) => {
    const c = content.catalog
    const summary = c.categories.map(cat => `${cat.services.length} ${cat.id}`).join(' · ')
    return [
      heading(`${c.host.displayName} homelab`),
      text(`${serviceCount(c)} services · ${containerCount(c)} containers · ${c.host.hardware} · ${c.host.os} · ${c.host.stack}`, 'muted'),
      blank(),
      ...c.categories.flatMap(cat => [
        text(cat.title, 'info'),
        rule(),
        kv(cat.services.map(s => ({ key: s.name, value: serviceValue(s) }))),
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
