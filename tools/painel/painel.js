/**
 * Frontend do painel. Sem framework de propósito: o servidor entrega o
 * estado já mastigado em /api/estado, e aqui a gente só desenha.
 */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

let estado = { etapas: [], categorias: [], cards: [], catalogo: {}, pendenciasDeProduto: [] };

// ---------------------------------------------------------------------------
// utilidades

function slugificar(texto) {
  return String(texto)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function api(rota, opcoes) {
  const res = await fetch(rota, {
    headers: { 'Content-Type': 'application/json' },
    ...opcoes,
  });
  const dados = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(dados.erro || `falha em ${rota}`);
  return dados;
}

/** Cria elemento com texto — evita innerHTML com dado vindo de arquivo. */
function el(tag, classe, texto) {
  const node = document.createElement(tag);
  if (classe) node.className = classe;
  if (texto !== undefined) node.textContent = texto;
  return node;
}

// ---------------------------------------------------------------------------
// carregamento

async function carregar() {
  estado = await api('/api/estado');
  desenharQuadro();
  desenharProdutos();
  preencherCategorias();
}

function preencherCategorias() {
  const select = $('#form-pauta select[name=categoria]');
  const atual = select.value;
  select.length = 1;
  for (const c of estado.categorias) {
    select.append(new Option(c, c));
  }
  select.value = atual;
}

// ---------------------------------------------------------------------------
// quadro

function desenharQuadro() {
  const quadro = $('#quadro');
  quadro.textContent = '';

  for (const etapa of estado.etapas) {
    const cards = estado.cards.filter((c) => c.etapa === etapa.id);

    const coluna = el('div', 'coluna');
    coluna.dataset.etapa = etapa.id;

    const titulo = el('h2');
    titulo.append(el('span', null, etapa.titulo));
    titulo.append(el('span', 'contador', String(cards.length)));
    coluna.append(titulo);

    if (!cards.length) {
      coluna.append(el('p', 'vazia', 'nada por aqui'));
    }

    for (const card of cards) {
      coluna.append(montarCard(card));
    }
    quadro.append(coluna);
  }

  const pendentes = estado.pendenciasDeProduto.length;
  $('#resumo-pendencias').textContent = pendentes
    ? `${pendentes} produto${pendentes > 1 ? 's' : ''} de afiliado aguardando cadastro ou link`
    : 'Nenhuma pendência de produto de afiliado.';
}

function montarCard(card) {
  const botao = el('button', 'card');
  botao.type = 'button';
  botao.append(el('span', 'titulo', card.titulo));

  const meta = el('div', 'meta');
  if (card.categoria) {
    meta.append(el('span', `chip categoria ${slugificar(card.categoria)}`, card.categoria));
  }
  if (card.origem === 'pauta') {
    meta.append(el('span', 'chip pauta', 'só pauta'));
  }
  for (const p of card.pendencias) {
    meta.append(el('span', 'chip alerta', p.texto));
  }
  botao.append(meta);

  botao.addEventListener('click', () => abrirDetalhe(card));
  return botao;
}

// ---------------------------------------------------------------------------
// detalhe do card

function abrirDetalhe(card) {
  const alvo = $('#detalhe-card');
  alvo.textContent = '';

  alvo.append(el('h2', null, card.titulo));
  alvo.append(el('p', 'caminho', card.caminho || 'ainda sem arquivo — só a pauta registrada'));

  if (card.descricao) {
    alvo.append(el('p', null, card.descricao));
  }

  // --- produtos citados ---
  alvo.append(el('h3', null, 'Produtos relacionados'));

  if (!card.produtos.length) {
    alvo.append(el('p', 'vazia', 'Nenhum produto citado neste post.'));
  }

  for (const p of card.produtos) {
    const linha = el('div', 'produto-linha');
    linha.append(el('span', 'nome', p.nome));

    if (p.situacao === 'resolvido') {
      linha.append(el('span', 'link-ok', 'links completos'));
      for (const [rotulo, href] of [
        ['Mercado Livre', p.produto.linkMercadoLivre],
        ['Amazon', p.produto.linkAmazon],
      ]) {
        const a = el('a', null, rotulo);
        a.href = href;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        linha.append(a);
      }
    } else if (p.situacao === 'link-incompleto') {
      linha.append(el('span', 'link-falta', `falta: ${p.faltando.join(' e ')}`));
      const b = el('button', 'botao-secundario', 'Completar');
      b.type = 'button';
      b.addEventListener('click', () => {
        $('#dialogo-card').close();
        abrirFormularioProduto(p.produto, p.chave);
      });
      linha.append(b);
    } else {
      linha.append(el('span', 'link-falta', 'não está no catálogo'));
      const b = el('button', 'botao-secundario', 'Cadastrar');
      b.type = 'button';
      b.addEventListener('click', () => {
        $('#dialogo-card').close();
        abrirFormularioProduto({ nome: p.nome }, null);
      });
      linha.append(b);
    }
    alvo.append(linha);
  }

  // --- texto ---
  if (card.corpo && card.corpo.trim()) {
    alvo.append(el('h3', null, 'Texto'));
    alvo.append(el('div', 'corpo', card.corpo.trim()));
  }

  // --- apagar pauta ---
  if (card.origem === 'pauta') {
    const b = el('button', 'botao-secundario', 'Descartar esta pauta');
    b.type = 'button';
    b.style.marginTop = '16px';
    b.addEventListener('click', async () => {
      await api(`/api/pautas/${encodeURIComponent(card.idPauta)}`, { method: 'DELETE' });
      $('#dialogo-card').close();
      carregar();
    });
    alvo.append(b);
  }

  $('#dialogo-card').showModal();
}

// ---------------------------------------------------------------------------
// produtos

function desenharProdutos() {
  const busca = $('#busca-produto').value.trim().toLowerCase();
  const lista = $('#lista-produtos');
  lista.textContent = '';

  const entradas = Object.entries(estado.catalogo)
    .filter(([, p]) => {
      if (!busca) return true;
      return (
        p.nome.toLowerCase().includes(busca) ||
        (p.tags || '').toLowerCase().includes(busca)
      );
    })
    .sort((a, b) => a[1].nome.localeCompare(b[1].nome, 'pt-BR'));

  if (!entradas.length) {
    lista.append(
      el(
        'p',
        'vazia',
        busca
          ? 'Nenhum produto encontrado com esse termo.'
          : 'Catálogo vazio. Cadastre o primeiro produto no botão acima.'
      )
    );
  }

  for (const [chave, p] of entradas) {
    const cartao = el('div', 'produto');
    cartao.append(el('h3', null, p.nome));
    if (p.tags) cartao.append(el('span', 'chip', p.tags));

    const links = el('div', 'links');
    for (const [rotulo, href] of [
      ['Mercado Livre', p.linkMercadoLivre],
      ['Amazon', p.linkAmazon],
    ]) {
      if (href) {
        const a = el('a', 'link-ok', `${rotulo}: cadastrado`);
        a.href = href;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        links.append(a);
      } else {
        links.append(el('span', 'link-falta', `${rotulo}: falta`));
      }
    }
    cartao.append(links);

    if (p.observacao) cartao.append(el('p', 'vazia', p.observacao));

    const menu = el('menu');
    const editar = el('button', 'botao-secundario', 'Editar');
    editar.type = 'button';
    editar.addEventListener('click', () => abrirFormularioProduto(p, chave));
    menu.append(editar);

    const apagar = el('button', 'botao-secundario', 'Remover');
    apagar.type = 'button';
    apagar.addEventListener('click', async () => {
      if (!confirm(`Remover "${p.nome}" do catálogo?`)) return;
      await api(`/api/produtos/${encodeURIComponent(chave)}`, { method: 'DELETE' });
      carregar();
    });
    menu.append(apagar);
    cartao.append(menu);

    lista.append(cartao);
  }

  desenharPendenciasCatalogo();
}

function desenharPendenciasCatalogo() {
  const alvo = $('#pendencias-catalogo');
  alvo.textContent = '';
  if (!estado.pendenciasDeProduto.length) return;

  const caixa = el('div', 'aviso');
  caixa.append(el('h2', null, 'Produtos citados nos posts que ainda travam a monetização'));

  const ul = el('ul');
  for (const p of estado.pendenciasDeProduto) {
    const li = el('li');
    const situacao =
      p.situacao === 'nao-cadastrado'
        ? 'não está no catálogo'
        : `falta ${p.faltando.join(' e ')}`;
    li.append(document.createTextNode(`${p.nome} — ${situacao} · citado em: ${p.posts.join(', ')}`));

    const b = el('button', null, p.situacao === 'nao-cadastrado' ? 'cadastrar' : 'completar');
    b.type = 'button';
    b.addEventListener('click', () =>
      abrirFormularioProduto(p.produto || { nome: p.nome }, p.produto ? p.chave : null)
    );
    li.append(b);
    ul.append(li);
  }
  caixa.append(ul);
  alvo.append(caixa);
}

function abrirFormularioProduto(produto = {}, chave = null) {
  const form = $('#form-produto');
  form.reset();
  form.nome.value = produto.nome || '';
  form.tags.value = produto.tags || '';
  form.linkMercadoLivre.value = produto.linkMercadoLivre || '';
  form.linkAmazon.value = produto.linkAmazon || '';
  form.observacao.value = produto.observacao || '';
  form.dataset.chave = chave || '';
  form.querySelector('[data-erro]').hidden = true;
  trocarTela('produtos');
  $('#dialogo-produto').showModal();
}

// ---------------------------------------------------------------------------
// telas e eventos

function trocarTela(nome) {
  $$('.menu button').forEach((b) => b.classList.toggle('ativo', b.dataset.tela === nome));
  $('#tela-quadro').hidden = nome !== 'quadro';
  $('#tela-produtos').hidden = nome !== 'produtos';
}

$$('.menu button').forEach((b) =>
  b.addEventListener('click', () => trocarTela(b.dataset.tela))
);

$('#recarregar').addEventListener('click', carregar);
$('#busca-produto').addEventListener('input', desenharProdutos);

$('#abrir-nova-pauta').addEventListener('click', () => {
  const form = $('#form-pauta');
  form.reset();
  form.querySelector('[data-erro]').hidden = true;
  $('#dialogo-pauta').showModal();
});

$('#abrir-novo-produto').addEventListener('click', () => abrirFormularioProduto());

$$('[data-fechar]').forEach((b) =>
  b.addEventListener('click', () => b.closest('dialog').close())
);

$('#form-pauta').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const form = evento.target;
  const erro = form.querySelector('[data-erro]');
  try {
    await api('/api/pautas', {
      method: 'POST',
      body: JSON.stringify({
        titulo: form.titulo.value,
        categoria: form.categoria.value,
        observacao: form.observacao.value,
      }),
    });
    $('#dialogo-pauta').close();
    await carregar();
  } catch (e) {
    erro.textContent = e.message;
    erro.hidden = false;
  }
});

$('#form-produto').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const form = evento.target;
  const erro = form.querySelector('[data-erro]');
  try {
    await api('/api/produtos', {
      method: 'POST',
      body: JSON.stringify({
        nome: form.nome.value,
        tags: form.tags.value,
        linkMercadoLivre: form.linkMercadoLivre.value,
        linkAmazon: form.linkAmazon.value,
        observacao: form.observacao.value,
      }),
    });
    $('#dialogo-produto').close();
    await carregar();
  } catch (e) {
    erro.textContent = e.message;
    erro.hidden = false;
  }
});

carregar().catch((e) => {
  document.body.prepend(
    el('p', 'erro', `Não consegui carregar o estado: ${e.message}`)
  );
});
