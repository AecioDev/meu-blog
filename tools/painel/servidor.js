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
const ETAPAS = [
  { id: 'pauta', titulo: 'Pauta definida' },
  { id: 'rascunho', titulo: 'Rascunho em andamento' },
  { id: 'revisao', titulo: 'Aguardando revisão' },
  { id: 'estrutura', titulo: 'Publicado na estrutura (rascunho)' },
  { id: 'monetizacao', titulo: 'Pendências de monetização' },
  { id: 'imagem', titulo: 'Pendências de imagem' },
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
      produtos: lerProdutosCitados(texto),
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
      produtos: lerProdutosCitados(texto),
      temPromptsPendentes: existe(path.join(pasta, 'prompts-imagens.md')),
      temBannerPendente: texto.includes('[BANNER DE ANÚNCIO PENDENTE]'),
    });
  }
  return mapa;
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
function cruzarProdutos(citados, catalogo) {
  return citados.map((nome) => {
    const chave = slugificar(nome);
    const cadastrado = catalogo[chave];

    if (!cadastrado) {
      return { nome, chave, situacao: 'nao-cadastrado' };
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
    const semLink = produtos.filter((p) => p.situacao !== 'resolvido');
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

    let etapa;
    if (noGit.has(slug)) etapa = 'publicado';
    else if (post.ehRascunho) etapa = 'estrutura';
    else if (semLink.length || post.temBannerPendente) etapa = 'monetizacao';
    else if (post.temPromptsPendentes) etapa = 'imagem';
    else etapa = 'pronto';

    cards.push({
      slug,
      etapa,
      titulo: post.titulo,
      categoria: post.categoria,
      descricao: post.descricao,
      origem: 'publicado',
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
    const semLink = produtos.filter((p) => p.situacao !== 'resolvido');
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
      etapa: rascunho.completo ? 'revisao' : 'rascunho',
      titulo: rascunho.titulo,
      categoria: rascunho.categoria,
      descricao: rascunho.descricao,
      origem: 'rascunho',
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
      if (p.situacao === 'resolvido') continue;
      if (!porProduto.has(p.chave)) {
        porProduto.set(p.chave, { ...p, posts: [] });
      }
      porProduto.get(p.chave).posts.push(card.titulo);
    }
  }

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
      return responderJson(res, nova, 201);
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
        atualizadoEm: new Date().toISOString().slice(0, 10),
      };
      gravarJson(ARQ_PRODUTOS, catalogo);
      return responderJson(res, { chave, ...catalogo[chave] }, 201);
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
