/**
 * Prepara uma imagem para entrar no repositório.
 *
 * Usado na publicação, ao mover imagem de `drafts/` para a pasta do post:
 * o original em alta fica no rascunho (que não é versionado) e o que entra
 * no Git vai em tamanho de web. O Astro ainda converte para WebP no build —
 * isto aqui é só para o histórico do Git não carregar arquivo gigante.
 *
 * Uso:
 *   node scripts/otimizar-imagem.js --entrada drafts/meu-post/capa.jpg \
 *     --saida src/content/posts/meu-post/capa.jpg --tipo capa
 *
 * Opções:
 *   --entrada <caminho>  Arquivo de origem (obrigatório).
 *   --saida <caminho>    Onde gravar; a pasta é criada se faltar (obrigatório).
 *   --tipo capa          1200x630 exatos, cortando o excesso (formato de
 *                        compartilhamento). É o padrão.
 *   --tipo conteudo      Largura máxima de 1200, mantendo a proporção. Use
 *                        nas imagens do meio do post.
 *   --forcar             Sobrescreve a saída se já existir.
 *   --ajuda              Mostra esta ajuda.
 *
 * Imagem menor que o alvo não é ampliada — só passa pela recompressão.
 */

import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const LARGURA_CAPA = 1200;
const ALTURA_CAPA = 630;
const LARGURA_MAX_CONTEUDO = 1200;
const QUALIDADE = 86;

const AJUDA = `
Prepara uma imagem para entrar no repositório (redimensiona e recomprime).

  node scripts/otimizar-imagem.js --entrada <origem> --saida <destino> [--tipo capa|conteudo]

  --entrada <caminho>  Arquivo de origem
  --saida <caminho>    Onde gravar (a pasta é criada se faltar)
  --tipo capa          ${LARGURA_CAPA}x${ALTURA_CAPA} exatos, cortando o excesso (padrão)
  --tipo conteudo      largura máxima ${LARGURA_MAX_CONTEUDO}, mantendo a proporção
  --forcar             Sobrescreve a saída se já existir
  --ajuda              Mostra esta ajuda

Exemplo:
  node scripts/otimizar-imagem.js \\
    --entrada drafts/meu-post/capa.jpg \\
    --saida src/content/posts/meu-post/capa.jpg --tipo capa
`;

function lerArgumentos(argv) {
  const args = { tipo: 'capa', forcar: false };
  const comValor = new Set(['--entrada', '--saida', '--tipo']);

  for (let i = 0; i < argv.length; i += 1) {
    const atual = argv[i];
    if (comValor.has(atual)) {
      const valor = argv[i + 1];
      if (valor === undefined || valor.startsWith('--')) {
        throw new Error(`A opção ${atual} precisa de um valor.`);
      }
      i += 1;
      if (atual === '--entrada') args.entrada = valor;
      if (atual === '--saida') args.saida = valor;
      if (atual === '--tipo') args.tipo = valor;
      continue;
    }
    if (atual === '--forcar') args.forcar = true;
    else if (atual === '--ajuda' || atual === '-h' || atual === '--help') args.ajuda = true;
    else throw new Error(`Opção desconhecida: ${atual}`);
  }
  return args;
}

async function principal() {
  let args;
  try {
    args = lerArgumentos(process.argv.slice(2));
  } catch (erro) {
    console.error(`\n${erro.message}`);
    console.error(AJUDA);
    process.exit(1);
  }

  if (args.ajuda) {
    console.log(AJUDA);
    return;
  }

  if (!args.entrada || !args.saida) {
    console.error('\nFaltou --entrada e/ou --saida.');
    console.error(AJUDA);
    process.exit(1);
  }

  if (args.tipo !== 'capa' && args.tipo !== 'conteudo') {
    console.error(`\n--tipo aceita "capa" ou "conteudo"; recebi "${args.tipo}".`);
    process.exit(1);
  }

  if (!fs.existsSync(args.entrada)) {
    console.error(`\nNão achei o arquivo de entrada: ${args.entrada}`);
    process.exit(1);
  }

  if (fs.existsSync(args.saida) && !args.forcar) {
    console.error(`\nJá existe um arquivo em ${args.saida}.`);
    console.error('Use --forcar se quiser mesmo substituir.');
    process.exit(1);
  }

  // Ler antes de gravar evita corromper o arquivo quando entrada e saída
  // são o mesmo caminho.
  const original = fs.readFileSync(args.entrada);
  const antes = await sharp(original).metadata();

  const imagem = sharp(original, { animated: true });
  if (args.tipo === 'capa') {
    imagem.resize(LARGURA_CAPA, ALTURA_CAPA, {
      fit: 'cover',
      withoutEnlargement: true,
    });
  } else {
    imagem.resize(LARGURA_MAX_CONTEUDO, null, { withoutEnlargement: true });
  }

  // Preserva GIF animado; o resto vira JPEG.
  const ehGif = antes.format === 'gif';
  const processada = ehGif
    ? await imagem.gif().toBuffer()
    : await imagem.jpeg({ quality: QUALIDADE, mozjpeg: true }).toBuffer();

  fs.mkdirSync(path.dirname(path.resolve(args.saida)), { recursive: true });
  fs.writeFileSync(args.saida, processada);

  const depois = await sharp(args.saida).metadata();
  const kbAntes = original.length / 1024;
  const kbDepois = processada.length / 1024;
  const reducao = kbAntes > 0 ? 100 - (kbDepois / kbAntes) * 100 : 0;

  console.log(`\nImagem preparada: ${args.saida}`);
  console.log(`  antes:  ${antes.width}x${antes.height}, ${kbAntes.toFixed(0)} KB`);
  console.log(`  depois: ${depois.width}x${depois.height}, ${kbDepois.toFixed(0)} KB`);
  if (reducao > 0) console.log(`  reducao: ${reducao.toFixed(1)}%\n`);
  else console.log('');
}

principal().catch((erro) => {
  console.error('\nNão consegui preparar a imagem:', erro.message);
  process.exit(1);
});
