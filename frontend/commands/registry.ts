/**
 * The command registry: the only list of commands the site has.
 * `help`, tab completion, `help <cmd>`, the sitemap and the screenshot tour
 * all derive from this array. Adding a command means adding it here and
 * updating commands/registry.json (a test fails until you do).
 */
import type { SiteContent } from '~/types/content'
import type { Command } from '~/types/terminal'
import { about } from './about'
import { contact } from './contact'
import { help } from './help'
import { services } from './services'
import { message } from './message'
import { now } from './now'
import { open, openTargets } from './open'
import { projects } from './projects'
import { resume } from './resume'
import { clear, exit, history, ls, neofetch, whoami } from './system'
import { weather } from './weather'

/** Display order for `help`. */
export const commands: readonly Command[] = [
  help,
  about,
  resume,
  projects,
  services,
  now,
  contact,
  message,
  open,
  neofetch,
  whoami,
  weather,
  clear,
  history,
  ls,
  exit
]

/** Every word that resolves to a command: names first, then aliases. */
export const commandNames = (): string[] => [
  ...commands.map(c => c.name),
  ...commands.flatMap(c => c.aliases ?? [])
]

export const findCommand = (name: string): Command | undefined => {
  const key = name.toLowerCase()
  return commands.find(c => c.name === key || (c.aliases ?? []).includes(key))
}

/** Words Tab can complete to: commands, aliases and everything `open` accepts. */
export const completions = (prefix: string, content: SiteContent): string[] => {
  const key = prefix.toLowerCase()
  const words = [...commandNames(), ...openTargets(content).map(t => t.name)]
  return [...new Set(words)].filter(w => w.startsWith(key)).sort()
}

export const levenshtein = (a: string, b: string): number => {
  const rows = a.length + 1
  const cols = b.length + 1
  const d: number[][] = Array.from({ length: rows }, (_, i) => [i, ...Array<number>(cols - 1).fill(0)])
  for (let j = 1; j < cols; j++) d[0]![j] = j
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost)
    }
  }
  return d[rows - 1]![cols - 1]!
}

/** The closest command name within edit distance 2, or undefined. */
export const suggest = (name: string): string | undefined => {
  const key = name.toLowerCase()
  let best: { word: string, distance: number } | undefined
  for (const word of commandNames()) {
    const distance = levenshtein(key, word)
    if (distance <= 2 && (best === undefined || distance < best.distance)) best = { word, distance }
  }
  return best?.word
}

export const tourCommands = (): string[] => commands.filter(c => c.tour).map(c => c.name)

export const deepLinkCommands = (): string[] => commands.filter(c => c.deepLink).map(c => c.name)
