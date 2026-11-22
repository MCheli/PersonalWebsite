<script setup lang="ts">
import { useHead } from '#imports'
import { content } from '~/utils/content'
import { pageHead } from '~/utils/seo'

const { privacy } = content
const { basics } = content.resume

useHead(pageHead(content.resume, {
  path: '/privacy',
  title: 'Privacy',
  description: `How ${basics.name}'s site and self-hosted apps handle data, including Google sign-in. Updated ${privacy.updated}.`
}))
</script>

<template>
  <div class="privacy">
    <header class="privacy-head">
      <h1>Privacy</h1>
      <p class="privacy-updated">
        Updated <time :datetime="privacy.updated">{{ privacy.updated }}</time>
      </p>
      <p class="privacy-intro">
        {{ privacy.intro }}
      </p>
    </header>

    <section v-for="section in privacy.sections" :key="section.heading" class="privacy-section">
      <h2>{{ section.heading }}</h2>
      <p v-for="paragraph in section.paragraphs" :key="paragraph">
        {{ paragraph }}
      </p>
    </section>

    <section class="privacy-section">
      <h2>Contact</h2>
      <p class="privacy-contact">
        {{ privacy.contact }} <a :href="`mailto:${basics.email}`">{{ basics.email }}</a>.
      </p>
    </section>

    <footer class="privacy-foot">
      <NuxtLink to="/">terminal</NuxtLink> · <NuxtLink to="/resume">resume</NuxtLink> · <NuxtLink to="/projects">projects</NuxtLink>
    </footer>
  </div>
</template>

<style scoped>
.privacy {
  max-width: 72ch;
  padding: 1.25rem 0 3rem;
}

.privacy-head h1 {
  margin: 0;
  font-size: 1.6rem;
  color: var(--t-heading);
}

.privacy-updated {
  margin: 0.3rem 0 0;
  color: var(--t-muted);
  font-size: 0.85rem;
}

.privacy-intro {
  margin: 0.8rem 0 0;
}

.privacy-section {
  margin-top: 1.5rem;
}

.privacy-section h2 {
  margin: 0 0 0.4rem;
  font-size: 1.1rem;
  color: var(--t-info);
}

.privacy-section p {
  margin: 0.5rem 0 0;
}

.privacy-section a,
.privacy-foot a {
  color: var(--t-link);
  overflow-wrap: anywhere;
}

.privacy-foot {
  margin-top: 2rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--t-rule);
  color: var(--t-muted);
  font-size: 0.85rem;
}
</style>
