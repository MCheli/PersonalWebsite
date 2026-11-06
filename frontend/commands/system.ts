/**
 * The small "unix-flavoured" commands: neofetch, whoami, clear, history, ls, exit.
 * None of them invents a fact: everything printed is from content/ or the session.
 */
import type { SiteContent } from '~/types/content'
import type { Command, OutputBlock } from '~/types/terminal'
import { containerCount, locationLine, profileByNetwork, serviceCount } from '~/utils/content'
import { a, blank, figlet, kv, list, muted, text } from './blocks'

/** The figlet and the host block; also the first thing on the page, so it is sync. */
export const neofetchBlocks = (content: SiteContent): OutputBlock[] => {
  const { host } = content.catalog
  const { basics } = content.resume
  return [
    figlet(),
    text(basics.label),
    kv([
      { key: 'Host', value: [host.hardware] },
      { key: 'OS', value: [host.os] },
      { key: 'Kernel', value: [host.kernel] },
      { key: 'CPU', value: [host.cpu] },
      { key: 'Memory', value: [host.memory] },
      { key: 'Stack', value: [host.stack] },
      { key: 'Services', value: [`${serviceCount(content.catalog)} in the catalog · ${containerCount(content.catalog)} containers`] }
    ]),
    muted("Type 'help' for commands, or tap one below.")
  ]
}

export const neofetch: Command = {
  name: 'neofetch',
  description: 'The banner and the host this site runs on',
  deepLink: true,
  tour: true,
  run: (_args, { content }) => neofetchBlocks(content)
}

export const whoami: Command = {
  name: 'whoami',
  description: 'One line: name, title, location',
  tour: true,
  run: (_args, { content }) => {
    const { basics } = content.resume
    return [text(`${basics.name} — ${basics.label} · ${locationLine(content.resume)}`)]
  }
}

export const clear: Command = {
  name: 'clear',
  description: 'Clear the screen (also Ctrl+L)',
  run: (_args, ctx) => {
    ctx.clear()
    return []
  }
}

export const history: Command = {
  name: 'history',
  description: 'Commands typed this session',
  run: (_args, ctx) => {
    if (ctx.history.length === 0) return [muted('Nothing typed yet.')]
    const width = String(ctx.history.length).length
    return [list(ctx.history.map((cmd, i) => [`${String(i + 1).padStart(width)}  ${cmd}`]))]
  }
}

export const ls: Command = {
  name: 'ls',
  description: 'Where to go from here',
  run: () => [
    text('about/  projects/  resume/  homelab/  contact/'),
    muted("Not a filesystem — each one is a command. Try 'projects'.")
  ]
}

export const exit: Command = {
  name: 'exit',
  description: 'Say goodbye (nothing closes)',
  run: (_args, { content }) => {
    const { basics } = content.resume
    const linkedin = profileByNetwork(content.resume, 'LinkedIn')
    const github = profileByNetwork(content.resume, 'GitHub')
    const rows = [{ key: 'email', value: [a(`mailto:${basics.email}`, basics.email)] }]
    if (linkedin) rows.push({ key: 'linkedin', value: [a(linkedin.url)] })
    if (github) rows.push({ key: 'github', value: [a(github.url)] })
    return [
      text('Thanks for visiting.', 'success'),
      blank(),
      kv(rows),
      muted('This tab is yours to close; the terminal stays open.')
    ]
  }
}
