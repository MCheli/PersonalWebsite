<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useHead, useRoute, useRuntimeConfig } from '#imports'
import { neofetchBlocks } from '~/commands/system'
import TerminalPrompt from '~/components/TerminalPrompt.vue'
import { useTerminal } from '~/composables/useTerminal'
import { createApi } from '~/utils/api'
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

const api = createApi((url, options) => $fetch(url, options), config.public.apiBase)

const reducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const terminal = useTerminal({
  content,
  open: url => {
    window.open(url, '_blank', 'noopener,noreferrer')
  },
  fetchWeather: api.fetchWeather,
  sendMessage: api.sendMessage,
  typingDelay: reducedMotion() ? 0 : 45
})
const { entries, input, busy, pending } = terminal

// The banner is part of the first screen, so it is in the SSR HTML too.
terminal.print(neofetchBlocks(content))

const prompt = ref<InstanceType<typeof TerminalPrompt> | null>(null)
const barWrap = ref<HTMLElement | null>(null)
const ready = ref(false)
/** Height of the command bar when it is pinned to the bottom of a phone screen. */
const barHeight = ref<number | null>(null)
let barObserver: ResizeObserver | null = null

/** Tapping a chip on a touch screen should not pop the keyboard up. */
const coarsePointer = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

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
  if (busy.value || pending.value !== null) return
  await terminal.run(command)
  if (!coarsePointer()) prompt.value?.focus()
  await scrollToEnd()
}

const onCancel = (): void => {
  terminal.cancelInput()
  void scrollToEnd()
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
  if (!coarsePointer()) prompt.value?.focus()

  const bar = barWrap.value?.firstElementChild
  if (bar instanceof HTMLElement && typeof ResizeObserver !== 'undefined') {
    barObserver = new ResizeObserver(() => {
      // Border box, so the bar's own padding counts; 0 when it is not fixed (desktop).
      const fixed = getComputedStyle(bar).position === 'fixed'
      barHeight.value = fixed ? Math.ceil(bar.getBoundingClientRect().height) : 0
    })
    barObserver.observe(bar)
  }

  const cmd = route.query.cmd
  if (typeof cmd === 'string' && cmd.trim().length > 0) {
    await terminal.runDeepLink(cmd)
    await scrollToEnd()
  }
  ready.value = true
})

onUnmounted(() => {
  document.removeEventListener('mouseup', focusOnClick)
  barObserver?.disconnect()
})
</script>

<template>
  <div
    class="terminal"
    :style="barHeight === null ? undefined : { '--t-bar-height': `${barHeight}px` }"
    :data-tour-ready="ready ? 'true' : undefined"
  >
    <IdentityHeader />
    <SeoContent />

    <section class="screen" aria-live="polite" aria-label="Terminal output">
      <article v-for="(entry, i) in entries" :key="i" class="entry">
        <div v-if="entry.prompt" class="entry-command">
          <span class="entry-question">{{ entry.prompt }}</span>
          <span class="entry-text">{{ entry.command }}</span>
        </div>
        <div v-else-if="entry.command" class="entry-command">
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
      :label="pending?.label"
      @submit="submit"
      @up="terminal.historyUp"
      @down="terminal.historyDown"
      @tab="onTab"
      @clear="terminal.clearScreen"
      @cancel="onCancel"
    />

    <div ref="barWrap">
      <CommandBar :disabled="busy || pending !== null" @run="runChip" />
    </div>
  </div>
</template>

<style scoped>
.terminal {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding-top: 1rem;
}

/* On a phone the command bar is pinned to the bottom of the screen (see
   CommandBar.vue); reserve its height so the prompt is never under it.
   The fallback covers two rows of chips until the ResizeObserver measures. */
@media (max-width: 640px) {
  .terminal {
    --t-bar-height: 6.5rem;
    padding-bottom: calc(var(--t-bar-height) + env(safe-area-inset-bottom, 0px) + 0.5rem);
  }

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

.entry-question {
  color: var(--t-info);
  font-weight: 700;
}

.entry-text {
  color: #ffffff;
  margin-left: 0.5ch;
}
</style>
