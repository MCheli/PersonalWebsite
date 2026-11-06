import { describe, expect, it, vi } from 'vitest'
import { useTerminal } from '~/composables/useTerminal'
import { content } from '~/utils/content'
import { sampleWeather } from './helpers'

const make = () => {
  const open = vi.fn<(url: string) => void>()
  const terminal = useTerminal({
    content,
    open,
    fetchWeather: () => Promise.resolve(sampleWeather),
    typingDelay: 0
  })
  return { terminal, open }
}

describe('useTerminal', () => {
  it('starts empty', () => {
    const { terminal } = make()
    expect(terminal.entries.value).toEqual([])
    expect(terminal.input.value).toBe('')
    expect(terminal.busy.value).toBe(false)
  })

  it('run records the command and its blocks and clears the input', async () => {
    const { terminal } = make()
    terminal.input.value = 'whoami'
    await terminal.run(terminal.input.value)
    expect(terminal.entries.value).toHaveLength(1)
    expect(terminal.entries.value[0]!.command).toBe('whoami')
    expect(terminal.entries.value[0]!.blocks.length).toBeGreaterThan(0)
    expect(terminal.input.value).toBe('')
    expect(terminal.typed.value).toEqual(['whoami'])
  })

  it('empty Enter adds nothing to history and opens nothing', async () => {
    const { terminal, open } = make()
    await terminal.run('')
    await terminal.run('   ')
    expect(terminal.entries.value).toEqual([])
    expect(terminal.typed.value).toEqual([])
    expect(open).not.toHaveBeenCalled()
    expect(window.open).not.toHaveBeenCalled()
  })

  it('clear empties the screen and is not itself recorded as an entry', async () => {
    const { terminal } = make()
    await terminal.run('help')
    await terminal.run('about')
    expect(terminal.entries.value).toHaveLength(2)
    await terminal.run('clear')
    expect(terminal.entries.value).toEqual([])
    // but it is in the typed history
    expect(terminal.typed.value).toEqual(['help', 'about', 'clear'])
  })

  it('clearScreen (Ctrl+L) empties the screen without touching history', async () => {
    const { terminal } = make()
    await terminal.run('help')
    terminal.clearScreen()
    expect(terminal.entries.value).toEqual([])
    expect(terminal.typed.value).toEqual(['help'])
  })

  it('print adds output with no command (the banner)', () => {
    const { terminal } = make()
    terminal.print([{ kind: 'text', text: 'hello' }])
    expect(terminal.entries.value[0]).toEqual({ command: '', blocks: [{ kind: 'text', text: 'hello' }] })
    expect(terminal.typed.value).toEqual([])
  })

  it('does not record the same command twice in a row', async () => {
    const { terminal } = make()
    await terminal.run('help')
    await terminal.run('help')
    expect(terminal.typed.value).toEqual(['help'])
    expect(terminal.entries.value).toHaveLength(2)
  })

  it('a bare service name opens it through the injected open', async () => {
    const { terminal, open } = make()
    await terminal.run('grafana')
    expect(open).toHaveBeenCalledWith('https://dashboard.ops.markcheli.com')
  })

  describe('history navigation', () => {
    it('Up walks back, Down walks forward and restores the draft', async () => {
      const { terminal } = make()
      await terminal.run('help')
      await terminal.run('about')
      terminal.input.value = 'dra'
      terminal.historyUp()
      expect(terminal.input.value).toBe('about')
      terminal.historyUp()
      expect(terminal.input.value).toBe('help')
      terminal.historyUp()
      expect(terminal.input.value).toBe('help')
      terminal.historyDown()
      expect(terminal.input.value).toBe('about')
      terminal.historyDown()
      expect(terminal.input.value).toBe('dra')
      terminal.historyDown()
      expect(terminal.input.value).toBe('dra')
    })

    it('Up with no history does nothing', () => {
      const { terminal } = make()
      terminal.input.value = 'x'
      terminal.historyUp()
      expect(terminal.input.value).toBe('x')
    })
  })

  describe('tab completion', () => {
    it('completes a unique command and adds a space', () => {
      const { terminal } = make()
      terminal.input.value = 'neo'
      expect(terminal.complete()).toEqual(['neofetch'])
      expect(terminal.input.value).toBe('neofetch ')
    })

    it('completes to the common prefix when ambiguous', () => {
      const { terminal } = make()
      terminal.input.value = 'ta'
      const matches = terminal.complete()
      expect(matches).toEqual(['tallied', 'tallied-demo', 'tasks', 'tasks-demo'])
      expect(terminal.input.value).toBe('ta')
      terminal.input.value = 'tal'
      terminal.complete()
      expect(terminal.input.value).toBe('tallied')
    })

    it('completes project slugs after "projects"', () => {
      const { terminal } = make()
      terminal.input.value = 'projects rig'
      terminal.complete()
      expect(terminal.input.value).toBe('projects rigready ')
    })

    it('completes command names after "help"', () => {
      const { terminal } = make()
      terminal.input.value = 'help wea'
      terminal.complete()
      expect(terminal.input.value).toBe('help weather ')
    })

    it('leaves unknown input alone', () => {
      const { terminal } = make()
      terminal.input.value = 'zzz'
      expect(terminal.complete()).toEqual([])
      expect(terminal.input.value).toBe('zzz')
      terminal.input.value = ''
      expect(terminal.complete()).toEqual([])
    })
  })

  describe('deep links (?cmd=)', () => {
    it('types and runs a known command', async () => {
      const { terminal } = make()
      expect(await terminal.runDeepLink('about')).toBe(true)
      expect(terminal.entries.value).toHaveLength(1)
      expect(terminal.entries.value[0]!.command).toBe('about')
    })

    it('accepts arguments', async () => {
      const { terminal } = make()
      await terminal.runDeepLink('projects tallied')
      expect(terminal.entries.value[0]!.command).toBe('projects tallied')
    })

    it('ignores an unknown command', async () => {
      const { terminal, open } = make()
      expect(await terminal.runDeepLink('rm -rf')).toBe(false)
      expect(await terminal.runDeepLink('plex')).toBe(false)
      expect(terminal.entries.value).toEqual([])
      expect(open).not.toHaveBeenCalled()
    })
  })

  it('cancelInput (Ctrl+C) clears the line', () => {
    const { terminal } = make()
    terminal.input.value = 'half typed'
    terminal.cancelInput()
    expect(terminal.input.value).toBe('')
  })
})
