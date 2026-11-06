<script setup lang="ts">
/**
 * The Powerlevel10k "rainbow" prompt: user · directory · branch as powerline
 * segments, separators drawn in CSS (no Nerd Font). The same component draws
 * the live prompt and every echoed command, so the transcript reads like one
 * session. Purely decorative for assistive tech: the input has its own label.
 */
withDefaults(defineProps<{
  /** The user segment (derived from resume.json, never typed here). */
  user: string
  /** The host, from services.json; shown as the directory on wide screens. */
  host: string
  /** The branch segment. The site deploys from this branch. */
  branch?: string
}>(), { branch: 'main' })
</script>

<template>
  <span class="segments" aria-hidden="true">
    <span class="seg seg-user">{{ user }}</span>
    <span class="seg seg-dir"><span class="dir-wide">~/{{ host }}</span><span class="dir-narrow">~</span></span>
    <span class="seg seg-git">{{ branch }}</span>
  </span>
</template>

<style scoped>
.segments {
  display: inline-flex;
  align-items: stretch;
  font-weight: 700;
  line-height: 1.5em;
  white-space: nowrap;
  user-select: none;
  max-width: 100%;
}

.seg {
  position: relative;
  display: inline-block;
  padding: 0 0.6em 0 0.9em;
  background: var(--seg-bg);
  color: var(--seg-fg);
}

.seg:first-child {
  padding-left: 0.7em;
}

/* Powerline arrow: a border triangle in the segment's own colour, laid over the next one. */
.seg::after {
  content: '';
  position: absolute;
  top: 0;
  left: 100%;
  width: 0;
  height: 0;
  border-top: 0.75em solid transparent;
  border-bottom: 0.75em solid transparent;
  border-left: 0.6em solid var(--seg-bg);
  z-index: 1;
}

.seg + .seg {
  padding-left: 1.2em;
}

.seg-user {
  --seg-bg: var(--t-seg-user-bg);
  --seg-fg: var(--t-seg-user-fg);
}

.seg-dir {
  --seg-bg: var(--t-seg-dir-bg);
  --seg-fg: var(--t-seg-dir-fg);
}

.seg-git {
  --seg-bg: var(--t-seg-git-bg);
  --seg-fg: var(--t-seg-git-fg);
}

.dir-narrow {
  display: none;
}

@media (max-width: 640px) {
  .dir-wide {
    display: none;
  }

  .dir-narrow {
    display: inline;
  }
}

@media print {
  .segments {
    display: none;
  }
}
</style>
