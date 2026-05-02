// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  css: ['~/assets/css/terminal.css'],
  app: {
    head: {
      title: 'Mark Cheli — Developer, Product Strategist, Homelab Operator',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content: 'Mark Cheli is a developer and product strategist in Ashland, MA running a self-hosted homelab on a Dell PowerEdge R630 with 32+ Docker services. Personal site, projects, and infrastructure catalog.'
        },
        { name: 'author', content: 'Mark Cheli' },
        { name: 'keywords', content: 'Mark Cheli, developer, product strategist, homelab, self-hosted, Docker, Nuxt, Flask, PowerEdge, Ashland MA' },
        { name: 'robots', content: 'index, follow, max-snippet:-1, max-image-preview:large' },
        { property: 'og:title', content: 'Mark Cheli — Developer, Product Strategist, Homelab Operator' },
        { property: 'og:description', content: 'Personal site, custom apps, and a 32-container self-hosted homelab catalog.' },
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: 'https://www.markcheli.com/' },
        { property: 'og:site_name', content: 'markcheli.com' },
        { property: 'og:image', content: 'https://www.markcheli.com/favicon.png' },
        { name: 'twitter:card', content: 'summary' },
        { name: 'twitter:title', content: 'Mark Cheli — Developer, Product Strategist, Homelab Operator' },
        { name: 'twitter:description', content: 'Personal site, custom apps, and a 32-container self-hosted homelab catalog.' },
        { name: 'twitter:image', content: 'https://www.markcheli.com/favicon.png' }
      ],
      link: [
        { rel: 'icon', type: 'image/png', href: '/favicon.png' },
        { rel: 'canonical', href: 'https://www.markcheli.com/' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { href: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap', rel: 'stylesheet' }
      ],
      script: [
        {
          type: 'application/ld+json',
          innerHTML: JSON.stringify({
            '@context': 'https://schema.org',
            '@graph': [
              {
                '@type': 'Person',
                '@id': 'https://www.markcheli.com/#person',
                name: 'Mark Cheli',
                url: 'https://www.markcheli.com/',
                jobTitle: 'Developer & Product Strategist',
                address: {
                  '@type': 'PostalAddress',
                  addressLocality: 'Ashland',
                  addressRegion: 'MA',
                  addressCountry: 'US'
                },
                sameAs: [
                  'https://www.linkedin.com/in/mark-cheli-0354a163/',
                  'https://github.com/MCheli'
                ]
              },
              {
                '@type': 'WebSite',
                '@id': 'https://www.markcheli.com/#website',
                url: 'https://www.markcheli.com/',
                name: 'markcheli.com',
                description: 'Mark Cheli’s personal site, projects, and homelab service catalog.',
                author: { '@id': 'https://www.markcheli.com/#person' },
                inLanguage: 'en-US'
              }
            ]
          })
        }
      ]
    }
  },
  nitro: {
    devProxy: {
      '/api': {
        target: process.env.API_URL || 'http://localhost:5000',
        changeOrigin: true,
        prependPath: true
      }
    }
  },
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || '/api'
    }
  }
})