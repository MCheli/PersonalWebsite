import { vi } from 'vitest'
import type { SiteContent } from '~/types/content'
import type { CommandContext, OutputBlock, SendResult, Weather } from '~/types/terminal'
import { content as realContent } from '~/utils/content'

/** A deep copy of the real content so a test can change a value and see it rendered. */
export const cloneContent = (): SiteContent => JSON.parse(JSON.stringify(realContent)) as SiteContent

export const sampleWeather: Weather = {
  location: 'Ashland, MA',
  temperature: 61,
  feels_like: 59,
  humidity: 55,
  description: 'Overcast Clouds',
  wind_speed: 7,
  timestamp: '2026-11-05T12:00:00+00:00',
  source: 'OpenWeatherMap'
}

export const makeContext = (overrides: Partial<CommandContext> = {}): CommandContext => ({
  content: realContent,
  open: vi.fn<(url: string) => void>(),
  clear: vi.fn<() => void>(),
  history: [],
  print: vi.fn<(blocks: OutputBlock[]) => void>(),
  prompt: vi.fn<(label: string) => Promise<string>>(() => Promise.reject(new Error('no prompt in this test'))),
  fetchWeather: vi.fn<() => Promise<Weather>>(() => Promise.resolve(sampleWeather)),
  sendMessage: vi.fn<() => Promise<SendResult>>(() => Promise.resolve({ ok: true })),
  ...overrides
})

/** A context whose prompt() hands out the given answers in order (for the interactive `message`). */
export const scriptedContext = (answers: string[], overrides: Partial<CommandContext> = {}): CommandContext => {
  const queue = [...answers]
  return makeContext({
    prompt: () => {
      const next = queue.shift()
      return next === undefined ? Promise.reject(new Error('script ran out of answers')) : Promise.resolve(next)
    },
    ...overrides
  })
}

/** Options for useTerminal with every API call stubbed. */
export const terminalOptions = () => ({
  content: realContent,
  open: vi.fn<(url: string) => void>(),
  fetchWeather: vi.fn<() => Promise<Weather>>(() => Promise.resolve(sampleWeather)),
  sendMessage: vi.fn<() => Promise<SendResult>>(() => Promise.resolve({ ok: true })),
  typingDelay: 0
})
