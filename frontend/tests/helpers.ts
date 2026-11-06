import { vi } from 'vitest'
import type { SiteContent } from '~/types/content'
import type { CommandContext, Weather } from '~/types/terminal'
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
  fetchWeather: vi.fn<() => Promise<Weather>>(() => Promise.resolve(sampleWeather)),
  ...overrides
})
