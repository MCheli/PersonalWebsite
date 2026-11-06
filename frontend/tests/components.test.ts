import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CommandBar from '~/components/CommandBar.vue'
import Figlet from '~/components/Figlet.vue'
import IdentityHeader from '~/components/IdentityHeader.vue'
import SeoContent from '~/components/SeoContent.vue'
import TerminalOutput from '~/components/TerminalOutput.vue'
import TerminalPrompt from '~/components/TerminalPrompt.vue'
import { useTerminal } from '~/composables/useTerminal'
import { content } from '~/utils/content'
import { FIGLET } from '~/utils/figlet'
import { sampleWeather } from './helpers'

const stubs = { Figlet }

describe('TerminalOutput', () => {
  it('renders links as anchors with rel=noopener noreferrer in a new tab', () => {
    const w = mount(TerminalOutput, {
      props: { blocks: [{ kind: 'link', href: 'https://github.com/MCheli', label: 'GitHub' }] },
      global: { stubs }
    })
    const a = w.get('a')
    expect(a.attributes('href')).toBe('https://github.com/MCheli')
    expect(a.attributes('target')).toBe('_blank')
    expect(a.attributes('rel')).toBe('noopener noreferrer')
    expect(a.text()).toBe('GitHub')
  })

  it('keeps site-relative links in the same tab', () => {
    const w = mount(TerminalOutput, {
      props: { blocks: [{ kind: 'kv', rows: [{ key: 'Readable', value: [{ href: '/resume', label: 'resume' }] }] }] },
      global: { stubs }
    })
    const a = w.get('a')
    expect(a.attributes('target')).toBeUndefined()
    expect(a.attributes('rel')).toBeUndefined()
  })

  it('escapes text instead of injecting HTML', () => {
    const w = mount(TerminalOutput, {
      props: { blocks: [{ kind: 'text', text: '<img src=x onerror=alert(1)>' }] },
      global: { stubs }
    })
    expect(w.find('img').exists()).toBe(false)
    expect(w.text()).toContain('<img src=x onerror=alert(1)>')
  })

  it('renders every block kind', () => {
    const w = mount(TerminalOutput, {
      props: {
        blocks: [
          { kind: 'heading', text: 'H' },
          { kind: 'text', text: 'T', tone: 'error' },
          { kind: 'rule' },
          { kind: 'list', items: [['one', { href: 'https://a.example', label: 'a' }], ['two']] },
          { kind: 'kv', rows: [{ key: 'k', value: ['v'] }] },
          { kind: 'blank' },
          { kind: 'figlet' }
        ]
      },
      global: { stubs }
    })
    expect(w.get('h3').text()).toBe('H')
    expect(w.get('p.tone-error').text()).toBe('T')
    expect(w.find('hr').exists()).toBe(true)
    expect(w.findAll('li')).toHaveLength(2)
    expect(w.get('dt').text()).toBe('k')
    expect(w.get('dd').text()).toBe('v')
    expect(w.get('pre').text()).toBe(FIGLET)
  })
})

describe('Figlet', () => {
  it('renders the art and the name as text (CSS picks one per viewport)', () => {
    const w = mount(Figlet)
    expect(w.get('pre').text()).toBe(FIGLET)
    expect(w.get('.figlet-name').text()).toBe(content.resume.basics.name)
    expect(w.attributes('aria-label')).toBe(content.resume.basics.name)
  })
})

