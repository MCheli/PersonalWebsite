import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useTerminal } from '~/composables/useTerminal'

global.$fetch = vi.fn()

describe('useTerminal', () => {
  const {
    executeCommand,
    addToHistory,
    navigateHistory,
    getTabCompletion,
    history,
    currentCommand
  } = useTerminal()

  beforeEach(() => {
    history.value = []
    currentCommand.value = ''
    vi.clearAllMocks()
  })

  describe('help', () => {
    it('lists available commands', async () => {
      const result = await executeCommand('help')
      expect(result).toContain('Available commands:')
      expect(result).toContain('services')
      expect(result).toContain('whoami')
      expect(result).toContain('clear')
    })

    it('shows description for a specific command', async () => {
      const result = await executeCommand('help neofetch')
      expect(result).toContain('neofetch: Display system information')
    })

    it('reports unknown command for help on unknown command', async () => {
      const result = await executeCommand('help unknown')
      expect(result).toContain('Unknown command: unknown')
    })
  })

  describe('clear', () => {
    it('returns CLEAR_SCREEN sentinel', async () => {
      const result = await executeCommand('clear')
      expect(result).toBe('CLEAR_SCREEN')
    })
  })

  describe('neofetch', () => {
    it('includes host system details sourced from services.json', async () => {
      const result = await executeCommand('neofetch')
      expect(result).toContain('OS: Ubuntu 24.04.3 LTS')
      expect(result).toContain('Host: Dell PowerEdge R630')
      expect(result).toContain('Status: Operational')
    })

    it('reports a container count consistent with the catalog', async () => {
      const result = await executeCommand('neofetch')
      // Pulled from services.json, not hardcoded — so we just check shape
      expect(result).toMatch(/Services: \d+ containers running/)
    })
  })

  describe('whoami', () => {
    it('returns user identity', async () => {
      const result = await executeCommand('whoami')
      expect(result).toContain('mark-cheli')
      expect(result).toContain('Developer')
      expect(result).toContain('Ashland, MA')
    })
  })

  describe('ls', () => {
    it('shows directory listing and hint', async () => {
      const result = await executeCommand('ls')
      expect(result).toContain('services/')
      expect(result).toContain('infrastructure/')
      expect(result).toContain("'services'")
    })
  })

  describe('about', () => {
    it('describes Mark Cheli', async () => {
      const result = await executeCommand('about')
      expect(result).toContain('Mark Cheli')
      expect(result).toContain('Product Strategist & Engineering Leader')
      expect(result).toContain('Professional Focus:')
    })
  })

  describe('contact', () => {
    it('shows professional links and all public service URLs', async () => {
      const result = await executeCommand('contact')
      expect(result).toContain('https://www.linkedin.com/in/mark-cheli-0354a163/')
      expect(result).toContain('https://github.com/MCheli')
      // Driven by the catalog — confirm a few public URLs land here
      expect(result).toContain('https://www.markcheli.com')
      expect(result).toContain('https://money.markcheli.com')
      expect(result).toContain('https://videos.markcheli.com')
    })
  })

  describe('services', () => {
    it('renders the service catalog header', async () => {
      const result = await executeCommand('services')
      expect(result).toContain('83RR PowerEdge Homelab')
      expect(result).toContain('Service Catalog')
      expect(result).toContain('Dell PowerEdge R630')
    })

    it('lists every catalog section', async () => {
      const result = await executeCommand('services')
      expect(result).toContain('Custom Applications')
      expect(result).toContain('Self-Hosted Services')
      expect(result).toContain('Observability')
      expect(result).toContain('Infrastructure Containers')
      expect(result).toContain('Voice AI')
      expect(result).toContain('Isolated Deployment')
    })

    it('links to GitHub repos for each custom app', async () => {
      const result = await executeCommand('services')
      expect(result).toContain('https://github.com/MCheli/PersonalWebsite')
      expect(result).toContain('https://github.com/MCheli/cookbook')
      expect(result).toContain('https://github.com/MCheli/tallied')
      expect(result).toContain('https://github.com/MCheli/83rr-poweredge')
    })

    it('lists public service URLs', async () => {
      const result = await executeCommand('services')
      expect(result).toContain('https://www.markcheli.com')
      expect(result).toContain('https://flask.markcheli.com')
      expect(result).toContain('https://videos.markcheli.com')
      expect(result).toContain('https://money.markcheli.com')
      expect(result).toContain('minecraft.markcheli.com:25565')
    })

    it('lists LAN-only observability endpoints', async () => {
      const result = await executeCommand('services')
      expect(result).toContain('https://dashboard.ops.markcheli.com')
      expect(result).toContain('https://prometheus.ops.markcheli.com')
      expect(result).toContain('https://logs.ops.markcheli.com')
    })

    it('names infrastructure containers', async () => {
      const result = await executeCommand('services')
      expect(result).toContain('nginx')
      expect(result).toContain('fluent-bit')
      expect(result).toContain('watchtower')
      expect(result).toContain('tallied-db')
    })
  })

  describe('weather', () => {
    it('formats weather API data', async () => {
      const mockWeatherData = {
        location: 'Ashland, MA',
        temperature: 72,
        feels_like: 75,
        humidity: 65,
        description: 'Partly Cloudy',
        wind_speed: 8,
        timestamp: new Date().toISOString(),
        source: 'Demo Data'
      }
      global.$fetch.mockResolvedValue(mockWeatherData)

      const result = await executeCommand('weather')
      expect(result).toContain('Weather in Ashland, MA:')
      expect(result).toContain('Temperature: 72°F')
      expect(result).toContain('Conditions: Partly Cloudy')
      expect(result).toContain('Humidity: 65%')
      expect(result).toContain('Wind Speed: 8 mph')
    })

    it('handles API failure gracefully', async () => {
      global.$fetch.mockRejectedValue(new Error('API Error'))
      const result = await executeCommand('weather')
      expect(result).toContain('Error: Unable to fetch weather information')
    })
  })

  describe('action commands (window.open shortcuts)', () => {
    it.each([
      ['linkedin', 'https://www.linkedin.com/in/mark-cheli-0354a163/'],
      ['github', 'https://github.com/MCheli'],
      ['cookbook', 'https://cookbook.markcheli.com'],
      ['plex', 'https://videos.markcheli.com'],
      ['seafile', 'https://files.markcheli.com'],
      ['home', 'https://home.markcheli.com'],
      ['jupyter', 'https://data.markcheli.com'],
      ['minecraft', 'https://minecraft.markcheli.com'],
      ['tallied', 'https://money.markcheli.com'],
      ['tasks', 'https://tasks.markcheli.com'],
      ['grafana', 'https://dashboard.ops.markcheli.com']
    ])('opens %s in a new tab', async (cmd, url) => {
      const result = await executeCommand(cmd)
      expect(window.open).toHaveBeenCalledWith(url, '_blank')
      expect(result).toBe(`Opening ${cmd}...`)
    })
  })

  describe('exit', () => {
    it('returns a farewell', async () => {
      const result = await executeCommand('exit')
      expect(result).toContain('Thanks for visiting!')
    })
  })

  describe('unknown commands', () => {
    it('suggests help on an unknown command', async () => {
      const result = await executeCommand('not_a_real_command')
      expect(result).toContain('Command not found: not_a_real_command')
      expect(result).toContain("Type 'help'")
    })
  })

  describe('history', () => {
    it('appends commands to history', () => {
      addToHistory('help')
      addToHistory('neofetch')
      addToHistory('clear')
      expect(history.value).toEqual(['help', 'neofetch', 'clear'])
    })

    it('deduplicates consecutive identical commands', () => {
      addToHistory('help')
      addToHistory('help')
      addToHistory('neofetch')
      expect(history.value).toEqual(['help', 'neofetch'])
    })

    it('walks history up and down', () => {
      addToHistory('first')
      addToHistory('second')
      addToHistory('third')

      navigateHistory('up')
      expect(currentCommand.value).toBe('third')
      navigateHistory('up')
      expect(currentCommand.value).toBe('second')
      navigateHistory('up')
      expect(currentCommand.value).toBe('first')

      navigateHistory('down')
      expect(currentCommand.value).toBe('second')
      navigateHistory('down')
      expect(currentCommand.value).toBe('third')
      navigateHistory('down')
      expect(currentCommand.value).toBe('')
    })
  })

  describe('tab completion', () => {
    it('completes a unique prefix', () => {
      expect(getTabCompletion('neof')).toBe('neofetch')
    })

    it('returns the longest common prefix for ambiguous input', () => {
      // "s" matches "services" and "seafile" — common prefix is "se"
      expect(getTabCompletion('s')).toBe('se')
    })

    it('leaves unmatched input unchanged', () => {
      expect(getTabCompletion('zzzz')).toBe('zzzz')
    })
  })
})
