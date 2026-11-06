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

export interface TableRow {
  /** The first column: a name, or a link when the thing has a url. */
  name: Inline
  /** The second column, rendered muted. */
  description?: string
  /** A second muted line under the description (a repo link, a note). */
  detail?: Inline[]
}

export type OutputBlock =
  | { kind: 'text', text: string, tone?: Tone }
  | { kind: 'heading', text: string }
  | { kind: 'rule' }
  | { kind: 'list', items: Inline[][] }
  | { kind: 'kv', rows: { key: string, value: Inline[] }[] }
  /**
   * A catalog table: one row per item with a name (plain or a link), a muted
   * description beside it and an optional second muted line (repo, notes).
   * Two columns on wide screens, stacked on a phone; the renderer decides.
   */
  | { kind: 'table', rows: TableRow[] }
  | { kind: 'link', href: string, label: string }
  /** The MARK CHELI art on wide screens; the name as text on narrow ones. */
  | { kind: 'figlet' }
  | { kind: 'blank' }

/** What the terminal posts to the API's /contact endpoint. */
export interface ContactMessage {
  name: string
  email: string
  message: string
  /** Honeypot; always empty from the terminal. */
  website: string
}

export type SendResult =
  | { ok: true }
  | { ok: false, status?: number, error?: string }

/** Thrown into a command awaiting ctx.prompt() when the visitor presses Ctrl+C. */
export class PromptCancelled extends Error {
  constructor() {
    super('cancelled')
    this.name = 'PromptCancelled'
  }
}

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
  /** Append output now, before the command returns (for multi-step commands). */
  print: (blocks: OutputBlock[]) => void
  /** Ask the visitor a question on the input line; rejects with PromptCancelled on Ctrl+C. */
  prompt: (label: string) => Promise<string>
  fetchWeather: () => Promise<Weather>
  sendMessage: (message: ContactMessage) => Promise<SendResult>
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
  /** When set, this line was an answer to a prompt with this label, not a command. */
  prompt?: string
  blocks: OutputBlock[]
}

export interface PendingPrompt {
  label: string
  onAnswer: (answer: string) => void
  onCancel: () => void
}
