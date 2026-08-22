/**
 * Configurações globais do blog.
 * Mudou o nome, o domínio ou as redes? É aqui que se mexe.
 */

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

export type ItemMenu = { titulo: string; href: string };

export const MENU_PRINCIPAL: ItemMenu[] = [
  { titulo: 'Início', href: '/' },
  { titulo: 'Hidráulica', href: '/categoria/hidraulica/' },
  { titulo: 'Pintura', href: '/categoria/pintura/' },
  { titulo: 'Elétrica', href: '/categoria/eletrica/' },
  { titulo: 'Dicas Gerais', href: '/categoria/dicas-gerais/' },
  { titulo: 'Sobre', href: '/sobre/' },
  { titulo: 'Contato', href: '/contato/' },
];

/**
 * Identidade visual de cada categoria (cor + emoji).
 * Categoria nova que não estiver aqui cai no visual padrão.
 */
export type EstiloCategoria = {
  emoji: string;
  chip: string;
  barra: string;
};

export const ESTILOS_CATEGORIA: Record<string, EstiloCategoria> = {
  hidraulica: {
    emoji: '🚿',
    chip: 'bg-ceu-600 text-white',
    barra: 'bg-ceu-500',
  },
  pintura: {
    emoji: '🎨',
    chip: 'bg-uva-600 text-white',
    barra: 'bg-uva-500',
  },
  eletrica: {
    emoji: '💡',
    chip: 'bg-obra-400 text-tinta',
    barra: 'bg-obra-500',
  },
  'dicas-gerais': {
    emoji: '🧰',
    chip: 'bg-menta-400 text-tinta',
    barra: 'bg-menta-500',
  },
  moveis: {
    emoji: '🪚',
    chip: 'bg-tijolo-700 text-white',
    barra: 'bg-tijolo-500',
  },
};

export const ESTILO_CATEGORIA_PADRAO: EstiloCategoria = {
  emoji: '🏠',
  chip: 'bg-tinta text-white',
  barra: 'bg-tinta',
};
