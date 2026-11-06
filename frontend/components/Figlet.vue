<script setup lang="ts">
import { FIGLET } from '~/utils/figlet'
import { content } from '~/utils/content'

const name = content.resume.basics.name
</script>

<template>
  <div class="figlet" role="img" :aria-label="name">
    <pre class="figlet-art" aria-hidden="true">{{ FIGLET }}</pre>
    <div class="figlet-name" aria-hidden="true">{{ name }}</div>
  </div>
</template>

<style scoped>
.figlet {
  margin: 0.5rem 0 1rem;
}

/* The art is the one fixed-column thing on the site: 35 columns, wide screens only. */
.figlet-art {
  display: none;
  margin: 0;
  font-family: inherit;
  font-size: 0.85rem;
  line-height: 1.1;
  color: var(--t-accent);
  white-space: pre;
  overflow: hidden;
}

.figlet-name {
  font-size: clamp(1.75rem, 9vw, 2.6rem);
  font-weight: 700;
  letter-spacing: 0.08em;
  line-height: 1.1;
  text-transform: uppercase;
  color: var(--t-accent);
  overflow-wrap: anywhere;
}

@media (min-width: 640px) {
  .figlet-art {
    display: block;
  }

  .figlet-name {
    display: none;
  }
}

@media print {
  .figlet {
    display: none;
  }
}
</style>
