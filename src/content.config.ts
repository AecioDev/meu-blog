import { defineCollection } from 'astro:content';
// No Astro 7 o `z` vem do próprio zod v4, não mais de 'astro:content'.
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';
import { SITE_AUTHOR_PADRAO } from './consts';

const posts = defineCollection({
  loader: glob({ base: './src/content/posts', pattern: '**/*.{md,mdx}' }),
  schema: ({ image }) =>
    z.object({
      /** Título do post — vira o <h1> e o <title> da página. */
      title: z.string(),
      /** Resumo curto: aparece nos cards e na meta description. */
      description: z.string(),
      /** Data de publicação (ex.: 2026-08-12). */
      pubDate: z.coerce.date(),
      /** Data da última atualização, se houver. */
      updatedDate: z.coerce.date().optional(),
      /** Ex.: "Hidráulica", "Pintura", "Elétrica", "Dicas Gerais". */
      category: z.string(),
      tags: z.array(z.string()).optional(),
      /**
       * Caminho da imagem de capa, relativo ao arquivo .md
       * (ex.: "../../assets/posts/minha-capa.jpg").
       * O Astro otimiza a imagem automaticamente no build.
       */
      coverImage: image(),
      /** Texto alternativo da capa — obrigatório por acessibilidade. */
      coverImageAlt: z.string(),
      author: z.string().default(SITE_AUTHOR_PADRAO),
      /** Marque como true para o post aparecer em destaque na home. */
      featured: z.boolean().default(false),
      /** Deixe true para esconder o post do site sem apagar o arquivo. */
      draft: z.boolean().default(false),
      /**
       * Produtos de afiliado deste post, pelos slugs do catálogo do painel
       * (tools/painel/produtos-afiliados.json). Viram o bloco "Onde comprar",
       * logo abaixo da lista de materiais. O painel preenche este campo.
       */
      materiais: z.array(z.string()).optional(),
    }),
});

export const collections = { posts };
