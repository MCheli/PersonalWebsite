import catalog from '~/services.json'

type Service = {
  name: string
  url?: string
  description?: string
  repo?: string
}

type Category = {
  id: string
  title: string
  lanOnly?: boolean
  services: Service[]
}

type Catalog = {
  host: {
    name: string
    displayName: string
    hardware: string
    os: string
    kernel: string
    cpu: string
    memory: string
    stack: string
  }
  profile: {
    name: string
    title: string
    location: string
    linkedin: string
    github: string
  }
  categories: Category[]
}

const DIVIDER = '──────────────────────────────────────────────────────────────────────'

const totalServices = (c: Catalog): number =>
  c.categories.reduce((sum, cat) => sum + cat.services.length, 0)

const renderServiceCatalog = (c: Catalog): string => {
  const total = totalServices(c)
  const rule = '═'.repeat(70)
  const header = [
    rule,
    `  ${c.host.displayName} Homelab — Service Catalog`,
    `  ${total} containers · ${c.host.hardware} · ${c.host.os.replace(/ LTS$/, '')} · ${c.host.stack}`,
    rule,
    ''
  ].join('\n')

  const sections = c.categories.map(cat => {
    const lines: string[] = []
    lines.push(`▶ ${cat.title}`)
    lines.push(DIVIDER)

    const hasRepos = cat.services.some(s => s.repo)
    const hasUrls = cat.services.some(s => s.url)
    // Dynamic column width: longest URL in this category + 2 spaces, min 35
    const urlColWidth = Math.max(
      35,
      ...cat.services.map(s => (s.url?.length ?? 0) + 2)
    )

    for (const svc of cat.services) {
      const name = svc.name.padEnd(22)

      if (hasRepos) {
        // Detailed vertical layout for categories with GitHub links
        if (svc.url) {
          lines.push(`  ${name}${svc.url}`)
          if (svc.description) lines.push(`                        ${svc.description}`)
          if (svc.repo) lines.push(`                        repo: ${svc.repo}`)
        } else {
          lines.push(`  ${name}${svc.description || ''}`)
          if (svc.repo) lines.push(`                        repo: ${svc.repo}`)
        }
        lines.push('')
      } else if (hasUrls) {
        if (svc.url) {
          const urlCol = svc.url.padEnd(urlColWidth)
          lines.push(`  ${name}${urlCol}${svc.description || ''}`.trimEnd())
        } else {
          lines.push(`  ${name}${svc.description || ''}`)
        }
      } else {
        lines.push(`  ${name}${svc.description || ''}`)
      }
    }
    return lines.join('\n')
  }).join('\n\n')

  const counts = c.categories.map(cat => `${cat.services.length} ${cat.id}`).join(' · ')
  const footer = [
    '',
    DIVIDER,
    `Summary:  ${counts}  (${total} total)`,
    'Delivery: GitHub Actions → ghcr.io → Watchtower rolling restarts',
    'Security: Cloudflare (Full Strict) · LAN allowlist on *.ops · isolated nets',
    '',
    'Type a service name (plex, grafana, tallied…) to open it.',
    "Tip: run 'github' to browse all my repos, 'contact' for links."
  ].join('\n')

  return header + sections + footer
}

const findService = (c: Catalog, name: string): Service | undefined => {
  for (const cat of c.categories) {
    const match = cat.services.find(s => s.name === name)
    if (match) return match
  }
  return undefined
}

