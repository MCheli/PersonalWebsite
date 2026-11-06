import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { blockHrefs, blocksText } from '~/commands/blocks'
import { execute } from '~/commands/execute'
import { validateEmail, validateMessage, validateName } from '~/commands/message'
import CommandBar from '~/components/CommandBar.vue'
import { useTerminal } from '~/composables/useTerminal'
import type { ContactMessage, OutputBlock, SendResult } from '~/types/terminal'
import { createApi, type Fetcher } from '~/utils/api'
import { content } from '~/utils/content'
import { makeContext, scriptedContext, terminalOptions } from './helpers'

const GOOD: ContactMessage = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  message: 'I would like to talk about analytics.',
  website: ''
}

/** Let the awaiting command advance between answers. */
const tick = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0))

/** A real $fetch-shaped stub: resolves on 2xx, throws an ofetch-like error otherwise. */
const fakeFetch = (status: number, data?: unknown): Fetcher & { calls: { url: string, options?: unknown }[] } => {
  const calls: { url: string, options?: unknown }[] = []
  const fn: Fetcher = (url, options) => {
    calls.push({ url, options })
    if (status >= 200 && status < 300) return Promise.resolve(data ?? { ok: true })
    return Promise.reject(Object.assign(new Error(`[POST] ${url}: ${status}`), { response: { status }, data }))
  }
  return Object.assign(fn, { calls })
}

describe('message command (command level)', () => {
  it('prints the intro first, asks three questions, posts the answers and reports Sent', async () => {
    const printed: OutputBlock[] = []
    const labels: string[] = []
    const sendMessage = vi.fn<(m: ContactMessage) => Promise<SendResult>>(() => Promise.resolve({ ok: true }))
    const ctx = scriptedContext([GOOD.name, GOOD.email, GOOD.message], {
      print: blocks => printed.push(...blocks),
      sendMessage
    })
    const originalPrompt = ctx.prompt
    ctx.prompt = (label: string) => {
      labels.push(label)
      return originalPrompt(label)
    }
    const out = await execute('message', ctx)
    expect(blocksText(printed)).toContain('Send me a note. Ctrl+C to cancel.')
    expect(labels).toEqual(['Your name:', 'Your email:', 'Message:'])
    expect(sendMessage).toHaveBeenCalledWith(GOOD)
    expect(blocksText(out)).toBe("Sent — I'll reply to ada@example.com.")
  })

  it('re-asks the same question until the answer validates', async () => {
    const printed: OutputBlock[] = []
    const labels: string[] = []
    const ctx = scriptedContext(['', '  ', GOOD.name, 'not-an-email', 'ada@nodot', GOOD.email, 'short', GOOD.message], {
      print: blocks => printed.push(...blocks)
    })
    const originalPrompt = ctx.prompt
    ctx.prompt = (label: string) => {
      labels.push(label)
      return originalPrompt(label)
    }
    const out = await execute('message', ctx)
    expect(labels).toEqual(['Your name:', 'Your name:', 'Your name:', 'Your email:', 'Your email:', 'Your email:', 'Message:', 'Message:'])
    const hints = blocksText(printed)
    expect(hints).toContain('Please enter your name.')
    expect(hints).toContain('does not look like an email')
    expect(hints).toContain('at least 10 characters')
    expect(ctx.sendMessage).toHaveBeenCalledWith(GOOD)
    expect(blocksText(out)).toContain('Sent')
  })

  it('on a failed send never says Sent; shows the status and the email fallback', async () => {
    const ctx = scriptedContext([GOOD.name, GOOD.email, GOOD.message], {
      sendMessage: () => Promise.resolve({ ok: false, status: 503 })
    })
    const out = await execute('message', ctx)
    const text = blocksText(out)
    expect(text).not.toContain('Sent')
    expect(text).toContain("Couldn't send (503).")
    expect(text).toContain('Email me instead')
    expect(blockHrefs(out)).toContain(`mailto:${content.resume.basics.email}`)
  })

  it('prefers the API error field when the API sends one', async () => {
    const ctx = scriptedContext([GOOD.name, GOOD.email, GOOD.message], {
      sendMessage: () => Promise.resolve({ ok: false, status: 429, error: 'Too many messages, try again later.' })
    })
    const text = blocksText(await execute('message', ctx))
    expect(text).toContain('Too many messages, try again later.')
    expect(text).not.toContain("Couldn't send")
    expect(text).not.toContain('Sent')
  })

  it('a network failure (no status) is not a success either', async () => {
    const ctx = scriptedContext([GOOD.name, GOOD.email, GOOD.message], {
      sendMessage: () => Promise.resolve({ ok: false })
    })
    const text = blocksText(await execute('message', ctx))
    expect(text).toContain("Couldn't send (no response).")
    expect(text).not.toContain('Sent')
  })

  it('validators', () => {
    expect(validateName('')).toBeDefined()
    expect(validateName('  ')).toBeDefined()
    expect(validateName('Ada')).toBeUndefined()
    expect(validateEmail('ada')).toBeDefined()
    expect(validateEmail('@example.com')).toBeDefined()
    expect(validateEmail('ada@example')).toBeDefined()
    expect(validateEmail('ada @example.com')).toBeDefined()
    expect(validateEmail('ada@example.com')).toBeUndefined()
    expect(validateMessage('123456789')).toBeDefined()
    expect(validateMessage('1234567890')).toBeUndefined()
  })

  it('contact points at message', async () => {
    expect(blocksText(await execute('contact', makeContext()))).toContain("Or type 'message' to send a note from here.")
  })
})

