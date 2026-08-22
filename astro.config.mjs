// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // Troque pela URL final do seu domínio antes do deploy.
  // É usada no sitemap.xml, no RSS e nas tags canonical/Open Graph.
  site: 'https://crescendonaobra.vercel.app',
  output: 'static',
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
  image: {
    // Otimização nativa (astro:assets) usando sharp no build.
    responsiveStyles: true,
  },
});
