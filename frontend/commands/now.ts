import type { Command } from '~/types/terminal'
import { blank, heading, list, muted } from './blocks'

export const now: Command = {
  name: 'now',
  description: 'What I am doing these days',
  deepLink: true,
  tour: true,
  run: (_args, { content }) => {
    const n = content.now
    return [heading('Now'), list(n.items.map(item => [item])), blank(), muted(`Updated ${n.updated}`)]
  }
}
