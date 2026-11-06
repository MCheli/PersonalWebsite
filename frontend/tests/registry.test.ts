import { describe, expect, it } from 'vitest'
import { blockHrefs, blocksText } from '~/commands/blocks'
import { execute, parseInput } from '~/commands/execute'
import {
  commandNames,
  commands,
  completions,
  deepLinkCommands,
  findCommand,
  levenshtein,
  suggest,
  tourCommands
} from '~/commands/registry'
import registryJson from '~/commands/registry.json'
import registryRaw from '~/commands/registry.json?raw'
import { content } from '~/utils/content'
import { makeContext, scriptedContext } from './helpers'

const EXPECTED = ['help', 'about', 'resume', 'projects', 'homelab', 'now', 'contact', 'message', 'open', 'neofetch', 'whoami', 'weather', 'clear', 'history', 'ls', 'exit']

/** Answers that satisfy the interactive `message` command when a loop runs every command. */
const ANSWERS = ['Test Visitor', 'visitor@example.com', 'A message long enough to pass.']

describe('registry', () => {
  it('lists every command from PRODUCT.md, in help order', () => {
    expect(commands.map(c => c.name)).toEqual(EXPECTED)
  })

  it('has unique names and aliases', () => {
    const names = commandNames()
    expect(new Set(names).size).toBe(names.length)
  })

  it('every command has a one-line description', () => {
    for (const c of commands) expect(c.description.length, c.name).toBeGreaterThan(5)
  })

  it('every command produces blocks for a plain invocation', async () => {
    for (const c of commands) {
      const ctx = scriptedContext(ANSWERS)
      const out = await c.run([], ctx)
      expect(Array.isArray(out), c.name).toBe(true)
      if (c.name !== 'clear') expect(out.length, c.name).toBeGreaterThan(0)
    }
  })

  it('findCommand resolves names and aliases case-insensitively', () => {
    expect(findCommand('homelab')?.name).toBe('homelab')
    expect(findCommand('services')?.name).toBe('homelab')
    expect(findCommand('?')?.name).toBe('help')
    expect(findCommand('HELP')?.name).toBe('help')
    expect(findCommand('nope')).toBeUndefined()
  })

  it('deepLink and tour sets are subsets of the registry', () => {
    const names = commands.map(c => c.name)
    for (const n of deepLinkCommands()) expect(names).toContain(n)
    for (const n of tourCommands()) expect(names).toContain(n)
    expect(deepLinkCommands()).toContain('about')
    expect(deepLinkCommands()).not.toContain('clear')
  })

  it('registry.json matches the registry exports', () => {
    expect(registryJson.tour).toEqual(tourCommands())
    expect(registryJson.deepLink).toEqual(deepLinkCommands())
  })

  it('registry.json on disk is valid JSON that matches too (not a stale import)', () => {
    const onDisk = JSON.parse(registryRaw) as { tour: string[], deepLink: string[] }
    expect(onDisk.tour).toEqual(tourCommands())
    expect(onDisk.deepLink).toEqual(deepLinkCommands())
  })
})

describe('completions and suggestions', () => {
  it('completes command names, aliases and open targets', () => {
    expect(completions('he', content)).toEqual(['help'])
    expect(completions('ser', content)).toEqual(['services'])
    expect(completions('tall', content)).toEqual(['tallied', 'tallied-demo'])
    expect(completions('link', content)).toEqual(['linkedin'])
  })

  it('returns nothing for an unknown prefix', () => {
    expect(completions('zzz', content)).toEqual([])
  })

  it('levenshtein is a real edit distance', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3)
    expect(levenshtein('', 'abc')).toBe(3)
    expect(levenshtein('same', 'same')).toBe(0)
  })

  it('suggest finds the closest command within edit distance 2', () => {
    expect(suggest('projetcs')).toBe('projects')
    expect(suggest('hepl')).toBe('help')
    expect(suggest('resum')).toBe('resume')
    expect(suggest('completelywrong')).toBeUndefined()
  })
})

describe('execute', () => {
  it('parses the first word as the command and the rest as args', () => {
    expect(parseInput('  projects   tallied ')).toEqual({ name: 'projects', args: ['tallied'] })
    expect(parseInput('')).toBeUndefined()
    expect(parseInput('   ')).toBeUndefined()
  })

  it('empty input is a no-op: no output, nothing opened', async () => {
    const ctx = makeContext()
    expect(await execute('', ctx)).toEqual([])
    expect(await execute('   ', ctx)).toEqual([])
    expect(ctx.open).not.toHaveBeenCalled()
    expect(window.open).not.toHaveBeenCalled()
  })

  it('unknown command says so and suggests the closest one', async () => {
    const text = blocksText(await execute('projetcs', makeContext()))
    expect(text).toContain('command not found: projetcs')
    expect(text).toContain("did you mean 'projects'?")
  })

  it('unknown command with no close match points at help', async () => {
    const text = blocksText(await execute('xyzzyplugh', makeContext()))
    expect(text).toContain('command not found: xyzzyplugh')
    expect(text).toContain("'help'")
    expect(text).not.toContain('did you mean')
  })

  it('a bare service name opens its url', async () => {
    const ctx = makeContext()
    const out = await execute('plex', ctx)
    expect(ctx.open).toHaveBeenCalledWith('https://videos.markcheli.com')
    expect(blocksText(out)).toContain('Opening')
  })

  it('a bare project slug opens its url', async () => {
    const ctx = makeContext()
    await execute('rigready', ctx)
    expect(ctx.open).toHaveBeenCalledWith('https://rigready.io')
  })

  it('a service url without a scheme gets https://', async () => {
    const ctx = makeContext()
    await execute('minecraft', ctx)
    expect(ctx.open).toHaveBeenCalledWith('https://minecraft.markcheli.com:25565')
  })

  it('commands are case-insensitive', async () => {
    const text = blocksText(await execute('WHOAMI', makeContext()))
    expect(text).toContain(content.resume.basics.name)
  })

  it('never prints the banned fake strings or job-hunt wording', async () => {
    const banned = ['Last login', 'Status: Operational', 'local-machine', 'drwxr-xr-x', 'Open to', 'open to roles', 'hire me', 'for hire']
    for (const c of commands) {
      const ctx = scriptedContext(ANSWERS, { history: ['help', 'about'] })
      const text = blocksText(await c.run([], ctx))
      for (const phrase of banned) expect(text, `${c.name} prints "${phrase}"`).not.toContain(phrase)
    }
    for (const c of ['help help', 'projects all', 'projects tallied', 'open', 'open github']) {
      const text = blocksText(await execute(c, makeContext()))
      for (const phrase of banned) expect(text, `${c} prints "${phrase}"`).not.toContain(phrase)
    }
  })

  it('every link a command prints is absolute, a mailto, or a site path', async () => {
    for (const c of commands) {
      const hrefs = blockHrefs(await c.run([], scriptedContext(ANSWERS)))
      for (const href of hrefs) {
        expect(href, `${c.name}: ${href}`).toMatch(/^(https?:\/\/|mailto:|\/)/)
      }
    }
  })
})