describe('message flow through the terminal (input line)', () => {
  it('routes each Enter to the pending question, echoes the answers and posts once', async () => {
    const options = terminalOptions()
    const terminal = useTerminal(options)
    const done = terminal.run('message')
    await tick()
    expect(terminal.pending.value?.label).toBe('Your name:')
    expect(terminal.busy.value).toBe(false)
    expect(blocksText(terminal.entries.value[0]!.blocks)).toContain('Send me a note.')

    terminal.input.value = GOOD.name
    await terminal.run(terminal.input.value)
    await tick()
    expect(terminal.pending.value?.label).toBe('Your email:')
    expect(terminal.entries.value[1]).toMatchObject({ command: GOOD.name, prompt: 'Your name:' })

    await terminal.run(GOOD.email)
    await tick()
    expect(terminal.pending.value?.label).toBe('Message:')

    await terminal.run(GOOD.message)
    await done
    expect(terminal.pending.value).toBeNull()
    expect(terminal.busy.value).toBe(false)
    expect(options.sendMessage).toHaveBeenCalledTimes(1)
    expect(options.sendMessage).toHaveBeenCalledWith(GOOD)
    const last = terminal.entries.value[terminal.entries.value.length - 1]!
    expect(last).toMatchObject({ command: GOOD.message, prompt: 'Message:' })
    expect(blocksText(last.blocks)).toBe("Sent — I'll reply to ada@example.com.")
    // answers are not command history
    expect(terminal.typed.value).toEqual(['message'])
  })

  it('Ctrl+C cancels: prints Cancelled., sends nothing, frees the prompt', async () => {
    const options = terminalOptions()
    const terminal = useTerminal(options)
    const done = terminal.run('message')
    await tick()
    await terminal.run(GOOD.name)
    await tick()
    expect(terminal.pending.value?.label).toBe('Your email:')
    terminal.input.value = 'half an em'
    terminal.cancelInput()
    await done
    expect(terminal.input.value).toBe('')
    expect(terminal.pending.value).toBeNull()
    expect(terminal.busy.value).toBe(false)
    expect(options.sendMessage).not.toHaveBeenCalled()
    const last = terminal.entries.value[terminal.entries.value.length - 1]!
    expect(blocksText(last.blocks)).toBe('Cancelled.')
    // the terminal works again afterwards
    await terminal.run('whoami')
    expect(terminal.entries.value[terminal.entries.value.length - 1]!.command).toBe('whoami')
  })

  it('history navigation and tab completion are off while a question is pending', async () => {
    const terminal = useTerminal(terminalOptions())
    await terminal.run('help')
    const done = terminal.run('message')
    await tick()
    terminal.input.value = 'hel'
    terminal.historyUp()
    expect(terminal.input.value).toBe('hel')
    expect(terminal.complete()).toEqual([])
    expect(terminal.input.value).toBe('hel')
    terminal.cancelInput()
    await done
  })

  it('command bar chips are ignored while a question is pending', async () => {
    const terminal = useTerminal(terminalOptions())
    const runChip = (c: string) => {
      if (terminal.pending.value !== null) return
      void terminal.run(c)
    }
    const w = mount(CommandBar, { props: { onRun: runChip, disabled: false } })
    const done = terminal.run('message')
    await tick()
    await w.findAll('button')[0]!.trigger('click')
    await tick()
    expect(terminal.pending.value?.label).toBe('Your name:')
    expect(terminal.entries.value).toHaveLength(1)
    expect(terminal.entries.value[0]!.command).toBe('message')
    terminal.cancelInput()
    await done
    // the page also disables them: a disabled chip does not fire
    const w2 = mount(CommandBar, { props: { onRun: runChip, disabled: true } })
    expect(w2.findAll('button').every(b => b.attributes('disabled') !== undefined)).toBe(true)
  })

  it('a failed send through the terminal never shows Sent', async () => {
    const options = terminalOptions()
    options.sendMessage.mockResolvedValue({ ok: false, status: 500 })
    const terminal = useTerminal(options)
    const done = terminal.run('message')
    await tick()
    for (const answer of [GOOD.name, GOOD.email, GOOD.message]) {
      await terminal.run(answer)
      await tick()
    }
    await done
    const text = terminal.entries.value.map(e => blocksText(e.blocks)).join('\n')
    expect(text).not.toContain('Sent')
    expect(text).toContain("Couldn't send (500).")
  })
})

describe('createApi (the $fetch adapter)', () => {
  it('posts JSON to <apiBase>/contact and reports ok on 2xx', async () => {
    const fetcher = fakeFetch(200, { status: 'sent' })
    const api = createApi(fetcher, '/api')
    expect(await api.sendMessage(GOOD)).toEqual({ ok: true })
    expect(fetcher.calls).toEqual([{ url: '/api/contact', options: { method: 'POST', body: GOOD } }])
  })

  it('strips a trailing slash from the base and fetches weather from <apiBase>/weather', async () => {
    const fetcher = fakeFetch(200, { location: 'Ashland, MA' })
    const api = createApi(fetcher, 'http://localhost:5000/')
    expect((await api.fetchWeather()).location).toBe('Ashland, MA')
    expect(fetcher.calls[0]!.url).toBe('http://localhost:5000/weather')
  })

  it('maps a non-2xx to ok:false with the status and the API error field', async () => {
    const api = createApi(fakeFetch(400, { error: 'Email is required' }), '/api')
    expect(await api.sendMessage(GOOD)).toEqual({ ok: false, status: 400, error: 'Email is required' })
    const noBody = createApi(fakeFetch(502), '/api')
    expect(await noBody.sendMessage(GOOD)).toEqual({ ok: false, status: 502 })
  })

  it('maps a thrown non-HTTP error to ok:false with no status', async () => {
    const api = createApi(() => Promise.reject(new TypeError('Failed to fetch')), '/api')
    expect(await api.sendMessage(GOOD)).toEqual({ ok: false })
  })
})
