/**
 * The two calls the terminal makes to the Flask API, behind a tiny fetcher
 * interface so the composable and the commands never see ofetch types and
 * tests can hand in a plain function.
 */
import type { ContactMessage, SendResult, Weather } from '~/types/terminal'

export interface FetchOptions {
  method?: 'GET' | 'POST'
  body?: Record<string, unknown>
}

export type Fetcher = (url: string, options?: FetchOptions) => Promise<unknown>

export interface Api {
  fetchWeather: () => Promise<Weather>
  sendMessage: (message: ContactMessage) => Promise<SendResult>
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/** What ofetch throws on a non-2xx: a status on `response`, the JSON body on `data`. */
const failure = (err: unknown): SendResult => {
  const result: { ok: false, status?: number, error?: string } = { ok: false }
  if (isRecord(err)) {
    const response = err.response
    if (isRecord(response) && typeof response.status === 'number') result.status = response.status
    const data = err.data
    if (isRecord(data) && typeof data.error === 'string' && data.error.length > 0) result.error = data.error
  }
  return result
}

export const createApi = (fetcher: Fetcher, apiBase: string): Api => {
  const base = apiBase.replace(/\/$/, '')
  return {
    fetchWeather: async () => (await fetcher(`${base}/weather`)) as Weather,
    sendMessage: async message => {
      try {
        await fetcher(`${base}/contact`, { method: 'POST', body: { ...message } })
        return { ok: true }
      } catch (err) {
        return failure(err)
      }
    }
  }
}
