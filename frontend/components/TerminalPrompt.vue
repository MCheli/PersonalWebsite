<script setup lang="ts">
import { ref } from 'vue'
import PromptSegments from '~/components/PromptSegments.vue'

defineProps<{
  /** The user segment of the prompt. */
  user: string
  /** The host (directory segment) of the prompt. */
  host: string
  modelValue: string
  busy?: boolean
  /** A question label that replaces the prompt while a command waits for an answer. */
  label?: string
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
  <form class="prompt-line" :class="{ 'prompt-line-question': label }" @submit.prevent="emit('submit')">
    <!-- Two lines, as Powerlevel10k draws it: the segments, then the caret and the input.
         While a command is asking a question, the question label takes the whole prompt. -->
    <label for="terminal-command" class="prompt">
      <template v-if="label"><span class="prompt-question">{{ label }}</span></template>
      <template v-else>
        <PromptSegments :user="user" :host="host" />
        <span class="prompt-caret" aria-hidden="true">❯</span>
      </template>
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
  display: grid;
  grid-template-columns: max-content 1fr;
  grid-template-areas:
    'segments segments'
    'caret input';
  align-items: baseline;
  column-gap: 0.5ch;
  margin: 0.75rem 0 0.25rem;
}

.prompt {
  display: contents;
}

.prompt :deep(.segments) {
  grid-area: segments;
  margin-bottom: 0.15rem;
}

.prompt-caret {
  grid-area: caret;
  color: var(--t-prompt);
  font-weight: 700;
}

/* A question (the `message` flow) is one line: "name: _". */
.prompt-line-question {
  grid-template-areas: 'caret input';
}

.prompt-question {
  grid-area: caret;
  color: var(--t-question);
  font-weight: 700;
  white-space: nowrap;
}

.terminal-input {
  grid-area: input;
  min-width: 0;
  background: transparent;
  border: 0;
  border-bottom: 1px solid transparent;
  outline: none;
  padding: 0;
  margin: 0;
  color: var(--t-command);
  caret-color: var(--t-prompt);
  font-family: inherit;
  /* 16px is the floor at which iOS Safari stops zooming the page on focus. */
  font-size: max(1rem, 16px);
  line-height: inherit;
}

.terminal-input:focus-visible {
  outline: none;
  border-bottom-color: var(--t-rule);
}
</style>
