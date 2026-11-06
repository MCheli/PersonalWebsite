<script setup lang="ts">
/** Tappable chips that run a command exactly as typing it would. */
withDefaults(defineProps<{ commands?: string[], disabled?: boolean }>(), {
  commands: () => ['about', 'projects', 'resume', 'homelab', 'contact', 'help'],
  disabled: false
})

const emit = defineEmits<{ run: [command: string] }>()
</script>

<template>
  <nav class="command-bar" aria-label="Commands">
    <button
      v-for="command in commands"
      :key="command"
      type="button"
      class="chip"
      :disabled="disabled"
      :aria-label="`Run ${command}`"
      @click="emit('run', command)"
    >
      {{ command }}
    </button>
  </nav>
</template>

<style scoped>
.command-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.5rem 0;
}

.chip {
  font: inherit;
  font-size: 0.95rem;
  color: var(--t-prompt);
  background: var(--t-chip-bg);
  border: 1px solid var(--t-chip-border);
  border-radius: 999px;
  padding: 0.3rem 0.85rem;
  cursor: pointer;
  line-height: 1.2;
}

.chip:hover {
  border-color: var(--t-prompt);
}

.chip:focus-visible {
  outline: 2px solid var(--t-link);
  outline-offset: 2px;
}

.chip:disabled {
  opacity: 0.5;
  cursor: default;
}

/* On a phone the bar is pinned to the bottom of the screen so a command is
   always one tap away; pages/index.vue pads the page by its height. */
@media (max-width: 640px) {
  .command-bar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 2;
    margin: 0;
    padding: 0.6rem var(--t-pad);
    padding-bottom: calc(0.6rem + env(safe-area-inset-bottom, 0px));
    background: var(--t-bg);
    border-top: 1px solid var(--t-rule);
    gap: 0.4rem;
  }

  /* Fade the output into the bar so a line under its edge reads as "scroll", not "cut". */
  .command-bar::before {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: 100%;
    height: 1.5rem;
    background: linear-gradient(to top, var(--t-bg), transparent);
    pointer-events: none;
  }

  .chip {
    flex: 0 0 auto;
    font-size: 0.95rem;
    padding: 0.4rem 0.8rem;
  }
}

@media print {
  .command-bar {
    display: none;
  }
}
</style>
