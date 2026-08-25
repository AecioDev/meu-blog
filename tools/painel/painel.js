/**
 * Frontend do painel. Sem framework de propósito: o servidor entrega o
 * estado já mastigado em /api/estado, e aqui a gente só desenha.
 */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

let estado = {
  etapas: [],
  categorias: [],
  cards: [],
  catalogo: {},
  pendenciasDeProduto: [],
  revisaoDeLinks: [],
  lojas: [],
  prazos: { conferir: 7, atrasado: 15 },
};

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
  desenharListaDePosts();
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
  const publicadosPendentes = estado.cards.filter(
    (c) => c.etapa === 'publicado' && c.pendencias.length
  ).length;

  const partes = [];
  if (pendentes) {
    partes.push(`${pendentes} produto${pendentes > 1 ? 's' : ''} aguardando cadastro ou link`);
  }
  if (publicadosPendentes) {
    partes.push(
      `${publicadosPendentes} post${publicadosPendentes > 1 ? 's' : ''} já no ar com pendência`
    );
  }
  const aConferir = estado.revisaoDeLinks.length;
  if (aConferir) {
    partes.push(`${aConferir} link${aConferir > 1 ? 's' : ''} pra conferir`);
  }
  $('#resumo-pendencias').textContent = partes.length
    ? partes.join(' · ')
    : 'Nenhuma pendência aberta.';
}

