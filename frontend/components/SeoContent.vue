<script setup lang="ts">
/**
 * Everything the commands can print, as plain server-rendered HTML for
 * crawlers and assistants that do not run JavaScript. Visually hidden
 * (sr-only), never display:none, so it stays in the accessibility tree too.
 */
import {
  containerCount,
  content,
  dateRange,
  featuredFirst,
  locationLine,
  serviceCount,
  serviceHref
} from '~/utils/content'

const { resume, catalog, now } = content
const projects = featuredFirst(content.projects)
const location = locationLine(resume)
</script>

<template>
  <section class="sr-only" aria-label="Site overview for search engines and assistants">
    <h2>About {{ resume.basics.name }}</h2>
    <p>{{ resume.basics.name }} — {{ resume.basics.label }}. {{ location }}.</p>
    <p>{{ resume.basics.summary }}</p>
    <ul>
      <li>Email: <a :href="`mailto:${resume.basics.email}`">{{ resume.basics.email }}</a></li>
      <li v-for="profile in resume.basics.profiles" :key="profile.network">
        {{ profile.network }}: <a :href="profile.url">{{ profile.url }}</a>
      </li>
      <li>Resume: <a href="/resume">{{ resume.basics.url }}/resume</a> · <a href="/Mark-Cheli-Resume.pdf">PDF</a></li>
      <li>Projects: <a href="/projects">{{ resume.basics.url }}/projects</a></li>
    </ul>

    <h2>Experience</h2>
    <ul>
      <li v-for="job in resume.work" :key="`${job.name}-${job.startDate}`">
        <strong>{{ job.position }}</strong>, {{ job.name }} ({{ dateRange(job.startDate, job.endDate) }}). {{ job.summary }}
        <ul v-if="job.highlights.length > 0">
          <li v-for="highlight in job.highlights" :key="highlight">{{ highlight }}</li>
        </ul>
      </li>
    </ul>

    <h2>Education</h2>
    <ul>
      <li v-for="edu in resume.education" :key="edu.institution">
        {{ edu.studyType }} {{ edu.area }}, {{ edu.institution }} ({{ dateRange(edu.startDate, edu.endDate) }})<template v-if="edu.score">, {{ edu.score }}</template>
      </li>
    </ul>

    <h2>Skills</h2>
    <ul>
      <li v-for="group in resume.skills" :key="group.name">
        <strong>{{ group.name }}:</strong> {{ group.keywords.join(', ') }}
      </li>
    </ul>

    <h2>Projects</h2>
    <ul>
      <li v-for="project in projects" :key="project.slug">
        <strong>{{ project.name }}</strong> — {{ project.tagline }} {{ project.description }}
        Built with {{ project.stack.join(', ') }}.
        <template v-if="project.repo"> Source: <a :href="project.repo">{{ project.repo }}</a>.</template>
        <template v-if="project.url"> Live: <a :href="project.url">{{ project.url }}</a>.</template>
        <template v-if="project.demo"> Demo: <a :href="project.demo">{{ project.demo }}</a>.</template>
        <template v-if="project.highlights.length > 0">
          <ul>
            <li v-for="highlight in project.highlights" :key="highlight">{{ highlight }}</li>
          </ul>
        </template>
      </li>
    </ul>

    <h2>Now</h2>
    <p v-if="now.openTo">{{ now.openTo }}</p>
    <ul>
      <li v-for="item in now.items" :key="item">{{ item }}</li>
    </ul>
    <p>Updated {{ now.updated }}.</p>

    <h2>Homelab: {{ catalog.host.displayName }}</h2>
    <p>
      This site is served from a {{ catalog.host.hardware }} ({{ catalog.host.cpu }}, {{ catalog.host.memory }},
      {{ catalog.host.os }}) running {{ serviceCount(catalog) }} services in {{ containerCount(catalog) }} Docker
      containers across {{ catalog.categories.length }} categories. {{ catalog.host.stack }}.
      <template v-if="catalog.host.repo">Infrastructure as code: <a :href="catalog.host.repo">{{ catalog.host.repo }}</a>.</template>
    </p>
    <section v-for="category in catalog.categories" :key="category.id" :aria-label="category.title">
      <h3>{{ category.title }}</h3>
      <ul>
        <li v-for="service in category.services" :key="service.name">
          <strong>{{ service.name }}</strong>
          <template v-if="service.url"> — <a :href="serviceHref(service)">{{ service.url }}</a></template>
          <template v-if="service.description"> — {{ service.description }}</template>
          <template v-if="service.repo"> (repo: <a :href="service.repo">{{ service.repo }}</a>)</template>
        </li>
      </ul>
    </section>
  </section>
</template>
