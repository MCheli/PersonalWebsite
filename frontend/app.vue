<template>
  <div class="terminal-container">

    <!--
      SEO / AI-readable content. Rendered server-side so search engines and
      LLM crawlers without a JS runtime can read the full catalog. Visually
      hidden via CSS so it doesn't disrupt the terminal UI.
    -->
    <section class="seo-content" aria-label="Site overview for search engines and assistants">
      <h1>{{ catalog.profile.name }} — {{ catalog.profile.title }}</h1>
      <p>
        {{ catalog.profile.name }} is a developer and product strategist based in
        {{ catalog.profile.location }}. This site is an interactive terminal that
        showcases personal projects and a self-hosted homelab running
        {{ totalServices }} Docker containers on a {{ catalog.host.hardware }}
        ({{ catalog.host.os }}, {{ catalog.host.cpu }}, {{ catalog.host.memory }}).
      </p>

      <h2>About</h2>
      <p>
        Developer-turned-product strategist focused on bringing technical products to
        market. Background spans full-stack engineering, cross-functional team leadership
        (R&amp;D, PM, UX, Sales, Marketing), product-led growth, and self-hosted
        infrastructure. Past work has touched PTC's product ecosystem including
        Onshape, Creo, Windchill, and ThingWorx.
      </p>

      <h2>Contact &amp; Profiles</h2>
      <ul>
        <li>LinkedIn: <a :href="catalog.profile.linkedin">{{ catalog.profile.linkedin }}</a></li>
        <li>GitHub: <a :href="catalog.profile.github">{{ catalog.profile.github }}</a></li>
        <li>Location: {{ catalog.profile.location }}</li>
      </ul>

      <h2>Homelab Service Catalog</h2>
      <p>
        {{ totalServices }} containers across {{ catalog.categories.length }} categories,
        delivered via GitHub Actions to ghcr.io with Watchtower rolling restarts. NGINX +
        Cloudflare (Full Strict) terminate TLS; *.ops.markcheli.com is LAN-only.
      </p>

      <section v-for="cat in catalog.categories" :key="cat.id" :aria-label="cat.title">
        <h3>{{ cat.title }}</h3>
        <ul>
          <li v-for="svc in cat.services" :key="svc.name">
            <strong>{{ svc.name }}</strong>
            <template v-if="svc.url">
              — <a :href="svc.url">{{ svc.url }}</a>
            </template>
            <template v-if="svc.description"> — {{ svc.description }}</template>
            <template v-if="svc.repo">
              (repo: <a :href="svc.repo">{{ svc.repo }}</a>)
            </template>
          </li>
        </ul>
      </section>

      <h2>Infrastructure</h2>
      <dl>
        <dt>Host</dt><dd>{{ catalog.host.displayName }} — {{ catalog.host.hardware }}</dd>
        <dt>OS / Kernel</dt><dd>{{ catalog.host.os }} ({{ catalog.host.kernel }})</dd>
        <dt>CPU / Memory</dt><dd>{{ catalog.host.cpu }} · {{ catalog.host.memory }}</dd>
        <dt>Stack</dt><dd>{{ catalog.host.stack }}</dd>
      </dl>

      <p>
        This site itself (<a href="https://www.markcheli.com">markcheli.com</a>) is a Nuxt
        SSR app backed by a Flask API; both run as containers on the same homelab. Source:
        <a href="https://github.com/MCheli/PersonalWebsite">github.com/MCheli/PersonalWebsite</a>.
      </p>
    </section>

    <div class="terminal-content">
      <!-- Welcome message -->
      <div class="terminal-output">
        <span class="success-text">Welcome to Mark Cheli's Developer Terminal!</span>
        <br>
        Last login: {{ formatDate(new Date()) }} from local-machine
        <br><br>
        <span class="info-text">Type 'help' for available commands. Try 'linkedin' to connect.</span>
        <br><br>
      </div>

      <!-- Command history -->
      <div
        v-for="(entry, index) in terminalHistory"
        :key="index"
        class="terminal-output"
      >
        <div v-if="entry.command" class="command-line">
          <span class="terminal-prompt">user@83rr-poweredge:~$ </span>
          <span class="command-text">{{ entry.command }}</span>
        </div>
        <div v-if="entry.output === 'CLEAR_SCREEN'" class="clear-marker"></div>
        <div v-else-if="entry.output" class="command-output">
          <pre v-html="formatOutputWithClickableUrls(entry.output)"></pre>
        </div>
      </div>

      <!-- Current input line -->
      <div class="terminal-input-line">
        <span class="terminal-prompt">user@83rr-poweredge:~$ </span>
        <input
          ref="inputElement"
          v-model="currentInput"
          :class="['terminal-input', { 'terminal-input-focused': inputFocused }]"
          type="text"
          :readonly="isAutoTyping"
          @keydown="handleKeydown"
          @input="handleInput"
          @focus="inputFocused = true"
          @blur="inputFocused = false"
          placeholder=""
          autocomplete="off"
          spellcheck="false"
        />
      </div>

      <!-- LinkedIn suggestion -->
      <div v-if="showLinkedinSuggestion && !currentInput" class="suggestion-line">
        <span class="suggestion-text">Try: linkedin (or press Enter)</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import catalog from '~/services.json'

const { executeCommand, addToHistory, navigateHistory, currentCommand, getTabCompletion } = useTerminal()
const route = useRoute()

