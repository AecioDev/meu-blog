/**
 * Gerador de imagens de capa do Crescendo na Obra.
 *
 * Desenha uma ilustração vetorial simples (fundo em gradiente + formas
 * geométricas), rasteriza com o sharp e salva em JPEG. É o mesmo processo
 * que gerou as capas dos posts de exemplo, guardado aqui para que capas
 * novas saiam no mesmo estilo.
 *
 * Uso:
 *   node scripts/gerar-capa.js --tema torneira --saida src/content/posts/meu-post/capa.jpg
 *   node scripts/gerar-capa.js --listar
 *
 * Só desenha formas geométricas: não depende de nenhuma fonte instalada,
 * então o resultado é igual em qualquer máquina.
 */

import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Paleta do blog — espelha os tokens de `src/styles/global.css`.
 * Mudou a identidade visual lá? Atualize aqui também.
 */
const CORES = {
  creme: '#fff8ef',
  cremeForte: '#ffe6bd',
  tinta: '#2c2118',
  tintaSuave: '#5c4b3d',
  obra200: '#ffd58e',
  obra300: '#ffc25c',
  obra400: '#ffb02e',
  obra500: '#f79009',
  tijolo500: '#ef6541',
  tijolo600: '#d24a2a',
  menta400: '#43cd8b',
  menta500: '#22b573',
  ceu400: '#4cb8f5',
  ceu500: '#2196d8',
  uva400: '#a07bff',
  uva500: '#7c5cf0',
};

/**
 * Fundo comum a todas as capas: gradiente na diagonal e alguns círculos
 * claros, que dão profundidade sem competir com a ilustração.
 */