function montarCard(card) {
  const botao = el('button', 'card');
  botao.type = 'button';
  // publicar não exige link de afiliado; o card só fica marcado pra lembrar
  if (card.pendencias.length) botao.classList.add('pendente');
  botao.append(el('span', 'titulo', card.titulo));

  const meta = el('div', 'meta');
  if (card.categoria) {
    meta.append(el('span', `chip categoria ${slugificar(card.categoria)}`, card.categoria));
  }
  if (card.origem === 'pauta') {
    meta.append(el('span', 'chip pauta', 'só pauta'));
  }
  // post que já está no ar mas caiu numa coluna de pendência
  if (card.noAr && card.etapa !== 'publicado') {
    meta.append(el('span', 'chip', 'no ar'));
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
    linha.append(
      el('span', 'chip', p.origem === 'material' ? 'da lista de materiais' : 'sugerido')
    );

    if (p.situacao === 'ignorado') {
      linha.append(el('span', 'vazia', 'marcado como "não vale link"'));
    } else if (p.situacao === 'resolvido') {
      for (const loja of estado.lojas) {
        const href = p.produto[loja.campo];
        if (!href) continue;
        const a = el('a', 'link-ok', loja.nome);
        a.href = href;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        linha.append(a);
      }
      if (p.faltando && p.faltando.length) {
        linha.append(el('span', 'vazia', `(sem ${p.faltando.join(' e ')})`));
      }
    } else if (p.situacao === 'sem-link') {
      linha.append(el('span', 'link-falta', 'cadastrado, mas sem link nenhum'));
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

      // o mesmo item costuma estar cadastrado com outro nome:
      // vincular grava um apelido e resolve em todos os posts de uma vez
      if (Object.keys(estado.catalogo).length) {
        const vincular = el('button', 'botao-secundario', 'É um já cadastrado');
        vincular.type = 'button';
        vincular.title = 'Aponta para um produto do catálogo e guarda este nome como apelido';
        vincular.addEventListener('click', () => abrirVinculo(p.nome));
        linha.append(vincular);
      }
    }
    alvo.append(linha);
  }

  // --- escolher o que vai para o bloco "Onde comprar" ---
  if (card.origem === 'publicado') {
    // dois nomes citados podem apontar para o mesmo item do catálogo:
    // aqui ele aparece uma vez só
    const prontos = [];
    for (const p of card.produtos) {
      if (p.situacao !== 'resolvido') continue;
      if (prontos.some((x) => x.chave === p.chave)) continue;
      prontos.push(p);
    }

    alvo.append(el('h3', null, 'Bloco "Onde comprar" do post'));

    if (!prontos.length) {
      alvo.append(
        el('p', 'vazia', 'Nenhum produto com link ainda — cadastre o link no catálogo primeiro.')
      );
    } else {
      const jaNoPost = card.jaVinculados || [];
      alvo.append(
        el('p', 'ajuda', 'Marque o que deve aparecer no post. O que estiver marcado vira o bloco.')
      );

      const caixas = [];
      for (const p of prontos) {
        const rotulo = el('label', 'linha escolha');
        const caixa = el('input');
        caixa.type = 'checkbox';
        caixa.value = p.chave;
        caixa.checked = jaNoPost.includes(p.chave);
        caixas.push(caixa);

        rotulo.append(caixa);
        rotulo.append(el('span', null, p.nome));
        if (jaNoPost.includes(p.chave)) {
          rotulo.append(el('span', 'chip', 'no post'));
        }
        alvo.append(rotulo);
      }

      const gravar = el('button', 'botao-primario', '');
      gravar.type = 'button';
      gravar.style.marginTop = '12px';

      // o texto do botão acompanha a seleção e avisa quando nada mudou
      const atualizarBotao = () => {
        const marcados = caixas.filter((c) => c.checked).map((c) => c.value);
        const igual =
          marcados.length === jaNoPost.length &&
          marcados.every((c) => jaNoPost.includes(c));
        gravar.textContent = igual
          ? 'O post já está assim'
          : `Gravar ${marcados.length} produto${marcados.length === 1 ? '' : 's'} no post`;
        gravar.disabled = igual;
      };
      caixas.forEach((c) => c.addEventListener('change', atualizarBotao));
      atualizarBotao();

      gravar.addEventListener('click', async () => {
        const marcados = caixas.filter((c) => c.checked).map((c) => c.value);
        const r = await api(`/api/posts/${encodeURIComponent(card.slug)}/materiais`, {
          method: 'POST',
          body: JSON.stringify({ materiais: marcados }),
        });
        $('#dialogo-card').close();
        await carregar();
        alert(
          `${r.gravados} produto(s) no post.\nRode "npm run build" para ver o bloco na página.`
        );
      });
      alvo.append(gravar);
    }
  }

  // --- texto ---
  if (card.corpo && card.corpo.trim()) {
    alvo.append(el('h3', null, 'Texto'));
    alvo.append(el('div', 'corpo', card.corpo.trim()));
  }

  // --- ações da pauta ---
  if (card.origem === 'pauta') {
    const editar = el('button', 'botao-secundario', 'Editar pauta');
    editar.type = 'button';
    editar.style.marginTop = '16px';
    editar.style.marginRight = '8px';
    editar.addEventListener('click', () => {
      $('#dialogo-card').close();
      abrirFormularioPauta(card);
    });
    alvo.append(editar);

    const iniciar = el('button', 'botao-primario', 'Iniciar rascunho');
    iniciar.type = 'button';
    iniciar.title = 'Cria drafts/<slug>/post.md com o cabeçalho já preenchido';
    iniciar.style.marginTop = '16px';
    iniciar.addEventListener('click', async () => {
      const r = await api(`/api/pautas/${encodeURIComponent(card.idPauta)}/rascunho`, {
        method: 'POST',
      });
      $('#dialogo-card').close();
      await carregar();
      alert(
        r.ja
          ? `Já existia um rascunho em ${r.caminho}`
          : `Rascunho criado em ${r.caminho}`
      );
    });
    alvo.append(iniciar);

    const b = el('button', 'botao-secundario', 'Descartar esta pauta');
    b.type = 'button';
    b.style.marginTop = '16px';
    b.style.marginLeft = '8px';
    b.addEventListener('click', async () => {
      if (!confirm('Descartar esta pauta? O rascunho, se existir, não é apagado.')) return;
      await api(`/api/pautas/${encodeURIComponent(card.idPauta)}`, { method: 'DELETE' });
      $('#dialogo-card').close();
      carregar();
    });
    alvo.append(b);
  }

  $('#dialogo-card').showModal();
}

// ---------------------------------------------------------------------------
// lista de posts

/**
 * Mesma informação do quadro, em outro formato: aqui cada post é uma linha
 * com o passo em que está e a trilha do fluxo. Serve para ver muitos posts
 * de uma vez, que é onde o kanban começa a ficar apertado.
 */
