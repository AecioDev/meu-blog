/**
 * Painel de produção do Crescendo na Obra.
 *
 * Ferramenta local, de uso pessoal. NÃO faz parte do site: mora fora de
 * `src/` e `public/`, então o build do Astro (e o deploy da Vercel) ignora
 * esta pasta por completo.
 *
 * Sobe com `npm run painel` e abre em http://localhost:5173.
 *
 * Não guarda estado próprio dos posts: a cada carregamento ele relê
 * `drafts/`, `src/content/posts/` e o histórico do Git, e deduz em que
 * etapa cada post está. Os únicos arquivos que ele grava são as pautas
 * (intenção, que não existe em lugar nenhum ainda) e o catálogo de
 * produtos de afiliado.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const PASTA_DRAFTS = path.join(RAIZ, 'drafts');
const PASTA_POSTS = path.join(RAIZ, 'src', 'content', 'posts');
const ARQ_PAUTAS = path.join(AQUI, 'pautas.json');
const ARQ_PRODUTOS = path.join(AQUI, 'produtos-afiliados.json');

const PORTA = Number(process.env.PORTA_PAINEL) || 5173;

const CATEGORIAS = ['Hidráulica', 'Elétrica', 'Pintura', 'Dicas Gerais'];

/**
 * Link de afiliado envelhece: oferta expira, produto sai de linha. A ideia é
 * passar o olho toda semana, e não deixar passar de duas.
 * Mexer aqui muda o alerta do painel.
 */
const DIAS_PARA_CONFERIR = 7;
const DIAS_ATRASADO = 15;

/**
 * Lojas do programa de afiliados. Para incluir outra, basta acrescentar aqui
 * e no formulário do painel.
 *
 * Um produto é considerado resolvido com **pelo menos um** link: nem todo
 * item existe nas três, e exigir todas deixaria o painel gritando pendência
 * para sempre. As lojas que faltam aparecem como informação, não como erro.
 */
const LOJAS = [
  { campo: 'linkAmazon', nome: 'Amazon' },
  { campo: 'linkMercadoLivre', nome: 'Mercado Livre' },
  { campo: 'linkShopee', nome: 'Shopee' },
];

/** Quais lojas este produto já tem link, e quais faltam. */
function situacaoDeLojas(produto) {
  const tem = [];
  const faltam = [];
  for (const loja of LOJAS) {
    if (String(produto[loja.campo] || '').trim()) tem.push(loja.nome);
    else faltam.push(loja.nome);
  }
  return { tem, faltam };
}

/** Etapas do pipeline, na ordem em que aparecem no quadro. */
/**
 * O quadro é lista de trabalho, não linha do tempo: uma pendência tem
 * precedência sobre o estado do post. Post já no ar que ainda deve algo
 * aparece na coluna do que falta, com o aviso de que está publicado — senão
 * as colunas de pendência ficariam sempre vazias e não serviriam para nada.
 *
 * As etapas de produção viraram uma só: entre criar o rascunho e montar na
 * collection costuma passar uma sessão inteira, e três colunas para isso
 * ficavam vazias o tempo todo.
 */
const ETAPAS = [
  { id: 'pauta', titulo: 'Pauta definida' },
  { id: 'producao', titulo: 'Em produção' },
  { id: 'monetizacao', titulo: 'Falta link de produto' },
  { id: 'imagem', titulo: 'Falta imagem' },
  { id: 'vincular', titulo: 'Falta vincular no post' },
  { id: 'pronto', titulo: 'Pronto pra publicar' },
  { id: 'publicado', titulo: 'Publicado' },
];

// ---------------------------------------------------------------------------
// utilidades

