/**
 * Terminal state: what was typed, what came back, the input line, history
 * recall, tab completion and the one-question-at-a-time prompt that
 * interactive commands (`message`) use. No DOM access; the page injects
 * `open` and the API calls so this runs unchanged under vitest.
 */
import { computed, ref, type Ref } from 'vue'
import { execute } from '~/commands/execute'
import { commandNames, completions, findCommand } from '~/commands/registry'
import { openTargets } from '~/commands/open'
import type { SiteContent } from '~/types/content'
import {
  PromptCancelled,
  type CommandContext,
  type ContactMessage,
  type HistoryEntry,
  type OutputBlock,
  type PendingPrompt,
  type SendResult,
  type Weather
} from '~/types/terminal'

export interface TerminalOptions {
  content: SiteContent
  open: (url: string) => void
  fetchWeather: () => Promise<Weather>
  sendMessage: (message: ContactMessage) => Promise<SendResult>
  /** Milliseconds per character when auto-typing a deep link; 0 types instantly. */
  typingDelay?: number
}

const sleep = (ms: number): Promise<void> =>
  ms <= 0 ? Promise.resolve() : new Promise(resolve => setTimeout(resolve, ms))

/** Longest common prefix of a non-empty list. */
const commonPrefix = (words: string[]): string =>
  words.reduce((acc, word) => {
    let i = 0
    while (i < acc.length && i < word.length && acc[i] === word[i]) i++
    return acc.slice(0, i)
  })

export const useTerminal = (options: TerminalOptions) => {
  const entries: Ref<HistoryEntry[]> = ref([])
  const typed: Ref<string[]> = ref([])
  const input = ref('')
  /** A command is running and the input is read-only. */
  const busy = ref(false)
  /** A command is waiting for an answer on the input line. */
  const pending: Ref<PendingPrompt | null> = ref(null)

  let historyIndex = -1
  let draft = ''
  let cleared = false

  /** The entry output should go to: the most recent one, so prompts and answers stay in order. */
  const lastEntry = (): HistoryEntry | undefined => entries.value[entries.value.length - 1]

  const ctx: CommandContext = {
    content: options.content,
    open: options.open,
    clear: () => {
      entries.value = []
      cleared = true
    },
    get history() {
      return typed.value
    },
    print: blocks => {
      const entry = lastEntry()
      if (entry) entry.blocks.push(...blocks)
      else entries.value.push({ command: '', blocks: [...blocks] })
    },
    prompt: label =>
      new Promise<string>((resolve, reject) => {
        busy.value = false
        pending.value = {
          label,
          onAnswer: answer => {
            busy.value = true
            resolve(answer)
          },
          onCancel: () => {
            busy.value = true
            reject(new PromptCancelled())
          }
        }
      }),
    fetchWeather: options.fetchWeather,
    sendMessage: options.sendMessage
  }

  /** Add output that nobody typed (the banner on load). */
  const print = (blocks: OutputBlock[]): void => {
    entries.value.push({ command: '', blocks })
  }

  const clearScreen = (): void => {
    entries.value = []
  }

  /** Hand the line to the command waiting for it. */
  const answer = (raw: string): void => {
    const p = pending.value
    if (p === null) return
    pending.value = null
    entries.value.push({ command: raw, prompt: p.label, blocks: [] })
    input.value = ''
    p.onAnswer(raw)
  }

  /** Run one line exactly as if it had been typed and Enter pressed. */
  const run = async (raw: string): Promise<OutputBlock[]> => {
    if (pending.value !== null) {
      answer(raw)
      return []
    }
    const command = raw.trim()
    if (command.length === 0) {
      input.value = ''
      return []
    }
    busy.value = true
    if (typed.value[typed.value.length - 1] !== command) typed.value.push(command)
    historyIndex = -1
    draft = ''
    cleared = false
    input.value = ''
    entries.value.push({ command, blocks: [] })
    try {
      const blocks = await execute(command, ctx)
      if (!cleared) {
        const entry = lastEntry()
        if (entry) entry.blocks.push(...blocks)
        else entries.value.push({ command: '', blocks })
      }
      return blocks
    } finally {
      pending.value = null
      busy.value = false
    }
  }

  /**
   * Type a line character by character, pause as a hand would before Enter,
   * then run it exactly as Enter would. This is what a chip tap and a ?cmd=
   * deep link both do, so the transcript always shows the command being
   * entered. The input is read-only and chips are disabled while it types.
   */
  const typeAndRun = async (raw: string): Promise<OutputBlock[]> => {
    const command = raw.trim()
    if (command.length === 0 || busy.value) return []
    if (pending.value !== null) return run(command)
    const delay = options.typingDelay ?? 0
    busy.value = true
    try {
      for (let i = 1; i <= command.length; i++) {
        input.value = command.slice(0, i)
        await sleep(delay)
      }
      await sleep(delay * 4)
    } finally {
      busy.value = false
    }
    return run(command)
  }

  /** Type a known command and run it. Unknown commands are ignored. */
  const runDeepLink = async (raw: string): Promise<boolean> => {
    const command = raw.trim()
    const name = command.split(/\s+/)[0] ?? ''
    if (findCommand(name) === undefined) return false
    await typeAndRun(command)
    return true
  }

  const historyUp = (): void => {
    if (pending.value !== null || typed.value.length === 0) return
    if (historyIndex === -1) draft = input.value
    if (historyIndex < typed.value.length - 1) historyIndex++
    input.value = typed.value[typed.value.length - 1 - historyIndex] ?? ''
  }

  const historyDown = (): void => {
    if (pending.value !== null || historyIndex === -1) return
    historyIndex--
    input.value = historyIndex === -1 ? draft : (typed.value[typed.value.length - 1 - historyIndex] ?? '')
  }

  /** Candidates for the word being typed, aware of which command it is an argument to. */
  const candidatesFor = (words: string[]): string[] => {
    const partial = (words[words.length - 1] ?? '').toLowerCase()
    if (words.length <= 1) return completions(partial, options.content)
    const command = (words[0] ?? '').toLowerCase()
    let pool: string[] = []
    if (command === 'help') pool = commandNames()
    else if (command === 'projects') pool = ['all', ...options.content.projects.projects.map(p => p.slug)]
    else if (command === 'open') pool = openTargets(options.content).map(t => t.name)
    return pool.filter(w => w.startsWith(partial)).sort()
  }

  /** Tab: complete the current word as far as it is unambiguous. */
  const complete = (): string[] => {
    if (pending.value !== null) return []
    const raw = input.value
    if (raw.trim().length === 0) return []
    const words = raw.split(/\s+/)
    const matches = candidatesFor(words)
    if (matches.length === 0) return []
    const completed = matches.length === 1 ? `${matches[0]} ` : commonPrefix(matches)
    const head = words.slice(0, -1)
    input.value = [...head, completed].join(' ')
    return matches
  }

  /** Ctrl+C: drop the line, and cancel a waiting command. */
  const cancelInput = (): void => {
    input.value = ''
    historyIndex = -1
    const p = pending.value
    if (p !== null) {
      pending.value = null
      p.onCancel()
    }
  }

  return {
    entries,
    input,
    busy,
    pending,
    typed: computed(() => typed.value.slice()),
    run,
    typeAndRun,
    runDeepLink,
    print,
    clearScreen,
    historyUp,
    historyDown,
    complete,
    cancelInput
  }
}

export type Terminal = ReturnType<typeof useTerminal>
