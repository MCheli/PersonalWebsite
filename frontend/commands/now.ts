import type { Command, OutputBlock } from '~/types/terminal'
import { blank, heading, list, muted, text } from './blocks'

export const now: Command = {
  name: 'now',
  description: 'What I am doing these days',
  deepLink: true,
  tour: true,
  run: (_args, { content }) => {
    const n = content.now
    const blocks: OutputBlock[] = [heading('Now'), list(n.items.map(item => [item]))]
    if (n.openTo.trim().length > 0) blocks.push(blank(), text(n.openTo, 'success'))
    blocks.push(blank(), muted(`Updated ${n.updated}`))
    return blocks
  }
}
