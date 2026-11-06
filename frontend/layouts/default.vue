<script setup lang="ts">
import { content, profileByNetwork } from '~/utils/content'

const github = profileByNetwork(content.resume, 'GitHub')
const linkedin = profileByNetwork(content.resume, 'LinkedIn')
</script>

<template>
  <div class="site">
    <nav class="site-nav" aria-label="Site">
      <NuxtLink to="/" class="site-nav-home" title="Terminal">~</NuxtLink>
      <NuxtLink to="/resume">resume</NuxtLink>
      <NuxtLink to="/projects">projects</NuxtLink>
      <a v-if="github" :href="github.url" target="_blank" rel="noopener noreferrer">github</a>
      <a v-if="linkedin" :href="linkedin.url" target="_blank" rel="noopener noreferrer">linkedin</a>
    </nav>
    <main class="site-main">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.site {
  min-height: 100vh;
  min-height: 100dvh;
  padding: 0 var(--t-pad);
  display: flex;
  flex-direction: column;
}

.site-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1.25rem;
  padding: 0.6rem 0;
  color: var(--t-muted);
  font-size: 0.9rem;
  border-bottom: 1px solid var(--t-rule);
}

.site-nav a {
  text-decoration: none;
}

.site-nav a:hover,
.site-nav a.router-link-active {
  color: var(--t-prompt);
}

.site-nav-home {
  color: var(--t-prompt);
  font-weight: 700;
}

.site-main {
  flex: 1;
  display: flex;
  flex-direction: column;
}

@media print {
  .site {
    padding: 0;
  }

  .site-nav {
    display: none;
  }
}
</style>