export const useTerminal = () => {
  const history = ref<string[]>([])
  const currentCommand = ref('')
  const historyIndex = ref(-1)

  const data = catalog as Catalog

  const shortcuts: Record<string, string> = {
    linkedin: data.profile.linkedin,
    github: data.profile.github,
    cookbook: 'https://cookbook.markcheli.com',
    home: 'https://home.markcheli.com',
    jupyter: 'https://data.markcheli.com',
    plex: 'https://videos.markcheli.com',
    seafile: 'https://files.markcheli.com',
    minecraft: 'https://minecraft.markcheli.com',
    tallied: 'https://money.markcheli.com',
    tasks: 'https://tasks.markcheli.com',
    grafana: 'https://dashboard.ops.markcheli.com'
  }

  const commands = {
    help: {
      description: 'Show available commands',
      action: () => `Available commands:

help                    Show this help message
clear                   Clear terminal screen
whoami                  Display user information
ls                      List available services
services                List all services and infrastructure
neofetch                Display system information
weather                 Check weather in Ashland, MA
about                   About Mark Cheli
contact                 Contact information

Open shortcuts:
  linkedin, github, cookbook, home, jupyter, plex, seafile,
  minecraft, tallied, tasks, grafana

exit                    Exit terminal

Use 'help <command>' for more information about a specific command.`
    },

    clear: {
      description: 'Clear the terminal screen',
      action: () => 'CLEAR_SCREEN'
    },

    neofetch: {
      description: 'Display system information',
      action: () => `
     ███╗   ███╗ █████╗ ██████╗ ██╗  ██╗
     ████╗ ████║██╔══██╗██╔══██╗██║ ██╔╝
     ██╔████╔██║███████║██████╔╝█████╔╝
     ██║╚██╔╝██║██╔══██║██╔══██╗██╔═██╗
     ██║ ╚═╝ ██║██║  ██║██║  ██║██║  ██╗
     ╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝

      ██████╗██╗  ██╗███████╗██╗     ██╗
     ██╔════╝██║  ██║██╔════╝██║     ██║
     ██║     ███████║█████╗  ██║     ██║
     ██║     ██╔══██║██╔══╝  ██║     ██║
     ╚██████╗██║  ██║███████╗███████╗██║
      ╚═════╝╚═╝  ╚═╝╚══════╝╚══════╝╚═╝

     Development | Engineering | Strategy | Data Analysis | Operations
     ────────────────────────────────────────
     OS: ${data.host.os}
     Host: ${data.host.hardware}
     Kernel: ${data.host.kernel}
     CPU: ${data.host.cpu}
     Memory: ${data.host.memory}
     ────────────────────────────────────────
     Services: ${totalServices(data)} containers running
     Status: Operational
     ────────────────────────────────────────`
    },

    whoami: {
      description: 'Display current user information',
      action: () => `mark-cheli
Developer | Software Engineer | Infrastructure Enthusiast
Location: ${data.profile.location}
Status: Building cool things`
    },

    ls: {
      description: 'List available services',
      action: () => `total ${data.categories.length + 3}
drwxr-xr-x  2 mark users  4096 services/
drwxr-xr-x  2 mark users  4096 infrastructure/
-rw-r--r--  1 mark users   256 profile.json
-rw-r--r--  1 mark users   128 weather.api
-rw-r--r--  1 mark users   512 links.txt
-rw-r--r--  1 mark users    64 contact.info

Use 'services' to view all available services and infrastructure.`
    },

    about: {
      description: 'About Mark Cheli',
      action: () => `I'm Mark Cheli. I live in ${data.profile.location} and work at PTC
on Onshape, the SaaS-native CAD platform PTC acquired in 2019.
Before Onshape I worked across PTC's IoT (ThingWorx), CAD (Creo),
PLM (Windchill), and Academic Programs groups.

I'm the director of Onshape's Product Operations & Strategy
team. Day to day that's a mix of product-led growth, internal
AI adoption, product analytics, the operating cadence the org
runs on, and shipping full-stack code on early-stage initiatives
where speed beats handoff.

This site runs on a Dell PowerEdge R630 in my basement. Type
'services' for the catalog of what's on it, 'github' for code,
'linkedin' to connect.`
    },

    contact: {
      description: 'Contact information',
      action: () => {
        const lines: string[] = []
        lines.push('Contact Information:')
        lines.push('')
        lines.push('Professional:')
        lines.push(`  LinkedIn: ${data.profile.linkedin}`)
        lines.push(`  GitHub:   ${data.profile.github}`)
        lines.push('')
        lines.push('Public Services:')
        for (const cat of data.categories) {
          if (cat.lanOnly) continue
          for (const svc of cat.services) {
            if (!svc.url) continue
            const label = svc.name.padEnd(20)
            lines.push(`  ${label}${svc.url}`)
          }
        }
        lines.push('')
        lines.push('Infrastructure:')
        lines.push('  All services are self-hosted on my homelab infrastructure')
        lines.push('  Built with Docker, NGINX, Cloudflare, and GitHub Actions')
        return lines.join('\n')
      }
    }
  } as const

  const executeCommand = async (command: string): Promise<string> => {
    const cmd = command.toLowerCase().trim()

    if (commands[cmd]) return commands[cmd].action()

    if (shortcuts[cmd]) {
      window.open(shortcuts[cmd], '_blank')
      return `Opening ${cmd}...`
    }

    if (cmd === 'services') return renderServiceCatalog(data)

    if (cmd === 'weather') {
      try {
        const weather = await $fetch('https://flask.markcheli.com/weather')
        return `Weather in ${weather.location}:

Temperature: ${weather.temperature}°F (feels like ${weather.feels_like}°F)
Conditions: ${weather.description}
Humidity: ${weather.humidity}%
Wind Speed: ${weather.wind_speed} mph

Data source: ${weather.source}
Last updated: ${new Date(weather.timestamp).toLocaleString()}`
      } catch (error) {
        return 'Error: Unable to fetch weather information'
      }
    }

    if (cmd === 'exit') return 'Thanks for visiting! Feel free to explore my services.'

    if (cmd.startsWith('help ')) {
      const helpCmd = cmd.substring(5)
      if (commands[helpCmd]) return `${helpCmd}: ${commands[helpCmd].description}`
      return `Unknown command: ${helpCmd}`
    }

    // Unknown command — check if it matches a catalog service name for a hint
    const svc = findService(data, cmd)
    if (svc && svc.url) {
      window.open(svc.url.startsWith('http') ? svc.url : `https://${svc.url}`, '_blank')
      return `Opening ${cmd}...`
    }

    return `Command not found: ${command}

Type 'help' to see available commands.`
  }

  const addToHistory = (command: string) => {
    if (command.trim() && history.value[history.value.length - 1] !== command) {
      history.value.push(command)
    }
    historyIndex.value = -1
  }

  const navigateHistory = (direction: 'up' | 'down') => {
    if (direction === 'up' && historyIndex.value < history.value.length - 1) {
      historyIndex.value++
    } else if (direction === 'down' && historyIndex.value > -1) {
      historyIndex.value--
    }

    if (historyIndex.value >= 0) {
      currentCommand.value = history.value[history.value.length - 1 - historyIndex.value]
    } else {
      currentCommand.value = ''
    }
  }

  const getCommandCompletions = (partial: string): string[] => {
    const allCommands = [
      ...Object.keys(commands),
      ...Object.keys(shortcuts),
      'services',
      'weather',
      'exit'
    ]
    return allCommands.filter(cmd => cmd.startsWith(partial.toLowerCase()))
  }

  const getTabCompletion = (input: string): string => {
    const parts = input.trim().split(' ')
    const partial = parts[parts.length - 1]

    if (parts.length === 1) {
      const completions = getCommandCompletions(partial)
      if (completions.length === 1) return completions[0]
      if (completions.length > 1) {
        return completions.reduce((acc, cmd) => {
          let i = 0
          while (i < acc.length && i < cmd.length && acc[i] === cmd[i]) i++
          return acc.substring(0, i)
        })
      }
    }
    return input
  }

  return {
    history,
    currentCommand,
    executeCommand,
    addToHistory,
    navigateHistory,
    getTabCompletion,
    commands: Object.keys(commands)
  }
}