/** "Chave de Grifo" -> "chave-de-grifo". Mesma regra do slug do blog. */
function slugificar(texto) {
  return String(texto)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Caminho relativo à raiz, sempre com barra normal (Windows usa ). */
function caminhoRelativo(alvo) {
  return path.relative(RAIZ, alvo).split(path.sep).join('/');
}

function lerJson(arquivo, padrao) {
  try {
    return JSON.parse(fs.readFileSync(arquivo, 'utf8'));
  } catch {
    return padrao;
  }
}

function gravarJson(arquivo, dados) {
  fs.writeFileSync(arquivo, JSON.stringify(dados, null, 2) + '\n');
}

function existe(caminho) {
  try {
    fs.accessSync(caminho);
    return true;
  } catch {
    return false;
  }
}

/** Roda git e devolve a saída; string vazia se o comando falhar. */
function git(args) {
  return new Promise((resolve) => {
    execFile('git', args, { cwd: RAIZ }, (erro, saida) => {
      resolve(erro ? '' : saida.trim());
    });
  });
}

// ---------------------------------------------------------------------------
// leitura dos posts

/**
 * Lê o frontmatter de um `index.md` publicado. Só os campos que o painel
 * usa — não é um parser de YAML completo, e não precisa ser.
 */
function lerFrontmatter(texto) {
  const fim = texto.indexOf('\n---', 4);
  if (!texto.startsWith('---') || fim === -1) return { dados: {}, corpo: texto };

  const bloco = texto.slice(3, fim);
  const corpo = texto.slice(fim + 4);
  const dados = {};

  for (const linha of bloco.split('\n')) {
    const sep = linha.indexOf(':');
    if (sep < 1) continue;
    const chave = linha.slice(0, sep).trim();
    let valor = linha.slice(sep + 1).trim();
    if (
      (valor.startsWith("'") && valor.endsWith("'")) ||
      (valor.startsWith('"') && valor.endsWith('"'))
    ) {
      valor = valor.slice(1, -1);
    }
    dados[chave] = valor;
  }
  return { dados, corpo };
}

/**
 * Lê o cabeçalho do rascunho do redator, que usa "CAMPO: valor" em vez de
 * frontmatter YAML.
 */
function lerCabecalhoRascunho(texto) {
  const dados = {};
  const separador = texto.indexOf('\n---');
  const cabecalho = separador === -1 ? texto.slice(0, 2000) : texto.slice(0, separador);

  for (const linha of cabecalho.split('\n')) {
    const sep = linha.indexOf(':');
    if (sep < 1) continue;
    const chave = linha.slice(0, sep).trim();
    if (chave !== chave.toUpperCase()) continue; // só CAMPOS EM CAIXA ALTA
    dados[chave] = linha.slice(sep + 1).trim();
  }
  const corpo = separador === -1 ? texto : texto.slice(separador + 4);
  return { dados, corpo };
}

/**
 * Títulos de seção que costumam abrir uma lista de compras dentro do post.
 * O que está aí é material que a pessoa vai precisar comprar — ou seja,
 * exatamente o que pode virar link de afiliado.
 */
const TITULOS_DE_MATERIAL = [
  'o que você vai precisar',
  'o que voce vai precisar',
  'o que você precisa',
  'do que você vai precisar',
  'materiais',
  'material necessário',
  'lista de materiais',
  'ferramentas',
  'ferramentas necessárias',
  'o que ter em casa',
];

/** Nome de produto não passa disso; acima é frase solta da lista. */
const TAMANHO_MAXIMO_DE_NOME = 48;

/** Tira o marcador, o negrito e o motivo, sobrando só o nome do produto. */
function limparNomeDeProduto(item) {
  let nome = item.replace(/^[-*]\s*/, '');

  // "**Desentupidor de borracha** — o de cozinha" -> pega o negrito
  const negrito = nome.match(/\*\*([^*]+)\*\*/);
  if (negrito) return negrito[1].trim().replace(/[:,.]$/, '');

  // sem negrito, o nome vai até o travessão que abre a explicação
  const travessao = nome.search(/\s[—–-]\s/);
  if (travessao !== -1) nome = nome.slice(0, travessao);

  // e sem travessão, até a primeira vírgula: em "Torneira nova, claro"
  // o que interessa é o que vem antes
  const virgula = nome.indexOf(',');
  if (virgula > 0) nome = nome.slice(0, virgula);

  nome = nome
    .replace(/\([^)]*\)/g, '')
    .replace(/[[\]]/g, '')
    .replace(/\*\*/g, '')
    .trim();

  // frase comprida não é nome de produto — é instrução dentro da lista
  return nome.length > TAMANHO_MAXIMO_DE_NOME ? '' : nome;
}

/** Remove acento e pontuação, para comparar título de seção. */
function normalizar(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .trim();
}

/**
 * Lê a lista de materiais do corpo do post: acha um título de seção que
 * anuncie compras e recolhe os itens de lista logo abaixo.
 *
 * É a segunda fonte de produto monetizável — e a que sobrevive à
 * publicação, porque "PRODUTOS RELACIONADOS" é metadado do rascunho e não
 * vai para o site.
 */
