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

/* On a phone the bar sits above the keyboard so a command is always one tap away. */
@media (max-width: 640px) {
  .command-bar {
    position: sticky;
    bottom: 0;
    z-index: 2;
    margin: 0 calc(-1 * var(--t-pad));
    padding: 0.6rem var(--t-pad);
    padding-bottom: calc(0.6rem + env(safe-area-inset-bottom, 0px));
    background: var(--t-bg);
    border-top: 1px solid var(--t-rule);
    gap: 0.4rem;
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
