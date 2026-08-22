# Crescendo na Obra

Blog sobre cuidar da própria casa, feito pra quem acabou de sair da casa dos pais
e descobriu que agora o cano que vaza é problema seu. Tutoriais simples, dicas de
economia e notícias de manutenção residencial — em português de gente.

Construído com **Astro + TypeScript + Tailwind CSS**, gerando site estático
(sem servidor), pronto pra Vercel.

---

## Rodando na sua máquina

Você precisa do [Node.js](https://nodejs.org) 20 ou superior.

```bash
npm install
```

```bash
npm run dev
```

O site sobe em **http://localhost:4321**. Salvou um arquivo, a página atualiza
sozinha.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm install` | Instala as dependências |
| `npm run dev` | Sobe o servidor local em `localhost:4321` |
| `npm run build` | Gera o site final na pasta `dist/` |
| `npm run preview` | Serve a pasta `dist/` pra você conferir o build |
| `npm run check` | Verifica erros de TypeScript e dos arquivos `.astro` |

> **Sobre o `npm run check`:** ele exige TypeScript 6.x. O projeto já vem com a
> versão certa fixada — o TypeScript 7 (compilador nativo) ainda não expõe a API
> que o `astro check` usa.

## Gerando o build

```bash
npm run build
```

Tudo sai em `dist/`: HTML estático, imagens otimizadas em WebP, `sitemap-index.xml`
e `rss.xml`. É só isso que vai pro ar.

---

## Como escrever um post

Crie um arquivo `.md` em `src/content/posts/`. **O nome do arquivo vira a URL** —
`minha-dica-legal.md` fica acessível em `/posts/minha-dica-legal/`.

```markdown
---
title: 'Como desentupir a pia sem produto químico'
description: 'Resumo curto que aparece no card e no Google. Uma ou duas frases.'
pubDate: 2026-09-01
updatedDate: 2026-09-10        # opcional
category: 'Hidráulica'
tags: ['pia', 'entupimento']   # opcional
coverImage: '../../assets/posts/minha-capa.jpg'
coverImageAlt: 'Descrição da imagem para quem não enxerga'
author: 'Equipe Crescendo na Obra'   # opcional, já tem padrão
featured: false                       # true = aparece em destaque na home
draft: false                          # true = some do site sem apagar o arquivo
---

Seu texto aqui, em Markdown normal.
```

### Sobre os campos

| Campo | Obrigatório | Detalhe |
| --- | --- | --- |
| `title` | sim | Vira o `<h1>` e o `<title>` da página |
| `description` | sim | Usado na meta description e nos cards |
| `pubDate` | sim | Formato `AAAA-MM-DD` |
| `updatedDate` | não | Mostra "Atualizado em..." no post |
| `category` | sim | Cria a página `/categoria/...` automaticamente |
| `tags` | não | Lista de strings |
| `coverImage` | sim | Caminho relativo ao `.md`, dentro de `src/assets/` |
| `coverImageAlt` | sim | Acessibilidade — descreva a imagem de verdade |
| `author` | não | Padrão: "Equipe Crescendo na Obra" |
| `featured` | não | Padrão `false` |
| `draft` | não | Padrão `false` |

### Sobre as imagens de capa

Guarde as capas em `src/assets/posts/` (e **não** em `public/`). Assim o Astro
otimiza tudo no build: converte pra WebP, redimensiona e gera as versões
responsivas sozinho. O ideal é enviar em **1200×630**.

Se você errar o caminho ou esquecer um campo obrigatório, o build falha com uma
mensagem dizendo exatamente qual post e qual campo — de propósito, pra nada
quebrado ir pro ar.

### Categoria nova

Basta usar um nome novo em `category`. A página de listagem, a contagem na
lateral e o link no menu de categorias aparecem sozinhos.

Pra dar cor e emoji próprios à categoria, adicione uma entrada em
`ESTILOS_CATEGORIA` no arquivo `src/consts.ts`. Sem isso ela funciona igual, só
usa o visual padrão. Se quiser a categoria no menu do topo, inclua em
`MENU_PRINCIPAL`, no mesmo arquivo.

---

## Organização das pastas

```
src/
├── assets/posts/       Imagens de capa (otimizadas no build)
├── components/         Peças reutilizáveis da interface
├── content/posts/      Os posts em Markdown
├── layouts/            Estrutura das páginas
├── pages/              Cada arquivo aqui vira uma rota
│   ├── index.astro                 /
│   ├── sobre.astro                 /sobre
│   ├── contato.astro               /contato
│   ├── 404.astro                   página de erro
│   ├── rss.xml.ts                  /rss.xml
│   ├── posts/[...slug].astro       /posts/nome-do-post
│   └── categoria/[slug].astro      /categoria/hidraulica
├── styles/global.css   Cores, fontes e estilos base
├── utils/posts.ts      Funções que buscam e organizam os posts
├── consts.ts           Nome do site, menu, cores das categorias
└── content.config.ts   Regras do frontmatter dos posts

public/                 Arquivos servidos como estão (favicon, robots.txt)
```

## Onde mexer pra personalizar

| Quero mudar | Arquivo |
| --- | --- |
| Nome, descrição, menu, redes | `src/consts.ts` |
| Cores e fontes | `src/styles/global.css` (bloco `@theme`) |
| Domínio do site | `astro.config.mjs` (campo `site`) e `public/robots.txt` |
| Texto da página Sobre | `src/pages/sobre.astro` |
| Campos do post | `src/content.config.ts` |

---

## O que ainda está mockado

Três partes têm a interface pronta, mas ainda não se conectam a nada. Cada
arquivo tem um comentário no topo explicando exatamente como ligar:

- **`src/components/MostViewed.astro`** — "Mais vistos" usa uma lista fixa de
  slugs. Depois, troque pela API do Plausible ou GA4.
- **`src/components/NewsletterBox.astro`** — captura de e-mail. Falta apontar o
  `action` do formulário pro Mailchimp, Buttondown ou ConvertKit.
- **`src/pages/contato.astro`** — formulário de contato. Falta apontar pro
  Formspree, Web3Forms ou uma função da Vercel.
- **`src/components/AdSlot.astro`** — espaço de anúncio. Falta o script do
  Google AdSense.

## SEO que já vem funcionando

- Title, description e canonical por página
- Open Graph e Twitter Card usando a capa do post
- `sitemap.xml` e `rss.xml` gerados no build
- `robots.txt`
- Dados estruturados JSON-LD (`BlogPosting` e `BreadcrumbList`)
- Favicon, ícones e `site.webmanifest`

**Antes de publicar:** troque o domínio no campo `site` do `astro.config.mjs` e
no `public/robots.txt`. Sem isso, o sitemap e as tags de compartilhamento vão
apontar pro endereço de exemplo.

---

## Publicando na Vercel

O projeto é estático — não precisa de adapter nem configuração extra.

1. Suba o repositório pro GitHub
2. Na Vercel, importe o repositório
3. A Vercel detecta o Astro sozinha (build: `npm run build`, saída: `dist`)
4. Deploy

### Sobre a barra no fim da URL

As URLs do site terminam com barra (`/sobre/`, `/categoria/pintura/`). Isso está
fixado em dois lugares que precisam continuar combinando:

- `vercel.json` → `"trailingSlash": true`
- `astro.config.mjs` → `trailingSlash: 'always'`

Se os dois divergirem, cada tag canonical passa a apontar pra uma URL que
redireciona — o site funciona, mas o sinal que chega no Google fica sujo. Por
isso o servidor local também exige a barra: link interno escrito errado vira 404
no `npm run dev`, antes de ir pro ar.

### Domínio próprio

Ao trocar pro domínio final, ajuste o campo `site` no `astro.config.mjs` e o
`Sitemap:` no `public/robots.txt` — sempre com `https://` na frente.

Escolha também se o domínio principal é com ou sem `www` e use exatamente a
mesma forma no `site`. Se a Vercel redireciona pra `www` mas o `site` diz o
contrário, as canonicals brigam com o redirecionamento.

Vale apontar o DNS e confirmar o domínio ativo na Vercel **antes** de trocar o
`site`: publicar canonicals pra um domínio que ainda não resolve dá trabalho
pra desfazer no Search Console.

## Acessibilidade

O projeto foi validado com contraste mínimo AA (WCAG) em todas as páginas,
hierarquia de headings correta, `alt` em todas as imagens, foco visível pelo
teclado e link "pular para o conteúdo". Ao criar posts novos, o principal
cuidado é **escrever um `coverImageAlt` que descreva a imagem de verdade** e não
pular níveis de heading no Markdown (depois do `#` do título, use `##`).