function desenharListaDePosts() {
  const alvo = $('#lista-posts');
  alvo.textContent = '';

  const busca = $('#busca-post').value.trim().toLowerCase();
  const soPendentes = $('#so-pendentes').checked;

  const ordem = estado.etapas.map((e) => e.id);

  const posts = estado.cards
    .filter((c) => {
      if (soPendentes && !c.pendencias.length) return false;
      if (!busca) return true;
      return (
        c.titulo.toLowerCase().includes(busca) ||
        (c.categoria || '').toLowerCase().includes(busca)
      );
    })
    // o servidor já entrega do mais recente para o mais antigo
    ;

  $('#resumo-posts').textContent = `${posts.length} de ${estado.cards.length} post${
    estado.cards.length === 1 ? '' : 's'
  }`;

  if (!posts.length) {
    alvo.append(el('p', 'vazia', 'Nenhum post com esse filtro.'));
    return;
  }

  for (const card of posts) {
    const indice = ordem.indexOf(card.etapa);
    const etapa = estado.etapas[indice];

    const cartao = el('button', 'post-cartao');
    cartao.type = 'button';
    if (card.pendencias.length) cartao.classList.add('pendente');

    cartao.append(el('span', 'titulo', card.titulo));

    const meta = el('div', 'linha-meta');
    if (card.categoria) {
      meta.append(el('span', `chip categoria ${slugificar(card.categoria)}`, card.categoria));
    }
    meta.append(
      el('span', 'etapa-atual', `${indice + 1}/${estado.etapas.length} · ${etapa.titulo}`)
    );
    if (card.data) {
      const [ano, mes, dia] = card.data.split('-');
      meta.append(el('span', 'vazia', `${dia}/${mes}/${ano}`));
    }
    cartao.append(meta);

    // trilha: etapas já vencidas, a atual, e as que faltam
    const trilha = el('div', 'trilha');
    trilha.setAttribute('aria-hidden', 'true');
    estado.etapas.forEach((_, i) => {
      const traco = el('span');
      if (i < indice) traco.classList.add('feita');
      if (i === indice) traco.classList.add('atual');
      trilha.append(traco);
    });
    cartao.append(trilha);

    if (card.pendencias.length) {
      const pend = el('div', 'linha-meta');
      for (const p of card.pendencias) {
        pend.append(el('span', 'chip alerta', p.texto));
      }
      cartao.append(pend);
    }

    cartao.addEventListener('click', () => abrirDetalhe(card));
    alvo.append(cartao);
  }
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
    for (const loja of estado.lojas) {
      const href = p[loja.campo];
      if (href) {
        const a = el('a', 'link-ok', `${loja.nome}: cadastrado`);
        a.href = href;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        links.append(a);
      } else {
        // sem link não é erro: o produto pode simplesmente não existir na loja
        links.append(el('span', 'vazia', `${loja.nome}: —`));
      }
    }
    cartao.append(links);

    if (p.apelidos && p.apelidos.length) {
      cartao.append(el('p', 'vazia', 'também citado como: ' + p.apelidos.join(', ')));
    }
    if (p.destaque) cartao.append(el('span', 'chip', '★ em destaque no blog'));
    if (p.ignorar) cartao.append(el('p', 'vazia', 'marcado como "não vale link"'));
    if (p.observacao) cartao.append(el('p', 'vazia', p.observacao));

    if (p.atualizadoEm) {
      const dias = Math.floor(
        (Date.now() - new Date(p.atualizadoEm).getTime()) / 86400000
      );
      const texto =
        dias <= 0 ? 'links conferidos hoje' : `links conferidos há ${dias} dia${dias > 1 ? 's' : ''}`;
      const linha = el('p', 'vazia', texto);
      if (dias >= estado.prazos.conferir) linha.classList.add('link-falta');
      cartao.append(linha);
    }

    const menu = el('menu');
    const editar = el('button', 'botao-secundario', 'Editar');
    editar.type = 'button';
    editar.addEventListener('click', () => abrirFormularioProduto(p, chave));
    menu.append(editar);

    const temAlgumLink = estado.lojas.some((loja) => p[loja.campo]);
    if (temAlgumLink) {
      const conferir = el('button', 'botao-secundario', 'Conferi hoje');
      conferir.type = 'button';
      conferir.title = 'Carimba a data sem precisar editar nada';
      conferir.addEventListener('click', async () => {
        await api(`/api/produtos/${encodeURIComponent(chave)}/conferir`, { method: 'POST' });
        carregar();
      });
      menu.append(conferir);
    }

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

function desenharRevisaoDeLinks() {
  if (!estado.revisaoDeLinks.length) return null;

  const caixa = el('div', 'aviso');
  caixa.append(
    el(
      'h2',
      null,
      `Links pra conferir (revisão a cada ${estado.prazos.conferir} dias)`
    )
  );

  const ul = el('ul');
  for (const item of estado.revisaoDeLinks) {
    const li = el('li');
    const quanto = `há ${item.dias} dia${item.dias > 1 ? 's' : ''}`;
    li.append(
      document.createTextNode(
        `${item.nome} — conferido ${quanto}${item.atrasado ? ' (atrasado)' : ''}`
      )
    );
    if (item.atrasado) li.classList.add('link-falta');

    const b = el('button', null, 'conferi hoje');
    b.type = 'button';
    b.addEventListener('click', async () => {
      await api(`/api/produtos/${encodeURIComponent(item.chave)}/conferir`, { method: 'POST' });
      carregar();
    });
    li.append(b);
    ul.append(li);
  }
  caixa.append(ul);
  return caixa;
}

function desenharPendenciasCatalogo() {
  const alvo = $('#pendencias-catalogo');
  alvo.textContent = '';

  const revisao = desenharRevisaoDeLinks();
  if (revisao) alvo.append(revisao);

  if (!estado.pendenciasDeProduto.length) return;

  const caixa = el('div', 'aviso');
  caixa.append(el('h2', null, 'Produtos citados nos posts que ainda travam a monetização'));

  const ul = el('ul');
  for (const p of estado.pendenciasDeProduto) {
    const li = el('li');
    const situacao =
      p.situacao === 'nao-cadastrado'
        ? 'não está no catálogo'
        : 'cadastrado, mas sem link nenhum';
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

/**
 * Pergunta a qual produto do catálogo o nome citado corresponde, e grava
 * esse nome como apelido. A partir daí qualquer post que cite assim resolve
 * sozinho.
 */
function abrirVinculo(nomeCitado) {
  const opcoes = Object.entries(estado.catalogo).sort((a, b) =>
    a[1].nome.localeCompare(b[1].nome, 'pt-BR')
  );

  const alvo = $('#detalhe-card');
  alvo.textContent = '';
  alvo.append(el('h2', null, 'Vincular a um produto existente'));
  alvo.append(
    el('p', 'ajuda', `"${nomeCitado}" vira apelido do produto que você escolher.`)
  );

  const select = el('select');
  select.style.cssText = 'width:100%;font:inherit;padding:9px 12px;border-radius:10px;border:2px solid var(--borda);background:var(--creme);margin:12px 0';
  for (const [chave, produto] of opcoes) {
    const lojas = estado.lojas.filter((l) => produto[l.campo]).map((l) => l.nome);
    select.append(
      new Option(
        `${produto.nome}${lojas.length ? ' — ' + lojas.join(', ') : ' — sem link'}`,
        chave
      )
    );
  }
  alvo.append(select);

  const confirmar = el('button', 'botao-primario', 'Vincular');
  confirmar.type = 'button';
  confirmar.addEventListener('click', async () => {
    await api(`/api/produtos/${encodeURIComponent(select.value)}/apelido`, {
      method: 'POST',
      body: JSON.stringify({ apelido: nomeCitado }),
    });
    $('#dialogo-card').close();
    carregar();
  });
  alvo.append(confirmar);
}

function abrirFormularioProduto(produto = {}, chave = null) {
  const form = $('#form-produto');
  form.reset();
  form.nome.value = produto.nome || '';
  form.tags.value = produto.tags || '';
  form.linkAmazon.value = produto.linkAmazon || '';
  form.linkMercadoLivre.value = produto.linkMercadoLivre || '';
  form.linkShopee.value = produto.linkShopee || '';
  form.observacao.value = produto.observacao || '';
  form.ignorar.checked = Boolean(produto.ignorar);
  form.destaque.checked = Boolean(produto.destaque);
  form.chamada.value = produto.chamada || '';
  form.dataset.chave = chave || '';
  // os valores mudaram sem evento de digitação: reavalia os atalhos
  $$('.abrir-link').forEach((b) => {
    const campo = $(`#form-produto [name="${b.dataset.abrir}"]`);
    b.disabled = !campo || !/^https?:\/\/\S+/i.test(campo.value.trim());
  });
  form.querySelector('[data-erro]').hidden = true;
  trocarTela('produtos');
  $('#dialogo-produto').showModal();
}

// ---------------------------------------------------------------------------
// telas e eventos

function trocarTela(nome) {
  $$('.menu button').forEach((b) => b.classList.toggle('ativo', b.dataset.tela === nome));
  $('#tela-quadro').hidden = nome !== 'quadro';
  $('#tela-posts').hidden = nome !== 'posts';
  $('#tela-produtos').hidden = nome !== 'produtos';
  // guarda a preferência: quem gosta da lista não quer voltar pro quadro
  // toda vez que recarrega
  try {
    localStorage.setItem('painel-tela', nome);
  } catch {}
}

$$('.menu button').forEach((b) =>
  b.addEventListener('click', () => trocarTela(b.dataset.tela))
);

$('#recarregar').addEventListener('click', carregar);
$('#busca-produto').addEventListener('input', desenharProdutos);
$('#busca-post').addEventListener('input', desenharListaDePosts);
$('#so-pendentes').addEventListener('change', desenharListaDePosts);

/**
 * Abre o formulário de pauta. Com `pauta`, edita a existente; sem, cria uma
 * nova. Editar é o caminho para corrigir o tema depois de anotado, sem
 * precisar descartar e refazer.
 */
function abrirFormularioPauta(pauta) {
  const form = $('#form-pauta');
  form.reset();
  form.querySelector('[data-erro]').hidden = true;
  form.dataset.editando = pauta ? pauta.idPauta : '';

  if (pauta) {
    form.titulo.value = pauta.titulo || '';
    form.categoria.value = pauta.categoria || '';
    form.observacao.value = pauta.descricao || '';
    form.criarRascunho.parentElement.hidden = true;
  } else {
    form.criarRascunho.parentElement.hidden = false;
  }
  $('#dialogo-pauta').querySelector('h2').textContent = pauta
    ? 'Editar pauta'
    : 'Nova pauta';
  $('#dialogo-pauta').showModal();
}

$('#abrir-nova-pauta').addEventListener('click', () => {
  const form = $('#form-pauta');
  form.reset();
  form.querySelector('[data-erro]').hidden = true;
  $('#dialogo-pauta').showModal();
});

$('#abrir-novo-produto').addEventListener('click', () => abrirFormularioProduto());

/**
 * Atalho para conferir o link sem sair do formulário — útil na revisão
 * semanal: abre, vê se ainda está no ar, e volta para marcar.
 *
 * Segue o que está digitado, não o que foi salvo, e só habilita para
 * endereço http(s): assim não abre nada estranho colado por engano.
 */
function ligarBotoesDeAbrirLink() {
  for (const botao of $$('.abrir-link')) {
    const campo = $(`#form-produto [name="${botao.dataset.abrir}"]`);
    if (!campo) continue;

    const atualizar = () => {
      botao.disabled = !/^https?:\/\/\S+/i.test(campo.value.trim());
    };
    campo.addEventListener('input', atualizar);
    botao.addEventListener('click', () => {
      const url = campo.value.trim();
      if (/^https?:\/\/\S+/i.test(url)) window.open(url, '_blank', 'noopener');
    });
    atualizar();
  }
}
ligarBotoesDeAbrirLink();

$$('[data-fechar]').forEach((b) =>
  b.addEventListener('click', () => b.closest('dialog').close())
);

$('#form-pauta').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const form = evento.target;
  const erro = form.querySelector('[data-erro]');
  try {
    const editando = form.dataset.editando;
    const corpo = {
      titulo: form.titulo.value,
      categoria: form.categoria.value,
      observacao: form.observacao.value,
    };

    if (editando) {
      const r = await api(`/api/pautas/${encodeURIComponent(editando)}`, {
        method: 'PUT',
        body: JSON.stringify(corpo),
      });
      if (r.slugMantido) {
        alert(
          'Título alterado. A pasta do rascunho continua com o nome antigo, ' +
            'porque renomear quebraria o que já foi escrito.'
        );
      }
    } else {
      await api('/api/pautas', {
        method: 'POST',
        body: JSON.stringify({ ...corpo, criarRascunho: form.criarRascunho.checked }),
      });
    }
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
        linkAmazon: form.linkAmazon.value,
        linkMercadoLivre: form.linkMercadoLivre.value,
        linkShopee: form.linkShopee.value,
        observacao: form.observacao.value,
        ignorar: form.ignorar.checked,
        destaque: form.destaque.checked,
        chamada: form.chamada.value,
      }),
    });
    $('#dialogo-produto').close();
    await carregar();
  } catch (e) {
    erro.textContent = e.message;
    erro.hidden = false;
  }
});

try {
  const salva = localStorage.getItem('painel-tela');
  if (salva) trocarTela(salva);
} catch {}

carregar().catch((e) => {
  document.body.prepend(
    el('p', 'erro', `Não consegui carregar o estado: ${e.message}`)
  );
});
