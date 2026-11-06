<script setup lang="ts">
import { useHead } from '#imports'
import { RESUME_PDF_PATH } from '~/commands/open'
import { content, dateRange, locationLine } from '~/utils/content'
import { resumeJsonLd } from '~/utils/jsonld'
import { pageHead } from '~/utils/seo'

const resume = content.resume
const { basics } = resume
const location = locationLine(resume)

useHead({
  ...pageHead(content.resume, {
    path: '/resume',
    title: 'Resume',
    description: `Resume of ${basics.name}, ${basics.label}. ${basics.summary}`
  }),
  script: [{ type: 'application/ld+json', innerHTML: JSON.stringify(resumeJsonLd(resume)) }]
})

/** Strip the scheme for display; the href keeps it. */
const bare = (url: string): string => url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')
</script>

<template>
  <article class="resume">
    <header class="resume-head">
      <div class="resume-head-text">
        <h1 class="resume-name">
          {{ basics.name }}
        </h1>
        <p class="resume-label">
          {{ basics.label }}
        </p>
        <p class="resume-contact">
          <span>{{ location }}</span>
          <a :href="`mailto:${basics.email}`">{{ basics.email }}</a>
          <a :href="basics.url">{{ bare(basics.url) }}</a>
          <a v-for="profile in basics.profiles" :key="profile.network" :href="profile.url" target="_blank" rel="noopener noreferrer">
            {{ bare(profile.url) }}
          </a>
        </p>
      </div>
      <img v-if="basics.image" :src="basics.image" :alt="basics.name" class="resume-photo" width="120" height="120">
      <a :href="RESUME_PDF_PATH" class="resume-download" download>Download PDF</a>
    </header>

    <p class="resume-summary">
      {{ basics.summary }}
    </p>

    <section class="resume-section" aria-labelledby="experience">
      <h2 id="experience">
        Experience
      </h2>
      <div v-for="job in resume.work" :key="`${job.name}-${job.startDate}`" class="job">
        <div class="job-head">
          <h3 class="job-title">
            {{ job.position }}
          </h3>
          <span class="job-dates">{{ dateRange(job.startDate, job.endDate) }}</span>
        </div>
        <p class="job-org">
          <a v-if="job.url" :href="job.url" target="_blank" rel="noopener noreferrer">{{ job.name }}</a>
          <template v-else>{{ job.name }}</template>
          <template v-if="job.location"> · {{ job.location }}</template>
        </p>
        <p class="job-summary">
          {{ job.summary }}
        </p>
        <ul v-if="job.highlights.length > 0" class="job-highlights">
          <li v-for="highlight in job.highlights" :key="highlight">
            {{ highlight }}
          </li>
        </ul>
      </div>
    </section>

    <section class="resume-section" aria-labelledby="education">
      <h2 id="education">
        Education
      </h2>
      <div v-for="edu in resume.education" :key="edu.institution" class="job">
        <div class="job-head">
          <h3 class="job-title">
            {{ edu.studyType }}, {{ edu.area }}
          </h3>
          <span class="job-dates">{{ dateRange(edu.startDate, edu.endDate) }}</span>
        </div>
        <p class="job-org">
          <a v-if="edu.url" :href="edu.url" target="_blank" rel="noopener noreferrer">{{ edu.institution }}</a>
          <template v-else>{{ edu.institution }}</template>
          <template v-if="edu.score"> · {{ edu.score }}</template>
        </p>
      </div>
    </section>

    <section v-if="resume.certificates.length > 0" class="resume-section" aria-labelledby="certificates">
      <h2 id="certificates">
        Certificates
      </h2>
      <ul class="plain-list">
        <li v-for="cert in resume.certificates" :key="cert.name">
          {{ cert.name }} · {{ cert.issuer }} · {{ cert.date }}
        </li>
      </ul>
    </section>

    <section class="resume-section" aria-labelledby="skills">
      <h2 id="skills">
        Skills
      </h2>
      <dl class="skills">
        <template v-for="group in resume.skills" :key="group.name">
          <dt>{{ group.name }}</dt>
          <dd>{{ group.keywords.join(' · ') }}</dd>
        </template>
      </dl>
    </section>

    <section v-if="resume.interests.length > 0" class="resume-section" aria-labelledby="interests">
      <h2 id="interests">
        Interests
      </h2>
      <dl class="skills">
        <template v-for="interest in resume.interests" :key="interest.name">
          <dt>{{ interest.name }}</dt>
          <dd>{{ interest.keywords.join(' · ') }}</dd>
        </template>
      </dl>
    </section>

    <footer class="resume-foot">
      <span>Updated {{ resume.meta.lastModified }}</span>
      <span class="screen-only"> · <a :href="RESUME_PDF_PATH" download>PDF</a> · <NuxtLink to="/">terminal</NuxtLink></span>
      <span class="print-only"> · {{ bare(basics.url) }}/resume</span>
    </footer>
  </article>
