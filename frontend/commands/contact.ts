import type { Command } from '~/types/terminal'
import { publicServices, serviceHref } from '~/utils/content'
import { a, blank, heading, kv, muted, text } from './blocks'

export const contact: Command = {
  name: 'contact',
  description: 'Email, LinkedIn, GitHub and the public services',
  deepLink: true,
  tour: true,
  run: (_args, { content }) => {
    const { basics } = content.resume
    const rows = [
      { key: 'email', value: [a(`mailto:${basics.email}`, basics.email)] },
      ...basics.profiles.map(p => ({ key: p.network.toLowerCase(), value: [a(p.url)] })),
      { key: 'web', value: [a(basics.url)] }
    ]
    const services = publicServices(content.catalog).flatMap(s => {
      const href = serviceHref(s)
      return href === undefined ? [] : [{ key: s.name, value: [a(href, s.url)] }]
    })
    return [
      heading('Contact'),
      kv(rows),
      blank(),
      text('Public services', 'info'),
      kv(services),
      blank(),
      muted("Email is the fastest. Type a service name to open it, 'services' for the whole catalog."),
      muted("Or type 'message' to send a note from here.")
    ]
  }
}
