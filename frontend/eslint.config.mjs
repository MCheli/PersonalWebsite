// ESLint for the Nuxt app, scripts and tests. `npm run lint` / `make lint`.
// Uses the standalone @nuxt/eslint-config flat preset (no Nuxt module, so nuxt.config.ts
// is untouched). Stylistic rules are off: formatting is not a gate here.
import { createConfigForNuxt } from '@nuxt/eslint-config/flat'

export default createConfigForNuxt({
  features: {
    stylistic: false,
    tooling: true,
  },
}).append(
  {
    ignores: ['.nuxt/**', '.output/**', 'dist/**', 'node_modules/**', 'public/**', 'coverage/**'],
  },
  {
    files: ['tests/**/*.ts', '*.config.*'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    rules: {
      // Vue 3 SFCs in this repo are app.vue and components; multi-word names are not a
      // requirement for a one-page site.
      'vue/multi-word-component-names': 'off',
    },
  },
)
