/** Tiny constructors so commands read as prose, not as object literals. */
import type { Inline, OutputBlock, Tone } from '~/types/terminal'

export const text = (value: string, tone?: Tone): OutputBlock =>
  tone === undefined ? { kind: 'text', text: value } : { kind: 'text', text: value, tone }

export const muted = (value: string): OutputBlock => text(value, 'muted')
export const info = (value: string): OutputBlock => text(value, 'info')
export const success = (value: string): OutputBlock => text(value, 'success')
export const error = (value: string): OutputBlock => text(value, 'error')

export const heading = (value: string): OutputBlock => ({ kind: 'heading', text: value })
export const rule = (): OutputBlock => ({ kind: 'rule' })
export const blank = (): OutputBlock => ({ kind: 'blank' })
export const figlet = (): OutputBlock => ({ kind: 'figlet' })

export const list = (items: Inline[][]): OutputBlock => ({ kind: 'list', items })
export const kv = (rows: { key: string, value: Inline[] }[]): OutputBlock => ({ kind: 'kv', rows })
export const link = (href: string, label?: string): OutputBlock => ({ kind: 'link', href, label: label ?? href })

export const a = (href: string, label?: string): Inline => ({ href, label: label ?? href })

/** Plain text of a block, for tests and for the sr-only fallback. */
export const inlineText = (inline: Inline): string => (typeof inline === 'string' ? inline : inline.label)

export const blockText = (block: OutputBlock): string => {
  switch (block.kind) {
    case 'text':
    case 'heading':
      return block.text
    case 'list':
      return block.items.map(item => item.map(inlineText).join(' ')).join('\n')
    case 'kv':
      return block.rows.map(row => `${row.key} ${row.value.map(inlineText).join(' ')}`).join('\n')
    case 'link':
      return `${block.label} ${block.href}`
    case 'rule':
    case 'figlet':
    case 'blank':
      return ''
  }
}

export const blocksText = (blocks: OutputBlock[]): string => blocks.map(blockText).join('\n')

/** Every href in a block list, for tests that check links are real. */
export const blockHrefs = (blocks: OutputBlock[]): string[] =>
  blocks.flatMap((block): string[] => {
    switch (block.kind) {
      case 'link':
        return [block.href]
      case 'list':
        return block.items.flat().flatMap(i => (typeof i === 'string' ? [] : [i.href]))
      case 'kv':
        return block.rows.flatMap(r => r.value.flatMap(i => (typeof i === 'string' ? [] : [i.href])))
      default:
        return []
    }
  })