const totalServices = computed(() =>
  catalog.categories.reduce((sum, cat) => sum + cat.services.length, 0)
)

const terminalHistory = ref([])
const currentInput = ref('')
const inputElement = ref(null)
const inputFocused = ref(true)
const showLinkedinSuggestion = ref(true)
const isAutoTyping = ref(false)

// Simulate typing a command character by character
const simulateTyping = async (command, delayMs = 50) => {
  isAutoTyping.value = true
  showLinkedinSuggestion.value = false

  for (let i = 0; i < command.length; i++) {
    currentInput.value = command.substring(0, i + 1)
    await new Promise(resolve => setTimeout(resolve, delayMs))
  }

  // Brief pause before executing
  await new Promise(resolve => setTimeout(resolve, 200))

  // Execute the command
  addToHistory(command)
  const output = await executeCommand(command)

  if (output === 'CLEAR_SCREEN') {
    terminalHistory.value = []
  } else {
    terminalHistory.value.push({
      command,
      output,
      timestamp: new Date()
    })
  }

  currentInput.value = ''
  isAutoTyping.value = false

  await nextTick()
  window.scrollTo(0, document.body.scrollHeight)
}

// Auto-focus input when component mounts
onMounted(async () => {
  nextTick(() => {
    inputElement.value?.focus()
  })

  // Keep input focused when clicking anywhere on terminal
  document.addEventListener('click', () => {
    inputElement.value?.focus()
  })

  // Auto-run neofetch on page load (hidden from command history)
  await nextTick()
  const neofetchOutput = await executeCommand('neofetch')
  terminalHistory.value.push({
    command: '',
    output: neofetchOutput,
    timestamp: new Date()
  })

  // Check for cmd query parameter and auto-type it
  const cmdParam = route.query.cmd
  if (cmdParam && typeof cmdParam === 'string') {
    // Small delay after neofetch before typing the command
    await new Promise(resolve => setTimeout(resolve, 500))
    await simulateTyping(cmdParam)
  }
})

const formatDate = (date) => {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const formatOutputWithClickableUrls = (text) => {
  // URL regex that matches https:// URLs
  const urlRegex = /(https:\/\/[^\s]+)/g

  // Escape HTML characters first
  const escapedText = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Replace URLs with clickable links
  return escapedText.replace(urlRegex, '<a href="$1" target="_blank" class="terminal-link">$1</a>')
}

const handleInput = () => {
  // Hide LinkedIn suggestion when user starts typing
  if (currentInput.value) {
    showLinkedinSuggestion.value = false
  }
}

const handleKeydown = async (event) => {
  // Ignore input while auto-typing is in progress
  if (isAutoTyping.value) {
    event.preventDefault()
    return
  }

  if (event.key === 'Enter') {
    const command = currentInput.value.trim()

    if (command) {
      // Add command to history
      addToHistory(command)

      // Execute command
      const output = await executeCommand(command)

      // Handle special commands
      if (output === 'CLEAR_SCREEN') {
        terminalHistory.value = []
      } else {
        terminalHistory.value.push({
          command,
          output,
          timestamp: new Date()
        })
      }
    } else {
      // Empty command - execute linkedin as default
      const output = await executeCommand('linkedin')
      terminalHistory.value.push({
        command: 'linkedin',
        output,
        timestamp: new Date()
      })
    }

    // Clear input and scroll to bottom
    currentInput.value = ''

    await nextTick()
    window.scrollTo(0, document.body.scrollHeight)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    navigateHistory('up')
  } else if (event.key === 'ArrowDown') {
    event.preventDefault()
    navigateHistory('down')
  } else if (event.key === 'Tab') {
    event.preventDefault()
    const completed = getTabCompletion(currentInput.value)
    currentInput.value = completed
  } else if (event.ctrlKey && event.key === 'l') {
    // Ctrl+L to clear screen
    event.preventDefault()
    terminalHistory.value = []
  } else if (event.ctrlKey && event.key === 'c') {
    // Ctrl+C to cancel current input
    event.preventDefault()
    currentInput.value = ''
  }
}

// Watch for changes in currentCommand from composable (for history navigation)
watch(currentCommand, (newValue) => {
  currentInput.value = newValue
})
</script>

<style scoped>
/* SSR'd content for crawlers and assistive tech: in DOM, off-screen visually. */
.seo-content {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.clear-marker {
  display: none;
}

.command-line {
  margin-bottom: 5px;
}

.command-text {
  color: #ffffff;
}

.terminal-input {
  color: #ffffff;
}

.command-output {
  margin-left: 20px;
  margin-bottom: 10px;
  color: #dddddd;
}

.command-output pre {
  font-family: inherit;
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.terminal-input-line {
  display: flex;
  align-items: center;
  margin-top: 10px;
}

.terminal-input {
  flex: 1;
  margin-left: 8px;
}

.terminal-input-focused {
  caret-color: #ffffff;
}

.suggestion-line {
  margin-top: 5px;
  margin-left: 250px; /* Align with input after prompt */
}

.suggestion-text {
  color: #888;
  font-style: italic;
  font-size: 0.9em;
}

.terminal-link {
  color: inherit;
  text-decoration: none;
  cursor: default;
}

.terminal-link:hover {
  color: #4a9eff;
  text-decoration: underline;
  cursor: pointer;
}
</style>