describe('CommandBar', () => {
  it('shows the six chips with aria-labels', () => {
    const w = mount(CommandBar)
    const chips = w.findAll('button')
    expect(chips.map(c => c.text())).toEqual(['about', 'projects', 'resume', 'homelab', 'contact', 'help'])
    expect(chips[0]!.attributes('aria-label')).toBe('Run about')
    expect(w.get('nav').attributes('aria-label')).toBe('Commands')
  })

  it('clicking a chip runs the command exactly as typing it', async () => {
    const terminal = useTerminal({ content, open: () => {}, fetchWeather: () => Promise.resolve(sampleWeather) })
    const w = mount(CommandBar, { props: { onRun: (c: string) => terminal.run(c) } })
    await w.findAll('button')[1]!.trigger('click')
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(terminal.entries.value).toHaveLength(1)
    expect(terminal.entries.value[0]!.command).toBe('projects')
    const typedTerminal = useTerminal({ content, open: () => {}, fetchWeather: () => Promise.resolve(sampleWeather) })
    await typedTerminal.run('projects')
    expect(typedTerminal.entries.value[0]!.blocks).toEqual(terminal.entries.value[0]!.blocks)
  })
})

describe('TerminalPrompt', () => {
  it('has the mobile-safe attributes', () => {
    const w = mount(TerminalPrompt, { props: { host: 'user@host', modelValue: '' } })
    const input = w.get('input')
    expect(input.attributes('autocapitalize')).toBe('off')
    expect(input.attributes('autocorrect')).toBe('off')
    expect(input.attributes('spellcheck')).toBe('false')
    expect(input.attributes('enterkeyhint')).toBe('go')
    expect(input.attributes('aria-label')).toBe('Terminal command')
    expect(input.classes()).toContain('terminal-input')
  })

  it('emits the key events the terminal listens for', async () => {
    const w = mount(TerminalPrompt, { props: { host: 'user@host', modelValue: 'x' } })
    const input = w.get('input')
    await input.trigger('keydown', { key: 'Enter' })
    await input.trigger('keydown', { key: 'ArrowUp' })
    await input.trigger('keydown', { key: 'ArrowDown' })
    await input.trigger('keydown', { key: 'Tab' })
    await input.trigger('keydown', { key: 'l', ctrlKey: true })
    await input.trigger('keydown', { key: 'c', ctrlKey: true })
    expect(w.emitted('submit')).toHaveLength(1)
    expect(w.emitted('up')).toHaveLength(1)
    expect(w.emitted('down')).toHaveLength(1)
    expect(w.emitted('tab')).toHaveLength(1)
    expect(w.emitted('clear')).toHaveLength(1)
    expect(w.emitted('cancel')).toHaveLength(1)
  })

  it('emits update:modelValue on input', async () => {
    const w = mount(TerminalPrompt, { props: { host: 'user@host', modelValue: '' } })
    await w.get('input').setValue('hel')
    expect(w.emitted('update:modelValue')?.[0]).toEqual(['hel'])
  })
})

describe('IdentityHeader', () => {
  it('shows name, title with company, location and summary from resume.json', () => {
    const w = mount(IdentityHeader)
    expect(w.get('h1').text()).toBe(content.resume.basics.name)
    expect(w.text()).toContain('Director, Product Operations & Strategy')
    expect(w.text()).toContain('Onshape')
    expect(w.text()).toContain('Ashland, MA')
    expect(w.text()).toContain(content.resume.basics.summary)
  })
})

describe('SeoContent', () => {
  it('contains every project name, every service name, every work entry and the profile links', () => {
    const w = mount(SeoContent)
    const text = w.text()
    for (const p of content.projects.projects) expect(text).toContain(p.name)
    for (const c of content.catalog.categories) for (const s of c.services) expect(text).toContain(s.name)
    for (const job of content.resume.work) expect(text).toContain(job.position)
    const hrefs = w.findAll('a').map(a => a.attributes('href'))
    for (const p of content.resume.basics.profiles) expect(hrefs).toContain(p.url)
    expect(hrefs).toContain(`mailto:${content.resume.basics.email}`)
    expect(hrefs).toContain('/resume')
    expect(hrefs).toContain('/projects')
  })

  it('is hidden visually, not removed', () => {
    const w = mount(SeoContent)
    expect(w.get('section').classes()).toContain('sr-only')
  })
})
