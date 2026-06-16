// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://www.rre.org.uk',
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  // Astro's CSRF origin check reconstructs the request origin from the node
  // server, which sits behind Railway's TLS-terminating proxy, so a legitimate
  // same-origin form POST is seen as cross-site and 403s. The contact form has
  // no auth or state change beyond emailing, and is guarded by honeypot/timing/
  // rate-limit, so we disable the origin check rather than block real submissions.
  security: { checkOrigin: false },
  compressHTML: true,
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
