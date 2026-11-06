<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  /** The `user@host` part of the prompt. */
  host: string
  modelValue: string
  busy?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  submit: []
  up: []
  down: []
  tab: []
  clear: []
  cancel: []
}>()

const inputElement = ref<HTMLInputElement | null>(null)

const onKeydown = (event: KeyboardEvent): void => {
  if (event.key === 'Enter') {
    event.preventDefault()
    emit('submit')
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    emit('up')
  } else if (event.key === 'ArrowDown') {
    event.preventDefault()
    emit('down')
  } else if (event.key === 'Tab') {
    event.preventDefault()
    emit('tab')
  } else if (event.ctrlKey && event.key === 'l') {
    event.preventDefault()
    emit('clear')
  } else if (event.ctrlKey && event.key === 'c') {
    event.preventDefault()
    emit('cancel')
  }
}

const onInput = (event: Event): void => {
  emit('update:modelValue', (event.target as HTMLInputElement).value)
}

const focus = (): void => inputElement.value?.focus()

defineExpose({ focus })
</script>

<template>
  <form class="prompt-line" @submit.prevent="emit('submit')">
    <label for="terminal-command" class="prompt">
      <span class="prompt-host">{{ host }}:</span>~$
    </label>
    <input
      id="terminal-command"
      ref="inputElement"
      class="terminal-input"
      type="text"
      :value="modelValue"
      :readonly="busy"
      autocomplete="off"
      autocapitalize="off"
      autocorrect="off"
      spellcheck="false"
      enterkeyhint="go"
      aria-label="Terminal command"
      @input="onInput"
      @keydown="onKeydown"
    >
  </form>
</template>

<style scoped>
.prompt-line {
  display: flex;
  align-items: baseline;
  gap: 0.5ch;
  margin: 0.75rem 0 0.25rem;
}

.prompt {
  color: var(--t-prompt);
  font-weight: 700;
  white-space: nowrap;
  flex: 0 0 auto;
}

.terminal-input {
  flex: 1 1 0;
  min-width: 0;
  background: transparent;
  border: 0;
  outline: none;
  padding: 0;
  margin: 0;
  color: #ffffff;
  caret-color: var(--t-prompt);
  font-family: inherit;
  /* 16px is the floor at which iOS Safari stops zooming the page on focus. */
  font-size: max(1rem, 16px);
  line-height: inherit;
}

.terminal-input {
  border-bottom: 1px solid transparent;
}

.terminal-input:focus-visible {
  outline: none;
  border-bottom-color: var(--t-rule);
}

/* On a phone the full user@host prompt leaves no room to type: keep the ~$. */
@media (max-width: 640px) {
  .prompt-host {
    display: none;
  }
}
</style>
