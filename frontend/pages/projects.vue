<script setup lang="ts">
import { useHead } from '#imports'
import { content, featuredFirst, formatDate } from '~/utils/content'
import { pageHead } from '~/utils/seo'

const projects = featuredFirst(content.projects)
const { basics } = content.resume

useHead(pageHead(content.resume, {
  path: '/projects',
  title: 'Projects',
  description: `${projects.length} things ${basics.name} has built: ${projects.filter(p => p.featured).map(p => p.name).join(', ')} and more. Code on GitHub.`
}))
</script>

<template>
  <div class="projects">
    <header class="projects-head">
      <h1>Projects</h1>
      <p class="projects-intro">
        {{ projects.length }} things I have built, featured first. Every card links to the code.
        In the <NuxtLink to="/">terminal</NuxtLink>, <code>projects &lt;slug&gt;</code> prints the same.
      </p>
    </header>

    <article
      v-for="project in projects"
      :id="project.slug"
      :key="project.slug"
      class="card"
      :class="{ 'card-featured': project.featured }"
    >
      <header class="card-head">
        <h2 class="card-name">
          <a :href="`#${project.slug}`" class="card-anchor">{{ project.name }}</a>
        </h2>
        <span class="card-meta">
          <span v-if="project.featured" class="card-badge">featured</span>
          <span>{{ project.status }}</span>
          <span>since {{ formatDate(project.started) }}</span>
        </span>
      </header>
      <p class="card-tagline">
        {{ project.tagline }}
      </p>
      <p class="card-description">
        {{ project.description }}
      </p>
      <ul v-if="project.highlights.length > 0" class="card-highlights">
        <li v-for="highlight in project.highlights" :key="highlight">
          {{ highlight }}
        </li>
      </ul>
      <ul class="card-stack" aria-label="Built with">
        <li v-for="tech in project.stack" :key="tech" class="chip">
          {{ tech }}
        </li>
      </ul>
      <p class="card-links">
        <a v-if="project.repo" :href="project.repo" target="_blank" rel="noopener noreferrer">repo</a>
        <a v-if="project.url" :href="project.url" target="_blank" rel="noopener noreferrer">live</a>
        <a v-if="project.demo" :href="project.demo" target="_blank" rel="noopener noreferrer">demo</a>
      </p>
    </article>

    <footer class="projects-foot">
      Updated {{ content.projects.updated }} · <NuxtLink to="/">terminal</NuxtLink> · <NuxtLink to="/resume">resume</NuxtLink>
    </footer>
  </div>
</template>

<style scoped>
.projects {
  max-width: 80ch;
  padding: 1.25rem 0 3rem;
}

.projects-head h1 {
  margin: 0;
  font-size: 1.6rem;
  color: var(--t-heading);
}

.projects-intro {
  color: var(--t-muted);
  margin: 0.4rem 0 1.5rem;
}

.projects-intro code {
  color: var(--t-command);
}

.card {
  border: 1px solid var(--t-rule);
  border-radius: 8px;
  padding: 1rem 1.1rem;
  margin-bottom: 1rem;
  scroll-margin-top: 1rem;
}

.card-featured {
  border-color: var(--t-comment);
}

.card:target {
  border-color: var(--t-purple);
}

.card-head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.25rem 1rem;
}

.card-name {
  margin: 0;
  font-size: 1.1rem;
}

.card-anchor {
  color: var(--t-fg);
  text-decoration: none;
}

.card-anchor:hover {
  color: var(--t-link);
  text-decoration: underline;
  text-decoration-color: var(--t-link-underline);
}

.card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  color: var(--t-muted);
  font-size: 0.85rem;
}

.card-badge {
  color: var(--t-orange);
}

.card-tagline {
  margin: 0.25rem 0 0.6rem;
  color: var(--t-info);
}

.card-description {
  margin: 0;
}

.card-highlights {
  margin: 0.6rem 0 0;
  padding-left: 1.25rem;
}

.card-highlights li {
  margin: 0.2rem 0;
}

.card-highlights li::marker {
  color: var(--t-muted);
}

.card-stack {
  list-style: none;
  margin: 0.8rem 0 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.chip {
  font-size: 0.8rem;
  color: var(--t-fg);
  background: var(--t-chip-bg);
  border: 1px solid var(--t-chip-border);
  border-radius: 999px;
  padding: 0.15rem 0.6rem;
}

.card-links {
  margin: 0.8rem 0 0;
  display: flex;
  gap: 1.25rem;
}

.card-links a {
  color: var(--t-link);
}

.projects-foot {
  margin-top: 1.5rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--t-rule);
  color: var(--t-muted);
  font-size: 0.85rem;
}
</style>
