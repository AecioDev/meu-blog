---
name: publicar-post-blog-crescendo-na-obra
description: Use esta skill sempre que precisar inserir um post PRONTO (título, texto, imagem já definidos pelo usuário ou por outro agente) na estrutura do blog "Crescendo na Obra". Isso inclui pedidos como "adiciona esse post no blog", "monta o arquivo desse artigo", "publica esse conteúdo na estrutura do site". Esta skill NÃO escreve o conteúdo do post nem gera imagens — ela recebe conteúdo já pronto e monta o arquivo corretamente dentro da collection do Astro, valida o schema e prepara para revisão/publicação.
---

# Publicar post na estrutura do blog "Crescendo na Obra"

## Escopo desta skill — importante

Esta skill cuida **só da parte estrutural**: pegar um post já escrito
(título, texto, categoria, imagem já definida) e transformar isso no arquivo
`.md` correto, no lugar certo, com o frontmatter válido.

**Esta skill NÃO deve:**
- Escrever ou reescrever o texto do post
- Decidir o ângulo/tom do conteúdo
- Gerar ou escolher imagem de capa
- Inventar informação que o usuário não forneceu

Se o usuário pedir pra "criar um post sobre X" sem ter fornecido o conteúdo
pronto, **não escreva o conteúdo você mesmo** — informe que essa skill monta
a estrutura, mas o texto/imagem precisam vir prontos (do próprio usuário ou
de outro agente/skill responsável por redação).

## Categorias válidas

Use **somente** uma destas categorias existentes. Se o assunto não se encaixar
em nenhuma, PARE e pergunte ao usuário antes de criar uma categoria nova —
categoria nova exige ajuste em outras partes do site (navegação, sidebar).

- Hidráulica
- Elétrica
- Pintura
- Dicas Gerais

## Informações que você precisa RECEBER antes de montar o post

Não prossiga sem ter isso em mãos (pergunte ao usuário o que faltar):

- Título
- Texto completo do post (corpo, já em Markdown ou texto corrido)
- Resumo/descrição curta (1-2 frases)
- Categoria (deve ser uma das 4 válidas — veja acima)
- Caminho ou arquivo da imagem de capa + texto alternativo dela
- Data de publicação — se o usuário não disser, use a data de hoje
- Se deve ser marcado como destaque (`featured: true`) — padrão é `false`

Sobre a imagem: se ela veio **anexada na conversa**, o anexo serve para você
ver a foto, mas não vira arquivo no projeto. Peça o caminho dela no computador
(ex: `C:UsersespirDownloadspia.jpg`) ou que o usuário a salve na pasta
do post.

Sobre anúncios: **não existe anúncio por post.** Os espaços são do layout — o
post já ganha um automaticamente depois do conteúdo. Se o usuário pedir um
anúncio específico só para aquele post, pare e avise: isso exige mexer no
schema e no layout, fora do escopo desta skill.

## Onde o post mora

Cada post é **uma pasta** dentro de `src/content/posts/`, com o texto e as
imagens juntos. O nome da pasta é o slug da URL:

```
src/content/posts/
└── como-desentupir-a-pia/     ← vira /posts/como-desentupir-a-pia/
    ├── index.md               ← o texto do post
    ├── capa.jpg               ← imagem de capa
    └── passo-1.jpg            ← demais imagens (opcional)
```

Os caminhos no `index.md` são **relativos à própria pasta**: `./capa.jpg` no
frontmatter, `![Descrição](./passo-1.jpg)` no meio do texto. O Astro otimiza
as duas no build.

## Schema do frontmatter (obrigatório em todo post)

```yaml
---
title: "Título do post"
description: "Resumo de 1-2 frases, usado em meta description e nos cards"
pubDate: 2026-08-22
category: "Hidráulica" # uma das 4 categorias válidas, exatamente como escrito acima
tags: ["opcional", "array de strings"]
coverImage: "./capa.jpg" # sempre relativo à pasta do post
coverImageAlt: "Descrição da imagem para acessibilidade"
author: "Equipe Crescendo na Obra"
featured: false # true só quando o usuário pedir explicitamente destaque
draft: false # true monta o post sem publicá-lo no site
---
```

⚠️ Caminho absoluto no `coverImage` (tipo `/imagens/capa.jpg`) **não dá erro de
build**: o post sobe e só depois a capa aparece quebrada no site e some do
compartilhamento. Use sempre `./`.

## Passo a passo

1. **Colete tudo que falta** da lista acima antes de criar qualquer arquivo.
   Se o texto do post, a imagem ou a categoria não vieram prontos, pare e
   peça — não preencha por conta própria.
2. **Valide a categoria** contra as 4 válidas. Se o valor recebido não bater
   exatamente com uma delas, pergunte antes de prosseguir.
3. **Gere o slug** do post a partir do título (minúsculo, sem acento, com
   hífen no lugar de espaço) e confira que não existe outra pasta com o mesmo
   slug em `src/content/posts/`.
4. **Crie a pasta** `src/content/posts/<slug>/` e monte o `index.md` dentro
   dela, com o frontmatter exatamente conforme o schema acima, seguido do
   texto recebido do usuário (sem alterar o conteúdo).
5. **Copie a imagem de capa** para dentro da mesma pasta, com o nome
   `capa.jpg`, e deixe o frontmatter apontando `./capa.jpg`.
6. **Rode `npm run build`.** É ele que valida o schema: campo obrigatório
   faltando derruba o build com exit 1, dizendo qual campo e qual arquivo.
   O `npm run dev` **não** acusa isso — o post simplesmente vira 404 e some
   do site, sem nenhuma mensagem. Passando no build, use `npm run dev` para
   conferir que o post aparece na home, na categoria certa e com a capa
   carregando.
7. **NÃO faça commit nem push automaticamente.** Mostre o resultado para o
   usuário revisar. Só publique (`git add`, `git commit`, `git push`) depois
   de confirmação explícita dele.

## Checklist antes de considerar pronto

- [ ] Todas as informações necessárias foram recebidas (nada inventado)
- [ ] Frontmatter completo, válido, categoria é uma das 4 permitidas
- [ ] Pasta criada com o slug certo, sem conflito com post existente
- [ ] Capa dentro da pasta do post, referenciada como `./capa.jpg`
- [ ] `npm run build` passou (é ele que valida o schema)
- [ ] `npm run dev` mostra o post certo na home e na categoria
- [ ] Usuário revisou e aprovou antes de qualquer commit/push

## O que nunca fazer

- Nunca escrever ou reescrever o conteúdo do post — isso é responsabilidade
  do usuário ou de outro agente de redação.
- Nunca inventar categoria, imagem ou informação que não foi fornecida.
- Nunca usar caminho absoluto no `coverImage` — o build passa e a capa quebra
  depois, sem aviso nenhum.
- Nunca considerar o post pronto tendo rodado só o `npm run dev`: erro de
  schema não aparece lá.
- Nunca publicar (commit/push) sem aprovação explícita do usuário.