function lerMateriaisDoCorpo(texto) {
  const linhas = texto.split('\n');
  const encontrados = [];
  const alvos = TITULOS_DE_MATERIAL.map(normalizar);

  for (let i = 0; i < linhas.length; i += 1) {
    const titulo = linhas[i].match(/^#{2,4}\s+(.*)$/);
    if (!titulo) continue;

    const limpo = normalizar(titulo[1]);
    if (!alvos.some((alvo) => limpo.includes(alvo))) continue;

    // recolhe os itens até a próxima seção
    for (let j = i + 1; j < linhas.length; j += 1) {
      if (/^#{1,4}\s/.test(linhas[j])) break;
      if (!/^\s*[-*]\s+/.test(linhas[j])) continue;

      const nome = limparNomeDeProduto(linhas[j].trim());
      if (nome && nome.length > 2) encontrados.push(nome);
    }
  }
  return encontrados;
}

/**
 * Extrai a seção PRODUTOS RELACIONADOS.
 * Formato de cada linha: `- nome (marcação) — motivo`
 */
function lerProdutosCitados(texto) {
  const inicio = texto.indexOf('PRODUTOS RELACIONADOS');
  if (inicio === -1) return [];

  const linhas = texto.slice(inicio).split('\n').slice(1);
  const produtos = [];

  for (const linha of linhas) {
    const limpa = linha.trim();
    if (!limpa) {
      if (produtos.length) break; // linha vazia depois de já ter itens = fim da lista
      continue;
    }
    if (!limpa.startsWith('-')) break;

    let item = limpa.replace(/^-\s*/, '');
    // separa o motivo, que vem depois de travessão
    const travessao = item.search(/\s[—–-]\s/);
    if (travessao !== -1) item = item.slice(0, travessao);
    // remove marcações do tipo (já cadastrado)
    const nome = item.replace(/\([^)]*\)/g, '').replace(/[\[\]]/g, '').trim();
    if (nome) produtos.push(nome);
  }
  return produtos;
}

/**
 * Junta as duas fontes de produto sem repetir, marcando de onde cada um veio.
 * Quando o mesmo item aparece nas duas, vale "sugerido" — é a intenção
 * explícita do redator, e costuma trazer o nome mais completo.
 */
function juntarProdutos(sugeridos, materiais) {
  const juntos = new Map();

  for (const nome of sugeridos) {
    const chave = slugificar(nome);
    if (chave) juntos.set(chave, { nome, origem: 'sugerido' });
  }
  for (const nome of materiais) {
    const chave = slugificar(nome);
    if (chave && !juntos.has(chave)) juntos.set(chave, { nome, origem: 'material' });
  }
  return [...juntos.values()];
}

/**
 * Data que representa o post para ordenar o painel. Usa a data de publicação
 * quando existe; senão, quando o arquivo foi mexido pela última vez.
 */
function dataDoPost(pubDate, arquivo) {
  const doFrontmatter = String(pubDate || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(doFrontmatter)) return doFrontmatter.slice(0, 10);
  try {
    return fs.statSync(arquivo).mtime.toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

/** Confere se o rascunho tem tudo que a publicação vai exigir. */
function rascunhoCompleto(dados, corpo) {
  const temTitulo = Boolean(dados['TÍTULO'] || dados['TITULO']);
  const temDescricao = Boolean(dados['DESCRIÇÃO'] || dados['DESCRICAO']);
  const temCategoria = CATEGORIAS.includes((dados['CATEGORIA'] || '').trim());
  const temCorpo = corpo.trim().length > 400;
  return temTitulo && temDescricao && temCategoria && temCorpo;
}

/** Lista os rascunhos, aceitando `<slug>/post.md` e `<slug>.md`. */
function lerRascunhos() {
  if (!existe(PASTA_DRAFTS)) return new Map();
  const mapa = new Map();

  for (const entrada of fs.readdirSync(PASTA_DRAFTS, { withFileTypes: true })) {
    if (entrada.name.startsWith('_') || entrada.name.startsWith('.')) continue;

    let arquivo = null;
    let pasta = null;

    if (entrada.isDirectory()) {
      pasta = path.join(PASTA_DRAFTS, entrada.name);
      for (const nome of ['post.md', 'index.md', `${entrada.name}.md`]) {
        if (existe(path.join(pasta, nome))) {
          arquivo = path.join(pasta, nome);
          break;
        }
      }
    } else if (entrada.name.endsWith('.md')) {
      arquivo = path.join(PASTA_DRAFTS, entrada.name);
    }
    if (!arquivo) continue;

    const slug = entrada.isDirectory() ? entrada.name : entrada.name.replace(/\.md$/, '');
    const texto = fs.readFileSync(arquivo, 'utf8');
    const { dados, corpo } = lerCabecalhoRascunho(texto);

    mapa.set(slug, {
      slug,
      arquivo,
      pasta,
      texto,
      corpo,
      titulo: dados['TÍTULO'] || dados['TITULO'] || slug,
      descricao: dados['DESCRIÇÃO'] || dados['DESCRICAO'] || '',
      categoria: (dados['CATEGORIA'] || '').trim(),
      completo: rascunhoCompleto(dados, corpo),
      data: dataDoPost(dados['DATA'], arquivo),
      produtos: juntarProdutos(lerProdutosCitados(texto), lerMateriaisDoCorpo(corpo)),
      temPromptsPendentes: pasta ? existe(path.join(pasta, 'prompts-imagens.md')) : false,
    });
  }
  return mapa;
}

/** Lista os posts que já estão na collection do Astro. */
function lerPublicados() {
  if (!existe(PASTA_POSTS)) return new Map();
  const mapa = new Map();

  for (const entrada of fs.readdirSync(PASTA_POSTS, { withFileTypes: true })) {
    if (!entrada.isDirectory()) continue;
    const pasta = path.join(PASTA_POSTS, entrada.name);
    const arquivo = path.join(pasta, 'index.md');
    if (!existe(arquivo)) continue;

    const texto = fs.readFileSync(arquivo, 'utf8');
    const { dados, corpo } = lerFrontmatter(texto);

    // slugs já gravados no frontmatter, para saber o que falta vincular
    const jaVinculados = [];
    let dentroDeMateriais = false;
    for (const bruta of texto.split('\n')) {
      const linha = bruta.replace(/\r$/, '');
      if (linha.startsWith('materiais:')) { dentroDeMateriais = true; continue; }
      if (dentroDeMateriais) {
        const item = linha.match(/^\s+-\s+(.+)$/);
        if (item) { jaVinculados.push(item[1].trim()); continue; }
        dentroDeMateriais = false;
      }
    }

    // "PRODUTOS RELACIONADOS" é metadado de produção e não vai para o site,
    // então some quando o post é publicado. O rascunho, quando ainda existe,
    // guarda a sugestão do redator — vale recuperar de lá.
    const rascunho = path.join(PASTA_DRAFTS, entrada.name, 'post.md');
    const sugeridos = existe(rascunho)
      ? lerProdutosCitados(fs.readFileSync(rascunho, 'utf8'))
      : [];

    mapa.set(entrada.name, {
      slug: entrada.name,
      arquivo,
      pasta,
      texto,
      corpo,
      titulo: dados.title || entrada.name,
      descricao: dados.description || '',
      categoria: dados.category || '',
      ehRascunho: String(dados.draft).trim() === 'true',
      jaVinculados,
      data: dataDoPost(dados.pubDate, arquivo),
      produtos: juntarProdutos(
        [...lerProdutosCitados(texto), ...sugeridos],
        lerMateriaisDoCorpo(corpo)
      ),
      temPromptsPendentes: existe(path.join(pasta, 'prompts-imagens.md')),
      temBannerPendente: texto.includes('[BANNER DE ANÚNCIO PENDENTE]'),
    });
  }
  return mapa;
}

// ---------------------------------------------------------------------------
// criação do rascunho

/**
 * Cria `drafts/<slug>/post.md` com o cabeçalho que o redator usa, já
 * preenchido com o que a pauta sabe. O corpo fica vazio de propósito: com
 * título mas sem descrição nem texto, o card cai em "Rascunho em andamento"
 * e só passa para "Aguardando revisão" quando estiver completo de verdade.
 */
function criarRascunho(pauta) {
  const slug = pauta.slug || slugificar(pauta.titulo);
  const pasta = path.join(PASTA_DRAFTS, slug);
  const arquivo = path.join(pasta, 'post.md');

  if (existe(arquivo)) {
    return { ja: true, caminho: caminhoRelativo(arquivo) };
  }

  const linhas = [
    `TÍTULO: ${pauta.titulo}`,
    'DESCRIÇÃO: ',
    `CATEGORIA: ${pauta.categoria || ''}`,
    'TAGS: ',
    'SUGESTÃO DE IMAGEM DE CAPA: ',
    'ALT TEXT DA IMAGEM: ',
    '',
    '---',
    '',
  ];
  if (pauta.observacao) {
    linhas.push(`<!-- da pauta: ${pauta.observacao} -->`, '');
  }

  fs.mkdirSync(pasta, { recursive: true });
  fs.writeFileSync(arquivo, linhas.join('\n'));
  return { ja: false, caminho: caminhoRelativo(arquivo) };
}

// ---------------------------------------------------------------------------
// validade dos links

/** Há quantos dias os links deste produto foram conferidos. */
function diasDesde(data) {
  if (!data) return null;
  const quando = new Date(data + 'T00:00:00');
  if (Number.isNaN(quando.getTime())) return null;
  return Math.floor((Date.now() - quando.getTime()) / 86400000);
}

/**
 * Só entra na revisão o produto que já tem os dois links — produto sem link
 * é outra pendência, e aparece na lista de cadastro.
 */
function montarRevisaoDeLinks(catalogo) {
  const revisao = [];
  for (const [chave, p] of Object.entries(catalogo)) {
    // produto sem link nenhum é pendência de cadastro, não de validade
    if (!situacaoDeLojas(p).tem.length) continue;
    if (p.ignorar) continue;

    const dias = diasDesde(p.atualizadoEm);
    if (dias === null || dias < DIAS_PARA_CONFERIR) continue;

    revisao.push({
      chave,
      nome: p.nome,
      dias,
      atrasado: dias >= DIAS_ATRASADO,
    });
  }
  return revisao.sort((a, b) => b.dias - a.dias);
}

// ---------------------------------------------------------------------------
// cruzamento com o catálogo de produtos

/**
 * Para cada produto citado, decide se está resolvido, se falta link, ou se
 * nem existe no catálogo ainda.
 */
/**
 * Acha o produto no catálogo pelo nome ou por um dos apelidos.
 *
 * O post cita "Desentupidor de borracha" e o catálogo tem "Desentupidor de
 * borracha para pia" — mesmo item, nome diferente. Em vez de adivinhar por
 * semelhança, que erraria, o usuário vincula uma vez e o apelido fica
 * gravado para todos os posts.
 */
function acharNoCatalogo(nomeCitado, catalogo) {
  const chave = slugificar(nomeCitado);
  if (catalogo[chave]) return { chave, produto: catalogo[chave] };

  for (const [k, produto] of Object.entries(catalogo)) {
    const apelidos = Array.isArray(produto.apelidos) ? produto.apelidos : [];
    if (apelidos.some((a) => slugificar(a) === chave)) {
      return { chave: k, produto };
    }
  }
  return null;
}

function cruzarProdutos(citados, catalogo) {
  return citados.map(({ nome, origem }) => {
    const achado = acharNoCatalogo(nome, catalogo);
    const chave = achado ? achado.chave : slugificar(nome);
    const cadastrado = achado ? achado.produto : null;

    if (!cadastrado) {
      return { nome, chave, origem, situacao: 'nao-cadastrado' };
    }

    // item marcado como "não vale link" sai de vez das pendências:
    // detergente, pano velho e afins aparecem na lista de materiais mas
    // ninguém compra por link de afiliado
    if (cadastrado.ignorar) {
      return { nome: cadastrado.nome, chave, origem, situacao: 'ignorado' };
    }

    const { tem, faltam } = situacaoDeLojas(cadastrado);

    if (tem.length) {
      return {
        nome: cadastrado.nome,
        chave,
        situacao: 'resolvido',
        produto: cadastrado,
        lojas: tem,
        faltando: faltam,
      };
    }
    return {
      nome: cadastrado.nome,
      chave,
      situacao: 'sem-link',
      produto: cadastrado,
      faltando: faltam,
    };
  });
}

// ---------------------------------------------------------------------------
// montagem do quadro

async function montarEstado() {
  const pautas = lerJson(ARQ_PAUTAS, []);
  const catalogo = lerJson(ARQ_PRODUTOS, {});
  const rascunhos = lerRascunhos();
  const publicados = lerPublicados();

  // um post está "publicado" quando a pasta dele já entrou no histórico do Git
  const noGit = new Set();
  for (const slug of publicados.keys()) {
    const saida = await git([
      'log',
      '--diff-filter=A',
      '--format=%H',
      '-1',
      '--',
      `src/content/posts/${slug}`,
    ]);
    if (saida) noGit.add(slug);
  }

  const cards = [];
  const vistos = new Set();

  // 1) posts que já estão na collection
  for (const [slug, post] of publicados) {
    vistos.add(slug);
    const produtos = cruzarProdutos(post.produtos, catalogo);
    const semLink = produtos.filter(
      (p) => p.situacao !== 'resolvido' && p.situacao !== 'ignorado'
    );
    const pendencias = [];

    if (semLink.length) {
      pendencias.push({
        tipo: 'monetizacao',
        texto: `${semLink.length} produto${semLink.length > 1 ? 's' : ''} sem link`,
      });
    }
    if (post.temBannerPendente) {
      pendencias.push({ tipo: 'monetizacao', texto: 'banner de anúncio pendente' });
    }
    if (post.temPromptsPendentes) {
      pendencias.push({ tipo: 'imagem', texto: 'imagens de passo pendentes' });
    }

    // produtos com link que ainda não estão gravados no frontmatter
    const comLink = [
      ...new Set(produtos.filter((p) => p.situacao === 'resolvido').map((p) => p.chave)),
    ];
    const faltaVincular = comLink.filter((c) => !post.jaVinculados.includes(c));
    if (faltaVincular.length) {
      pendencias.push({
        tipo: 'vincular',
        texto: `${faltaVincular.length} link${faltaVincular.length > 1 ? 's' : ''} pra vincular`,
      });
    }

    // pendência vem antes do estado: o quadro mostra o que falta fazer
    let etapa;
    if (semLink.length || post.temBannerPendente) etapa = 'monetizacao';
    else if (post.temPromptsPendentes) etapa = 'imagem';
    else if (faltaVincular.length) etapa = 'vincular';
    else if (noGit.has(slug)) etapa = 'publicado';
    else if (post.ehRascunho) etapa = 'producao';
    else etapa = 'pronto';

    cards.push({
      slug,
      etapa,
      titulo: post.titulo,
      categoria: post.categoria,
      descricao: post.descricao,
      origem: 'publicado',
      data: post.data,
      noAr: noGit.has(slug),
      jaVinculados: post.jaVinculados,
      caminho: path.relative(RAIZ, post.arquivo).replace(/\\/g, '/'),
      produtos,
      pendencias,
      corpo: post.corpo,
    });
  }

  // 2) rascunhos ainda fora da collection
  for (const [slug, rascunho] of rascunhos) {
    if (vistos.has(slug)) continue;
    vistos.add(slug);
    const produtos = cruzarProdutos(rascunho.produtos, catalogo);
    const semLink = produtos.filter(
      (p) => p.situacao !== 'resolvido' && p.situacao !== 'ignorado'
    );
    const pendencias = [];

    if (semLink.length) {
      pendencias.push({
        tipo: 'monetizacao',
        texto: `${semLink.length} produto${semLink.length > 1 ? 's' : ''} sem link`,
      });
    }
    if (rascunho.temPromptsPendentes) {
      pendencias.push({ tipo: 'imagem', texto: 'imagens de passo pendentes' });
    }

    cards.push({
      slug,
      etapa: 'producao',
      titulo: rascunho.titulo,
      categoria: rascunho.categoria,
      descricao: rascunho.descricao,
      origem: 'rascunho',
      data: rascunho.data,
      caminho: path.relative(RAIZ, rascunho.arquivo).replace(/\\/g, '/'),
      produtos,
      pendencias,
      corpo: rascunho.corpo,
    });
  }

  // 3) pautas que ainda não viraram rascunho
  for (const pauta of pautas) {
    const slug = pauta.slug || slugificar(pauta.titulo);
    if (vistos.has(slug)) continue;
    cards.push({
      slug,
      etapa: 'pauta',
      titulo: pauta.titulo,
      categoria: pauta.categoria || '',
      descricao: pauta.observacao || '',
      origem: 'pauta',
      data: pauta.criadaEm || '',
      idPauta: pauta.id,
      produtos: [],
      pendencias: [],
      corpo: '',
    });
  }

  // pendências de produto agrupadas: cada produto aparece uma vez só,
  // mesmo citado em vários posts
  const porProduto = new Map();
  for (const card of cards) {
    for (const p of card.produtos) {
      if (p.situacao === 'resolvido' || p.situacao === 'ignorado') continue;
      if (!porProduto.has(p.chave)) {
        porProduto.set(p.chave, { ...p, posts: [] });
      }
      porProduto.get(p.chave).posts.push(card.titulo);
    }
  }

  // mais recentes primeiro, em qualquer lugar que a lista apareça
  cards.sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));

  return {
    etapas: ETAPAS,
    categorias: CATEGORIAS,
    cards,
    pautas,
    catalogo,
    pendenciasDeProduto: [...porProduto.values()],
    revisaoDeLinks: montarRevisaoDeLinks(catalogo),
    lojas: LOJAS,
    prazos: { conferir: DIAS_PARA_CONFERIR, atrasado: DIAS_ATRASADO },
  };
}

// ---------------------------------------------------------------------------
// servidor

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

function responderJson(res, dados, status = 200) {
  const corpo = JSON.stringify(dados);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(corpo);
}

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    let dados = '';
    req.on('data', (parte) => {
      dados += parte;
      if (dados.length > 1e6) reject(new Error('corpo grande demais'));
    });
    req.on('end', () => {
      try {
        resolve(dados ? JSON.parse(dados) : {});
      } catch {
        reject(new Error('JSON inválido'));
      }
    });
  });
}

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORTA}`);
  const rota = url.pathname;

  try {
    // ---- API ----
    if (rota === '/api/estado' && req.method === 'GET') {
      return responderJson(res, await montarEstado());
    }

    if (rota === '/api/pautas' && req.method === 'POST') {
      const corpo = await lerCorpo(req);
      const titulo = String(corpo.titulo || '').trim();
      if (!titulo) return responderJson(res, { erro: 'informe o título da pauta' }, 400);

      const pautas = lerJson(ARQ_PAUTAS, []);
      const nova = {
        id: Date.now().toString(36),
        titulo,
        slug: slugificar(titulo),
        categoria: corpo.categoria || '',
        observacao: corpo.observacao || '',
        criadaEm: new Date().toISOString().slice(0, 10),
      };
      if (pautas.some((p) => p.slug === nova.slug)) {
        return responderJson(res, { erro: 'já existe uma pauta com esse nome' }, 409);
      }
      pautas.push(nova);
      gravarJson(ARQ_PAUTAS, pautas);

      let rascunho = null;
      if (corpo.criarRascunho) rascunho = criarRascunho(nova);

      return responderJson(res, { ...nova, rascunho }, 201);
    }

    if (rota.endsWith('/rascunho') && req.method === 'POST') {
      const id = decodeURIComponent(
        rota.slice('/api/pautas/'.length, -'/rascunho'.length)
      );
      const pauta = lerJson(ARQ_PAUTAS, []).find((p) => p.id === id);
      if (!pauta) return responderJson(res, { erro: 'pauta não encontrada' }, 404);
      return responderJson(res, criarRascunho(pauta), 201);
    }

    if (rota.startsWith('/api/pautas/') && req.method === 'DELETE') {
      const id = decodeURIComponent(rota.slice('/api/pautas/'.length));
      const pautas = lerJson(ARQ_PAUTAS, []);
      const restantes = pautas.filter((p) => p.id !== id);
      if (restantes.length === pautas.length) {
        return responderJson(res, { erro: 'pauta não encontrada' }, 404);
      }
      gravarJson(ARQ_PAUTAS, restantes);
      return responderJson(res, { ok: true });
    }

    if (rota === '/api/produtos' && req.method === 'POST') {
      const corpo = await lerCorpo(req);
      const nome = String(corpo.nome || '').trim();
      if (!nome) return responderJson(res, { erro: 'informe o nome do produto' }, 400);

      const catalogo = lerJson(ARQ_PRODUTOS, {});
      const chave = slugificar(nome);
      catalogo[chave] = {
        nome,
        tags: String(corpo.tags || '').trim(),
        linkAmazon: String(corpo.linkAmazon || '').trim(),
        linkMercadoLivre: String(corpo.linkMercadoLivre || '').trim(),
        linkShopee: String(corpo.linkShopee || '').trim(),
        observacao: String(corpo.observacao || '').trim(),
        ignorar: Boolean(corpo.ignorar),
        apelidos: Array.isArray(corpo.apelidos)
          ? corpo.apelidos.map((a) => String(a).trim()).filter(Boolean)
          : (catalogo[chave]?.apelidos ?? []),
        atualizadoEm: new Date().toISOString().slice(0, 10),
      };
      gravarJson(ARQ_PRODUTOS, catalogo);
      return responderJson(res, { chave, ...catalogo[chave] }, 201);
    }

    if (rota.endsWith('/materiais') && req.method === 'POST') {
      const slug = decodeURIComponent(
        rota.slice('/api/posts/'.length, -'/materiais'.length)
      );
      const arquivo = path.join(PASTA_POSTS, slug, 'index.md');
      if (!existe(arquivo)) return responderJson(res, { erro: 'post não encontrado' }, 404);

      const corpo = await lerCorpo(req);
      // sem repetição: dois nomes citados no post podem apontar para o mesmo
      // produto do catálogo, e no bloco ele aparece uma vez só
      const chaves = Array.isArray(corpo.materiais)
        ? [...new Set(corpo.materiais.map((c) => String(c).trim()).filter(Boolean))]
        : [];

      const texto = fs.readFileSync(arquivo, 'utf8');
      const fim = texto.indexOf('\n---', 4);
      if (!texto.startsWith('---') || fim === -1) {
        return responderJson(res, { erro: 'frontmatter não reconhecido' }, 422);
      }

      // o arquivo pode estar em CRLF: começa depois da primeira quebra de
      // linha, seja ela qual for, em vez de contar bytes na mão
      const inicio = texto.indexOf('\n') + 1;

      // reescreve só o campo materiais, preservando o resto do frontmatter
      const linhas = texto
        .slice(inicio, fim)
        .split('\n')
        .map((l) => l.replace(/\r$/, ''));
      const semMateriais = [];
      let dentro = false;
      for (const linha of linhas) {
        if (linha.startsWith('materiais:')) { dentro = true; continue; }
        if (dentro) {
          if (/^\s+-\s/.test(linha)) continue;
          dentro = false;
        }
        semMateriais.push(linha);
      }

      if (chaves.length) {
        semMateriais.push('materiais:');
        for (const chave of chaves) semMateriais.push('  - ' + chave);
      }

      const novo = '---\n' + semMateriais.join('\n') + '\n---' + texto.slice(fim + 4);
      fs.writeFileSync(arquivo, novo);
      return responderJson(res, { ok: true, gravados: chaves.length });
    }

    if (rota.endsWith('/apelido') && req.method === 'POST') {
      const chave = decodeURIComponent(
        rota.slice('/api/produtos/'.length, -'/apelido'.length)
      );
      const catalogo = lerJson(ARQ_PRODUTOS, {});
      if (!catalogo[chave]) return responderJson(res, { erro: 'produto não encontrado' }, 404);

      const corpo = await lerCorpo(req);
      const apelido = String(corpo.apelido || '').trim();
      if (!apelido) return responderJson(res, { erro: 'informe o apelido' }, 400);

      const atuais = Array.isArray(catalogo[chave].apelidos)
        ? catalogo[chave].apelidos
        : [];
      if (!atuais.some((a) => slugificar(a) === slugificar(apelido))) {
        atuais.push(apelido);
      }
      catalogo[chave].apelidos = atuais;
      gravarJson(ARQ_PRODUTOS, catalogo);
      return responderJson(res, { ok: true, apelidos: atuais });
    }

    if (rota.endsWith('/conferir') && req.method === 'POST') {
      const chave = decodeURIComponent(
        rota.slice('/api/produtos/'.length, -'/conferir'.length)
      );
      const catalogo = lerJson(ARQ_PRODUTOS, {});
      if (!catalogo[chave]) return responderJson(res, { erro: 'produto não encontrado' }, 404);
      catalogo[chave].atualizadoEm = new Date().toISOString().slice(0, 10);
      gravarJson(ARQ_PRODUTOS, catalogo);
      return responderJson(res, { ok: true, atualizadoEm: catalogo[chave].atualizadoEm });
    }

    if (rota.startsWith('/api/produtos/') && req.method === 'DELETE') {
      const chave = decodeURIComponent(rota.slice('/api/produtos/'.length));
      const catalogo = lerJson(ARQ_PRODUTOS, {});
      if (!catalogo[chave]) return responderJson(res, { erro: 'produto não encontrado' }, 404);
      delete catalogo[chave];
      gravarJson(ARQ_PRODUTOS, catalogo);
      return responderJson(res, { ok: true });
    }

    if (rota.startsWith('/api/')) {
      return responderJson(res, { erro: 'rota não encontrada' }, 404);
    }

    // ---- estáticos ----
    const nome = rota === '/' ? 'index.html' : rota.slice(1);
    const arquivo = path.join(AQUI, nome);
    // não deixa sair da pasta do painel
    if (!arquivo.startsWith(AQUI) || !existe(arquivo)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('não encontrado');
    }
    res.writeHead(200, {
      'Content-Type': TIPOS[path.extname(arquivo)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    return res.end(fs.readFileSync(arquivo));
  } catch (erro) {
    return responderJson(res, { erro: erro.message }, 500);
  }
});

servidor.on('error', (erro) => {
  if (erro.code === 'EADDRINUSE') {
    console.error(`\nA porta ${PORTA} já está ocupada.`);
    console.error('Feche o que está usando ela, ou rode com outra porta:');
    console.error(`  PORTA_PAINEL=5174 npm run painel\n`);
    process.exit(1);
  }
  throw erro;
});

servidor.listen(PORTA, () => {
  console.log('\n  Painel do Crescendo na Obra');
  console.log(`  http://localhost:${PORTA}`);
  console.log('\n  Lê o estado direto dos arquivos a cada carregamento.');
  console.log('  Ctrl+C para encerrar.\n');
});
