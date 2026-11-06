<script setup lang="ts">
import { useHead } from '#imports'
import { content } from '~/utils/content'
import { siteTitle } from '~/utils/seo'

// Page-level tags (title, description, canonical, OG) come from each page's
// useHead; these are the few that never change.
useHead({
  htmlAttrs: { lang: 'en' },
  titleTemplate: title => (title === undefined || title === '' ? siteTitle(content.resume) : title),
  meta: [
    { charset: 'utf-8' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
    { name: 'theme-color', content: '#0a0a0a' }
  ],
  link: [{ rel: 'icon', type: 'image/png', href: '/favicon.png' }]
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
