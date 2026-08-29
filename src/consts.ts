/**
 * Configurações globais do blog.
 * Mudou o nome, o domínio ou as redes? É aqui que se mexe.
 */

import categorias from './dados/categorias.json';

export const SITE_TITLE = 'Crescendo na Obra';
export const SITE_TAGLINE = 'Sua casa, do seu jeito — sem medo de errar';
export const SITE_DESCRIPTION =
  'Tutoriais simples, dicas e notícias sobre cuidar da sua casa: trocar torneira, pintar parede, consertar chuveiro e economizar sem chamar ninguém.';
export const SITE_AUTHOR_PADRAO = 'Equipe Crescendo na Obra';
export const SITE_LANG = 'pt-BR';
export const SITE_LOCALE = 'pt_BR';

/** Imagem usada no Open Graph quando a página não tem capa própria. */
export const OG_IMAGE_PADRAO = '/images/og-padrao.jpg';

/** Handle do Twitter/X usado no Twitter Card (deixe vazio se não tiver). */
export const TWITTER_HANDLE = '@crescendonaobra';

/**
 * ─── Categorias ───────────────────────────────────────────────────────────
 *
 * A lista mora em `src/dados/categorias.json` — é a ÚNICA fonte de verdade
 * do projeto. Um JSON porque três mundos precisam dela e só um deles fala
 * TypeScript: o site (aqui), o painel local (`tools/painel/servidor.js`, que
 * é Node puro) e os agentes/skill do Claude.
 *
 * `publica: false` é uma categoria preparada, mas ainda não no ar: o estilo
 * já existe para quando ela estrear, mas ela fica fora do menu e o schema
 * dos posts recusa quem tentar usá-la. É o caso de "Móveis" hoje.
 *
 * Para cadastrar uma categoria nova, veja o README (seção "Categoria nova").
 */
export type Categoria = {
  nome: string;
  slug: string;
  publica: boolean;
  emoji: string;
  chip: string;
  barra: string;
};

export const TODAS_CATEGORIAS: Categoria[] = categorias;

/** Só as que estão no ar — é contra esta lista que o schema dos posts valida. */
export const CATEGORIAS_PUBLICAS: Categoria[] = TODAS_CATEGORIAS.filter(
  (categoria) => categoria.publica,
);

/** Os nomes das categorias públicas, do jeito que vão no frontmatter. */
export const CATEGORIAS: string[] = CATEGORIAS_PUBLICAS.map(
  (categoria) => categoria.nome,
);

export type ItemMenu = { titulo: string; href: string };

export const MENU_PRINCIPAL: ItemMenu[] = [
  { titulo: 'Início', href: '/' },
  ...CATEGORIAS_PUBLICAS.map((categoria) => ({
    titulo: categoria.nome,
    href: `/categoria/${categoria.slug}/`,
  })),
  { titulo: 'Sobre', href: '/sobre/' },
  { titulo: 'Contato', href: '/contato/' },
];

/**
 * Identidade visual de cada categoria (cor + emoji), indexada pelo slug.
 * Categoria que não estiver aqui cai no visual padrão.
 */
export type EstiloCategoria = {
  emoji: string;
  chip: string;
  barra: string;
};

export const ESTILOS_CATEGORIA: Record<string, EstiloCategoria> =
  Object.fromEntries(
    TODAS_CATEGORIAS.map((categoria) => [
      categoria.slug,
      {
        emoji: categoria.emoji,
        chip: categoria.chip,
        barra: categoria.barra,
      },
    ]),
  );

export const ESTILO_CATEGORIA_PADRAO: EstiloCategoria = {
  emoji: '🏠',
  chip: 'bg-tinta text-white',
  barra: 'bg-tinta',
};
