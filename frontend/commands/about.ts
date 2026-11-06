import type { Command } from '~/types/terminal'
import { currentWork, formatDate, locationLine } from '~/utils/content'
import { blank, heading, muted, text } from './blocks'

export const about: Command = {
  name: 'about',
  description: 'Who Mark is, in three paragraphs',
  deepLink: true,
  tour: true,
  run: (_args, { content }) => {
    const { basics, interests } = content.resume
    const role = currentWork(content.resume)
    const paragraphs = [
      `${basics.name} — ${basics.label}. ${locationLine(content.resume)}.`,
      basics.summary
    ]
    if (role) {
      paragraphs.push(`Since ${formatDate(role.startDate)}: ${role.position} at ${role.name}. ${role.summary}`)
    }
    if (interests.length > 0) {
      paragraphs.push(`Off the clock: ${interests.map(i => i.name.toLowerCase()).join(', ')}.`)
    }
    return [
      heading('About'),
      ...paragraphs.flatMap(p => [text(p), blank()]),
      muted("Next: 'projects' for what I've built, 'resume' for the career, 'services' for the server, 'contact' to reach me.")
    ]
  }
}
