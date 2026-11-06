<script setup lang="ts">
import type { Inline, OutputBlock } from '~/types/terminal'

defineProps<{ blocks: OutputBlock[] }>()

const isLink = (inline: Inline): inline is { href: string, label: string } => typeof inline !== 'string'

/** Internal paths stay in the tab; everything else opens a new one. */
const external = (href: string): boolean => !href.startsWith('/') && !href.startsWith('#')
</script>

<template>
  <div class="output">
    <template v-for="(block, i) in blocks" :key="i">
      <p v-if="block.kind === 'text'" class="output-text" :class="block.tone ? `tone-${block.tone}` : ''">
        {{ block.text }}
      </p>

      <h3 v-else-if="block.kind === 'heading'" class="output-heading">
        {{ block.text }}
      </h3>

      <hr v-else-if="block.kind === 'rule'" class="output-rule">

      <ul v-else-if="block.kind === 'list'" class="output-list">
        <li v-for="(item, j) in block.items" :key="j">
          <template v-for="(part, k) in item" :key="k">
            <a
              v-if="isLink(part)"
              :href="part.href"
              class="output-link"
              :target="external(part.href) ? '_blank' : undefined"
              :rel="external(part.href) ? 'noopener noreferrer' : undefined"
            >{{ part.label }}</a>
            <span v-else>{{ part }}</span>
            <template v-if="k < item.length - 1"/>
          </template>
        </li>
      </ul>

      <dl v-else-if="block.kind === 'kv'" class="output-kv">
        <template v-for="(row, j) in block.rows" :key="j">
          <dt>{{ row.key }}</dt>
          <dd>
            <template v-for="(part, k) in row.value" :key="k">
              <a
                v-if="isLink(part)"
                :href="part.href"
                class="output-link"
                :target="external(part.href) ? '_blank' : undefined"
                :rel="external(part.href) ? 'noopener noreferrer' : undefined"
              >{{ part.label }}</a>
              <span v-else>{{ part }}</span>
              <span v-if="k < row.value.length - 1" class="output-sep" aria-hidden="true"> · </span>
            </template>
          </dd>
        </template>
      </dl>

      <div v-else-if="block.kind === 'table'" class="output-table">
        <div v-for="(row, j) in block.rows" :key="j" class="output-row">
          <span class="output-name">
            <a
              v-if="isLink(row.name)"
              :href="row.name.href"
              class="output-link"
              :target="external(row.name.href) ? '_blank' : undefined"
              :rel="external(row.name.href) ? 'noopener noreferrer' : undefined"
            >{{ row.name.label }}</a>
            <template v-else>{{ row.name }}</template>
          </span>
          <span class="output-desc">
            <span v-if="row.description" class="output-desc-text">{{ row.description }}</span>
            <span v-if="row.detail && row.detail.length > 0" class="output-detail">
              <template v-for="(part, k) in row.detail" :key="k">
                <a
                  v-if="isLink(part)"
                  :href="part.href"
                  class="output-link"
                  :target="external(part.href) ? '_blank' : undefined"
                  :rel="external(part.href) ? 'noopener noreferrer' : undefined"
                >{{ part.label }}</a>
                <span v-else>{{ part }}</span>
                <span v-if="k < row.detail.length - 1" class="output-sep" aria-hidden="true"> · </span>
              </template>
            </span>
          </span>
        </div>
      </div>

      <p v-else-if="block.kind === 'link'" class="output-text">
        <a
          :href="block.href"
          class="output-link"
          :target="external(block.href) ? '_blank' : undefined"
          :rel="external(block.href) ? 'noopener noreferrer' : undefined"
        >{{ block.label }}</a>
      </p>

      <Figlet v-else-if="block.kind === 'figlet'" />

      <div v-else-if="block.kind === 'blank'" class="output-blank" aria-hidden="true" />
    </template>
  </div>
</template>

<style scoped>
.output {
  color: var(--t-output);
  overflow-wrap: anywhere;
}

.output-text {
  margin: 0;
  white-space: pre-wrap;
}

.tone-muted {
  color: var(--t-muted);
}

.tone-success {
  color: var(--t-success);
}

.tone-info {
  color: var(--t-info);
}

.tone-error {
  color: var(--t-error);
}

.output-heading {
  margin: 0.25rem 0 0.25rem;
  font-size: 1em;
  font-weight: 700;
  color: var(--t-heading);
}

.output-rule {
  border: 0;
  border-top: 1px solid var(--t-rule);
  margin: 0.25rem 0 0.5rem;
  max-width: 48rem;
}

.output-list {
  margin: 0.25rem 0;
  padding-left: 1.25rem;
}

.output-list li {
  margin: 0.15rem 0;
}

.output-list li::marker {
  color: var(--t-muted);
}

.output-blank {
  height: 0.75em;
}

/* Key/value rows: "key: value" lines that wrap on a phone, two columns when there is room. */
.output-kv {
  margin: 0.25rem 0;
}

.output-kv dt {
  display: inline;
  color: var(--t-key);
  font-weight: 500;
}

.output-kv dt::after {
  content: ': ';
}

.output-kv dd {
  display: inline;
  margin: 0;
}

.output-kv dd::after {
  content: '';
  display: block;
  height: 0.2rem;
}

@media (min-width: 640px) {
  .output-kv {
    display: grid;
    grid-template-columns: minmax(8rem, max-content) 1fr;
    gap: 0.1rem 1rem;
    max-width: 64rem;
  }

  .output-kv dt,
  .output-kv dd {
    display: block;
  }

  .output-kv dt::after,
  .output-kv dd::after {
    content: none;
  }
}

.output-sep {
  color: var(--t-muted);
}

/* Catalog table: name, then the description in the comment colour; stacked on a
   phone, two aligned columns when there is room. Never wider than the screen. */
.output-table {
  margin: 0.25rem 0;
}

.output-row {
  margin: 0 0 0.35rem;
}

.output-name {
  display: block;
  color: var(--t-output);
}

.output-desc {
  display: block;
  color: var(--t-muted);
}

.output-detail {
  display: block;
}

@media (min-width: 640px) {
  .output-table {
    display: grid;
    grid-template-columns: 23ch 1fr;
    gap: 0.1rem 1rem;
    max-width: 64rem;
  }

  .output-row {
    display: contents;
  }

  .output-name,
  .output-desc {
    margin: 0 0 0.15rem;
  }
}
</style>
