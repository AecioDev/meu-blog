import { getCollection, type CollectionEntry } from 'astro:content';
import { ESTILOS_CATEGORIA, ESTILO_CATEGORIA_PADRAO } from '../consts';

export type Post = CollectionEntry<'posts'>;

/**
 * Transforma "Dicas Gerais" em "dicas-gerais": sem acento, sem espaco.
 * Usado nas URLs de categoria.
 */
export function slugify(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Todos os posts publicados (sem rascunhos), do mais novo para o mais antigo. */
export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection('posts', ({ data }) => data.draft !== true);
  return posts.sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
  );
}

/** Posts marcados com `featured: true` no frontmatter. */
export async function getPostsDestaque(limite = 3): Promise<Post[]> {
  const posts = await getPosts();
  return posts.filter((p) => p.data.featured).slice(0, limite);
}

/** Posts de uma categoria, buscando pelo slug da URL. */
export async function getPostsPorCategoria(
  slugCategoria: string,
): Promise<Post[]> {
  const posts = await getPosts();
  return posts.filter((p) => slugify(p.data.category) === slugCategoria);
}

export type CategoriaResumo = {
  nome: string;
  slug: string;
  total: number;
};

/** Lista de categorias com a contagem de posts, da maior para a menor. */
export async function getCategorias(): Promise<CategoriaResumo[]> {
  const posts = await getPosts();
  const mapa = new Map<string, CategoriaResumo>();

  for (const post of posts) {
    const nome = post.data.category;
    const slug = slugify(nome);
    const atual = mapa.get(slug);
    if (atual) {
      atual.total += 1;
    } else {
      mapa.set(slug, { nome, slug, total: 1 });
    }
  }

  return [...mapa.values()].sort(
    (a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'),
  );
}

/**
 * Posts da mesma categoria, tirando o post atual.
 * Se sobrar espaco, completa com os mais recentes de qualquer categoria.
 */
export async function getPostsRelacionados(
  postAtual: Post,
  limite = 3,
): Promise<Post[]> {
  const posts = await getPosts();
  const mesmaCategoria = posts.filter(
    (p) => p.id !== postAtual.id && p.data.category === postAtual.data.category,
  );

  if (mesmaCategoria.length >= limite) return mesmaCategoria.slice(0, limite);

  const completar = posts.filter(
    (p) => p.id !== postAtual.id && !mesmaCategoria.some((m) => m.id === p.id),
  );

  return [...mesmaCategoria, ...completar].slice(0, limite);
}

/** Visual (emoji e cores) de uma categoria. */
export function estiloCategoria(nomeCategoria: string) {
  return ESTILOS_CATEGORIA[slugify(nomeCategoria)] ?? ESTILO_CATEGORIA_PADRAO;
}

/** URL final do post. O slug do arquivo .md e o slug da URL. */
export function urlDoPost(post: Post): string {
  return `/posts/${post.id}/`;
}

/** URL da listagem de uma categoria. */
export function urlDaCategoria(nomeCategoria: string): string {
  return `/categoria/${slugify(nomeCategoria)}/`;
}

/** Data por extenso em portugues: "12 de agosto de 2026". */
export function formatarData(data: Date): string {
  return data.toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Estimativa simples de tempo de leitura, em minutos. */
export function tempoDeLeitura(texto: string | undefined): number {
  const palavras = (texto ?? '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(palavras / 200));
}

/**
 * Gera um id único por instância de componente.
 * Necessário quando o mesmo componente aparece duas vezes na página
 * (ex.: newsletter na lateral e no meio do post) — id repetido quebra
 * a ligação entre label e campo para leitores de tela.
 */
let contadorIds = 0;
export function idUnico(prefixo: string): string {
  contadorIds += 1;
  return `${prefixo}-${contadorIds}`;
}