function moldura({ largura, altura, de, para, corpo }) {
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${largura}" height="${altura}" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${de}"/>
      <stop offset="100%" stop-color="${para}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="130" cy="110" r="180" fill="#ffffff" opacity="0.10"/>
  <circle cx="1080" cy="560" r="220" fill="#ffffff" opacity="0.09"/>
  <circle cx="1010" cy="90" r="60" fill="#ffffff" opacity="0.14"/>
  ${corpo}
</svg>`;
}

/**
 * Cada tema traz a categoria que atende, as duas cores do gradiente e o
 * desenho. Para criar um tema novo, copie um destes e troque o corpo —
 * o desenho é feito no espaço 1200x630, com origem no centro via transform.
 */
const TEMAS = {
  torneira: {
    descricao: 'Torneira pingando — Hidráulica',
    de: CORES.ceu500,
    para: CORES.ceu400,
    corpo: `
  <g transform="translate(600,315)">
    <rect x="-40" y="-150" width="80" height="120" rx="18" fill="${CORES.creme}"/>
    <rect x="-140" y="-40" width="230" height="60" rx="28" fill="${CORES.creme}"/>
    <rect x="30" y="10" width="60" height="90" rx="20" fill="${CORES.creme}"/>
    <rect x="-165" y="-70" width="50" height="120" rx="22" fill="${CORES.obra200}"/>
    <circle cx="-140" cy="-95" r="42" fill="${CORES.obra400}"/>
    <path d="M60 150 q22 44 0 66 q-22-22 0-66z" fill="${CORES.creme}" opacity="0.95"/>
    <path d="M60 250 q14 28 0 42 q-14-14 0-42z" fill="${CORES.creme}" opacity="0.6"/>
  </g>`,
  },

  rolo: {
    descricao: 'Rolo de pintura — Pintura',
    de: CORES.uva500,
    para: CORES.uva400,
    corpo: `
  <g transform="translate(600,315)">
    <rect x="-260" y="120" width="520" height="90" rx="30" fill="${CORES.obra400}" opacity="0.85"/>
    <rect x="-230" y="-170" width="330" height="110" rx="26" fill="${CORES.creme}"/>
    <rect x="-200" y="-140" width="270" height="50" rx="16" fill="${CORES.obra200}"/>
    <path d="M100 -115 h70 a26 26 0 0 1 26 26 v120 a26 26 0 0 1 -26 26 h-14" fill="none" stroke="${CORES.creme}" stroke-width="26" stroke-linecap="round"/>
    <rect x="130" y="60" width="48" height="150" rx="22" fill="${CORES.creme}"/>
  </g>`,
  },

  lampada: {
    descricao: 'Lâmpada acesa — Elétrica',
    de: CORES.obra500,
    para: CORES.obra300,
    corpo: `
  <g transform="translate(600,300)">
    <circle cx="0" cy="-30" r="130" fill="${CORES.creme}"/>
    <circle cx="0" cy="-30" r="96" fill="${CORES.cremeForte}"/>
    <path d="M-30 -30 q30 -60 60 0" fill="none" stroke="${CORES.obra500}" stroke-width="14" stroke-linecap="round"/>
    <rect x="-46" y="100" width="92" height="34" rx="14" fill="${CORES.tintaSuave}"/>
    <rect x="-46" y="146" width="92" height="30" rx="14" fill="${CORES.tintaSuave}"/>
    <rect x="-34" y="188" width="68" height="26" rx="12" fill="${CORES.tinta}"/>
    <g stroke="${CORES.creme}" stroke-width="16" stroke-linecap="round" opacity="0.85">
      <path d="M-215 -30 h-60"/><path d="M215 -30 h60"/>
      <path d="M-160 -180 l-44 -44"/><path d="M160 -180 l44 -44"/>
      <path d="M0 -215 v-60"/>
    </g>
  </g>`,
  },

  caixa: {
    descricao: 'Caixa de ferramentas — Dicas Gerais',
    de: CORES.menta500,
    para: CORES.menta400,
    corpo: `
  <g transform="translate(600,330)">
    <path d="M-90 -150 h180 a30 30 0 0 1 30 30 v30 h-60 v-20 h-120 v20 h-60 v-30 a30 30 0 0 1 30 -30z" fill="${CORES.creme}"/>
    <rect x="-280" y="-90" width="560" height="230" rx="34" fill="${CORES.tijolo500}"/>
    <rect x="-280" y="-30" width="560" height="36" fill="${CORES.tijolo600}" opacity="0.55"/>
    <rect x="-70" y="-120" width="140" height="70" rx="18" fill="${CORES.obra400}"/>
    <circle cx="-150" cy="60" r="30" fill="${CORES.creme}" opacity="0.9"/>
    <circle cx="150" cy="60" r="30" fill="${CORES.creme}" opacity="0.9"/>
  </g>`,
  },

  marca: {
    descricao: 'Prédios da marca — capa padrão de compartilhamento',
    de: CORES.obra500,
    para: CORES.tijolo500,
    corpo: `
  <g transform="translate(600,315)">
    <rect x="-330" y="-60" width="140" height="200" rx="18" fill="${CORES.creme}" opacity="0.95"/>
    <rect x="-170" y="-160" width="150" height="300" rx="18" fill="${CORES.creme}"/>
    <rect x="0" y="-260" width="160" height="400" rx="18" fill="${CORES.creme}" opacity="0.95"/>
    <rect x="180" y="-120" width="150" height="260" rx="18" fill="${CORES.obra200}"/>
    <rect x="-360" y="140" width="720" height="34" rx="17" fill="${CORES.tinta}" opacity="0.25"/>
  </g>`,
  },
};

// ---------------------------------------------------------------------------

const AJUDA = `
Gera uma imagem de capa no estilo do Crescendo na Obra.

  node scripts/gerar-capa.js --tema <nome> --saida <caminho.jpg>

  --tema <nome>      Ilustração a desenhar (use --listar para ver as opções)
  --saida <caminho>  Onde salvar o .jpg; a pasta é criada se não existir
  --largura <px>     Padrão 1200
  --altura <px>      Padrão 630
  --forcar           Sobrescreve se o arquivo já existir
  --listar           Mostra os temas disponíveis
  --ajuda            Mostra esta ajuda

Exemplo:
  node scripts/gerar-capa.js --tema torneira --saida src/content/posts/meu-post/capa.jpg
`;

function lerArgumentos(argv) {
  const args = { largura: 1200, altura: 630, forcar: false };
  const comValor = new Set(['--tema', '--saida', '--largura', '--altura']);

  for (let i = 0; i < argv.length; i += 1) {
    const atual = argv[i];

    if (comValor.has(atual)) {
      const valor = argv[i + 1];
      if (valor === undefined || valor.startsWith('--')) {
        throw new Error(`A opção ${atual} precisa de um valor.`);
      }
      i += 1;
      if (atual === '--tema') args.tema = valor;
      if (atual === '--saida') args.saida = valor;
      if (atual === '--largura') args.largura = Number(valor);
      if (atual === '--altura') args.altura = Number(valor);
      continue;
    }

    if (atual === '--forcar') args.forcar = true;
    else if (atual === '--listar') args.listar = true;
    else if (atual === '--ajuda' || atual === '-h' || atual === '--help') args.ajuda = true;
    else throw new Error(`Opção desconhecida: ${atual}`);
  }
  return args;
}

function listarTemas() {
  console.log('\nTemas disponíveis:\n');
  for (const [nome, tema] of Object.entries(TEMAS)) {
    console.log(`  ${nome.padEnd(10)} ${tema.descricao}`);
  }
  console.log('');
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

  if (args.listar) {
    listarTemas();
    return;
  }

  if (!args.tema || !args.saida) {
    console.error('\nFaltou --tema e/ou --saida.');
    console.error(AJUDA);
    process.exit(1);
  }

  const tema = TEMAS[args.tema];
  if (!tema) {
    console.error(`\nTema "${args.tema}" não existe.`);
    listarTemas();
    process.exit(1);
  }

  if (
    !Number.isFinite(args.largura) ||
    !Number.isFinite(args.altura) ||
    args.largura < 1 ||
    args.altura < 1
  ) {
    console.error('\n--largura e --altura precisam ser números maiores que zero.');
    process.exit(1);
  }

  if (fs.existsSync(args.saida) && !args.forcar) {
    console.error(`\nJá existe um arquivo em ${args.saida}.`);
    console.error('Use --forcar se quiser mesmo substituir.');
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(path.resolve(args.saida)), { recursive: true });

  const svg = moldura({
    largura: args.largura,
    altura: args.altura,
    de: tema.de,
    para: tema.para,
    corpo: tema.corpo,
  });

  await sharp(Buffer.from(svg)).jpeg({ quality: 86, mozjpeg: true }).toFile(args.saida);

  const kb = (fs.statSync(args.saida).size / 1024).toFixed(0);
  console.log(`\nCapa gerada: ${args.saida}`);
  console.log(`  tema:    ${args.tema} (${tema.descricao})`);
  console.log(`  tamanho: ${args.largura}x${args.altura}, ${kb} KB\n`);
}

principal().catch((erro) => {
  console.error('\nNão consegui gerar a capa:', erro.message);
  process.exit(1);
});
