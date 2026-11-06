/**
 * Terminal state: what was typed, what came back, the input line, history
 * recall and tab completion. No DOM access; the page injects `open` and the
 * weather fetcher so this runs unchanged under vitest.
 */
import { computed, ref, type Ref } from 'vue'
import { execute } from '~/commands/execute'
import { commandNames, completions, findCommand } from '~/commands/registry'
import { openTargets } from '~/commands/open'
import type { SiteContent } from '~/types/content'
import type { CommandContext, HistoryEntry, OutputBlock, Weather } from '~/types/terminal'

export interface TerminalOptions {
  content: SiteContent
  open: (url: string) => void
  fetchWeather: () => Promise<Weather>
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
  const busy = ref(false)

  let historyIndex = -1
  let draft = ''
  let cleared = false

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
    fetchWeather: options.fetchWeather
  }

  /** Add output that nobody typed (the banner on load). */
  const print = (blocks: OutputBlock[]): void => {
    entries.value.push({ command: '', blocks })
  }

  const clearScreen = (): void => {
    entries.value = []
  }

  /** Run one line exactly as if it had been typed and Enter pressed. */
  const run = async (raw: string): Promise<OutputBlock[]> => {
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
    try {
      const blocks = await execute(command, ctx)
      if (!cleared) entries.value.push({ command, blocks })
      return blocks
    } finally {
      input.value = ''
      busy.value = false
    }
  }

  /** Type a known command character by character, then run it. Unknown commands are ignored. */
  const runDeepLink = async (raw: string): Promise<boolean> => {
    const command = raw.trim()
    const name = command.split(/\s+/)[0] ?? ''
    if (findCommand(name) === undefined) return false
    const delay = options.typingDelay ?? 0
    busy.value = true
    for (let i = 1; i <= command.length; i++) {
      input.value = command.slice(0, i)
      await sleep(delay)
    }
    await sleep(delay * 4)
    busy.value = false
    await run(command)
    return true
  }

  const historyUp = (): void => {
    if (typed.value.length === 0) return
    if (historyIndex === -1) draft = input.value
    if (historyIndex < typed.value.length - 1) historyIndex++
    input.value = typed.value[typed.value.length - 1 - historyIndex] ?? ''
  }

  const historyDown = (): void => {
    if (historyIndex === -1) return
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

  const cancelInput = (): void => {
    input.value = ''
    historyIndex = -1
  }

  return {
    entries,
    input,
    busy,
    typed: computed(() => typed.value.slice()),
    run,
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
