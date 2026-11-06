/**
 * What a command returns and what it can ask the terminal to do.
 *
 * Output is structured: a command returns blocks, the renderer lays them out.
 * No pre-formatted columns, no HTML strings, no sentinel strings.
 */
import type { SiteContent } from '~/types/content'

/** A run of text or a link inside a list item or kv value. */
export type Inline = string | { href: string, label: string }

export type Tone = 'muted' | 'success' | 'info' | 'error'

export type OutputBlock =
  | { kind: 'text', text: string, tone?: Tone }
  | { kind: 'heading', text: string }
  | { kind: 'rule' }
  | { kind: 'list', items: Inline[][] }
  | { kind: 'kv', rows: { key: string, value: Inline[] }[] }
  | { kind: 'link', href: string, label: string }
  /** The MARK CHELI art on wide screens; the name as text on narrow ones. */
  | { kind: 'figlet' }
  | { kind: 'blank' }

export interface Weather {
  location: string
  temperature: number
  feels_like: number
  humidity: number
  description: string
  wind_speed: number
  timestamp: string
  source: string
}

/** What the terminal lends a command while it runs. No DOM in here. */
export interface CommandContext {
  content: SiteContent
  /** Open a url in a new tab (injected; a no-op in tests). */
  open: (url: string) => void
  /** Clear the screen. */
  clear: () => void
  /** Commands typed so far this session, oldest first. */
  history: readonly string[]
  fetchWeather: () => Promise<Weather>
}

export interface Command {
  name: string
  aliases?: string[]
  /** One line for `help`. */
  description: string
  /** Shown by `help <cmd>`; e.g. "projects [all | <slug>]". */
  usage?: string
  longDescription?: string
  /** Listed in sitemap.xml as /?cmd=<name>. */
  deepLink?: boolean
  /** Captured by the screenshot tour. */
  tour?: boolean
  run: (args: string[], ctx: CommandContext) => OutputBlock[] | Promise<OutputBlock[]>
}

export interface HistoryEntry {
  /** Empty for output not typed by the visitor (the neofetch on load). */
  command: string
  blocks: OutputBlock[]
}
