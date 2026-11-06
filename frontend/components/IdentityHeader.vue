<script setup lang="ts">
/**
 * The first screen's answer to "who is this?": visible, server-rendered,
 * read from resume.json. The terminal is the personality; this is the point.
 */
import { content, locationLine } from '~/utils/content'

const { basics } = content.resume
const location = locationLine(content.resume)
</script>

<template>
  <header class="identity">
    <h1 class="identity-name">
      {{ basics.name }}
    </h1>
    <p class="identity-title">
      {{ basics.label }} · {{ location }}
    </p>
    <p class="identity-summary">
      {{ basics.summary }}
    </p>
  </header>
</template>

<style scoped>
.identity {
  margin: 0 0 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--t-rule);
  max-width: 72ch;
}

.identity-name {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: #ffffff;
}

.identity-title {
  margin: 0.15rem 0 0.5rem;
  color: var(--t-prompt);
}

.identity-summary {
  margin: 0;
  color: var(--t-output);
}
</style>
