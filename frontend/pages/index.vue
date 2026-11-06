<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useHead, useRoute, useRuntimeConfig } from '#imports'
import { neofetchBlocks } from '~/commands/system'
import TerminalPrompt from '~/components/TerminalPrompt.vue'
import { useTerminal } from '~/composables/useTerminal'
import type { Weather } from '~/types/terminal'
import { content } from '~/utils/content'
import { homeJsonLd } from '~/utils/jsonld'
import { pageHead } from '~/utils/seo'

const route = useRoute()
const config = useRuntimeConfig()

useHead({
  ...pageHead(content.resume, { path: '/' }),
  script: [{ type: 'application/ld+json', innerHTML: JSON.stringify(homeJsonLd(content.resume)) }]
})

const promptHost = `user@${content.catalog.host.name}`

const fetchWeather = (): Promise<Weather> => $fetch<Weather>(`${config.public.apiBase}/weather`)

const reducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const terminal = useTerminal({
  content,
  open: url => {
    window.open(url, '_blank', 'noopener,noreferrer')
  },
  fetchWeather,
  typingDelay: reducedMotion() ? 0 : 45
})
const { entries, input, busy } = terminal

// The banner is part of the first screen, so it is in the SSR HTML too.
terminal.print(neofetchBlocks(content))

const prompt = ref<InstanceType<typeof TerminalPrompt> | null>(null)
const ready = ref(false)

const scrollToEnd = async (): Promise<void> => {
  await nextTick()
  window.scrollTo(0, document.documentElement.scrollHeight)
}

const submit = async (): Promise<void> => {
  if (busy.value) return
  await terminal.run(input.value)
  await scrollToEnd()
}

const runChip = async (command: string): Promise<void> => {
  if (busy.value) return
  await terminal.run(command)
  prompt.value?.focus()
  await scrollToEnd()
}

const onTab = (): void => {
  terminal.complete()
}

// Clicking anywhere focuses the input, unless the visitor is selecting text to copy.
const focusOnClick = (): void => {
  const selection = window.getSelection()
  if (selection !== null && selection.toString().length > 0) return
  if (document.activeElement instanceof HTMLButtonElement || document.activeElement instanceof HTMLAnchorElement) return
  prompt.value?.focus()
}

onMounted(async () => {
  document.addEventListener('mouseup', focusOnClick)
  prompt.value?.focus()

  const cmd = route.query.cmd
  if (typeof cmd === 'string' && cmd.trim().length > 0) {
    await terminal.runDeepLink(cmd)
    await scrollToEnd()
  }
  ready.value = true
})

onUnmounted(() => {
  document.removeEventListener('mouseup', focusOnClick)
})
</script>

<template>
  <div class="terminal" :data-tour-ready="ready ? 'true' : undefined">
    <IdentityHeader />
    <SeoContent />

    <section class="screen" aria-live="polite" aria-label="Terminal output">
      <article v-for="(entry, i) in entries" :key="i" class="entry">
        <div v-if="entry.command" class="entry-command">
          <span class="entry-prompt">{{ promptHost }}:~$</span>
          <span class="entry-text">{{ entry.command }}</span>
        </div>
        <TerminalOutput :blocks="entry.blocks" />
      </article>
    </section>

    <TerminalPrompt
      ref="prompt"
      v-model="input"
      :host="promptHost"
      :busy="busy"
      @submit="submit"
      @up="terminal.historyUp"
      @down="terminal.historyDown"
      @tab="onTab"
      @clear="terminal.clearScreen"
      @cancel="terminal.cancelInput"
    />

    <CommandBar :disabled="busy" @run="runChip" />
  </div>
</template>

<style scoped>
.terminal {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding-top: 1rem;
}

/* On a phone the prompt and the command bar sit at the bottom of the viewport. */
@media (max-width: 640px) {
  .screen {
    flex: 1;
  }
}

.entry {
  margin-bottom: 0.75rem;
}

.entry-command {
  margin-bottom: 0.25rem;
  overflow-wrap: anywhere;
}

.entry-prompt {
  color: var(--t-prompt);
  font-weight: 700;
}

.entry-text {
  color: #ffffff;
  margin-left: 0.5ch;
}
</style>
