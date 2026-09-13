/**
 * Nomes de ícone (Iconify, conjunto Material Symbols) usados soltos pelo
 * site — fora do fluxo de categorias, que tem os próprios em
 * `src/dados/categorias.json`. Use com o componente `Icon` do astro-icon:
 *
 *   import { Icon } from 'astro-icon/components';
 *   <Icon name={ICONE_ESTRELA} class="icone-linha" aria-hidden="true" />
 *
 * A classe `icone-linha` (global.css) corrige o alinhamento com o texto
 * ao redor — sem ela o reset do Tailwind derruba o ícone pra própria linha.
 */

/** Selo de "novo"/"mais recente". */
export const ICONE_NOVO = 'material-symbols:auto-awesome-outline';

/** Destaque / "comece por aqui". */
export const ICONE_ESTRELA = 'material-symbols:star-outline';

/** Grade de categorias ("no que você quer mexer hoje"). */
export const ICONE_GRADE = 'material-symbols:grid-view-outline';

/** Mais vistos / em alta. */
export const ICONE_CHAMA = 'material-symbols:local-fire-department-outline';

/** Achados / garimpo. */
export const ICONE_LUPA = 'material-symbols:search';

/** Onde comprar. */
export const ICONE_CAIXA = 'material-symbols:inventory-2-outline';

/** "Português de gente" — fala direta. */
export const ICONE_BALAO = 'material-symbols:chat-bubble-outline';

/** "Barato de verdade" — preço. */
export const ICONE_ETIQUETA = 'material-symbols:sell-outline';

/** "Pensado pra quem aluga" — chave. */
export const ICONE_CHAVE = 'material-symbols:key-outline';

/** "Honesto sobre o limite" — segurança. */
export const ICONE_ESCUDO = 'material-symbols:shield-outline';

/** Aviso de segurança (rodapé). */
export const ICONE_ALERTA = 'material-symbols:warning-outline';