</template>

<style scoped>
.resume {
  max-width: 76ch;
  padding: 1.25rem 0 3rem;
}

.resume-head {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.5rem 1.5rem;
  align-items: start;
}

.resume-head-text {
  grid-column: 1;
}

.resume-photo {
  grid-column: 2;
  grid-row: 1;
  border-radius: 6px;
  width: 120px;
  height: 120px;
  object-fit: cover;
}

.resume-name {
  margin: 0;
  font-size: 1.6rem;
  color: var(--t-fg);
}

.resume-label {
  margin: 0.2rem 0 0.5rem;
  color: var(--t-prompt);
}

.resume-contact {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem 1rem;
  color: var(--t-muted);
  font-size: 0.9rem;
}

.resume-download {
  grid-column: 1 / -1;
  justify-self: start;
  margin-top: 0.5rem;
  padding: 0.35rem 0.9rem;
  background: var(--t-chip-bg);
  border: 1px solid var(--t-chip-border);
  border-radius: 999px;
  color: var(--t-chip-fg);
  text-decoration: none;
  font-size: 0.9rem;
}

.resume-download:hover {
  border-color: var(--t-chip-fg);
}

.resume-summary {
  margin: 1.25rem 0;
  color: var(--t-output);
}

.resume-section {
  margin-top: 1.5rem;
}

.resume-section h2 {
  font-size: 0.95rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--t-heading);
  border-bottom: 1px solid var(--t-rule);
  padding-bottom: 0.3rem;
  margin: 0 0 0.75rem;
}

.job {
  margin-bottom: 1.1rem;
  break-inside: avoid;
}

.job-head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0 1rem;
  align-items: baseline;
}

.job-title {
  margin: 0;
  font-size: 1rem;
  color: var(--t-fg);
}

.job-dates {
  color: var(--t-muted);
  font-size: 0.9rem;
  white-space: nowrap;
}

.job-org {
  margin: 0.1rem 0 0.3rem;
  color: var(--t-info);
}

.job-summary {
  margin: 0;
}

.job-highlights {
  margin: 0.4rem 0 0;
  padding-left: 1.25rem;
}

.job-highlights li {
  margin: 0.2rem 0;
}

.job-highlights li::marker {
  color: var(--t-muted);
}

.plain-list {
  margin: 0;
  padding-left: 1.25rem;
}

.skills {
  margin: 0;
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.2rem 1rem;
}

.skills dt {
  color: var(--t-key);
  font-weight: 500;
}

.skills dd {
  margin: 0 0 0.5rem;
}

@media (min-width: 640px) {
  .skills {
    grid-template-columns: max-content 1fr;
  }

  .skills dd {
    margin: 0;
  }
}

.resume-foot {
  margin-top: 2rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--t-rule);
  color: var(--t-muted);
  font-size: 0.85rem;
}

.print-only {
  display: none;
}

/* Print: black on white, no chrome, a document a recruiter can staple. */
@page {
  margin: 0.6in 0.7in;
}

@media print {
  .resume {
    max-width: none;
    padding: 0;
    font-size: 10.5pt;
    line-height: 1.35;
  }

  .resume-head {
    grid-template-columns: 1fr auto;
  }

  .resume-name,
  .job-title,
  .resume-label,
  .resume-contact,
  .resume-summary,
  .resume-section h2,
  .job-org,
  .job-dates,
  .skills dt,
  .resume-foot {
    color: #000000;
  }

  .resume-section h2 {
    border-bottom-color: #000000;
    page-break-after: avoid;
  }

  .resume-download,
  .screen-only {
    display: none;
  }

  .print-only {
    display: inline;
  }

  .resume-contact a::after {
    content: none;
  }

  .job {
    page-break-inside: avoid;
  }

  .resume-summary {
    margin: 0.75rem 0;
  }

  .resume-section {
    margin-top: 1rem;
  }

  .resume-foot {
    border-top-color: #000000;
  }
}
</style>
