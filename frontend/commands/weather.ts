import type { Command } from '~/types/terminal'
import { error, heading, kv, muted } from './blocks'

export const weather: Command = {
  name: 'weather',
  description: 'Current weather in Ashland, MA (from the API)',
  longDescription: 'Fetches the current conditions from the Flask API (flask.markcheli.com/weather). If the API is down it says so in one line.',
  run: async (_args, ctx) => {
    try {
      const w = await ctx.fetchWeather()
      return [
        heading(`Weather in ${w.location}`),
        kv([
          { key: 'Temperature', value: [`${w.temperature}°F (feels like ${w.feels_like}°F)`] },
          { key: 'Conditions', value: [w.description] },
          { key: 'Humidity', value: [`${w.humidity}%`] },
          { key: 'Wind', value: [`${w.wind_speed} mph`] }
        ]),
        muted(`${w.source} · ${new Date(w.timestamp).toLocaleString()}`)
      ]
    } catch {
      return [error('weather: the weather service is unavailable right now')]
    }
  }
}
