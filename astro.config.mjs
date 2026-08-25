// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // Troque pela URL final do seu domínio antes do deploy.
  // É usada no sitemap.xml, no RSS e nas tags canonical/Open Graph.
  site: 'https://crescendonaobra.com.br',
  output: 'static',
  // URLs sempre terminam com barra (/sobre/), casando com o
  // "trailingSlash": true do vercel.json e com as tags canonical.
  // Assim o site local se comporta igual ao publicado: link interno
  // sem a barra vira 404 no dev, antes de ir pro ar.
  trailingSlash: 'always',
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
  image: {
    // Otimização nativa (astro:assets) usando sharp no build.
    responsiveStyles: true,
  },
});
