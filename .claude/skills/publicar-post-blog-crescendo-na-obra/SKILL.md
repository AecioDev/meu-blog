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

## Categoria — consulte a fonte de verdade

Antes de validar a categoria, leia `src/dados/categorias.json`: valem as que
estão com `publica: true`, escritas exatamente como no campo `nome`. Não
mantenha uma lista própria de categorias nesta skill.

Se a categoria recebida não estiver lá, PARE e peça confirmação ao usuário
antes de criar uma nova — não adianta insistir, porque o schema valida contra
essa lista e o build vai falhar. Cadastrar categoria nova é decisão do usuário
e o procedimento está no README.

## Informações que você precisa RECEBER antes de montar o post

Não prossiga sem ter isso em mãos (pergunte ao usuário o que faltar):

- Título
- Texto completo do post (corpo, já em Markdown ou texto corrido)
- Resumo/descrição curta (1-2 frases)
- Categoria (deve estar publicada em `src/dados/categorias.json`)
- Caminho ou arquivo da imagem de capa + texto alternativo dela
- Data de publicação — se o usuário não disser, use a data de hoje
- Se deve ser marcado como destaque (`featured: true`) — padrão é `false`

A capa pode chegar de três formas:

1. **Rascunho em `drafts/`** — quando o post veio dos subagentes, o material
   fica em `drafts/<slug>/`: o `post.md` do redator e a `capa.jpg` do gerador
   de imagens. Mova de lá para a pasta final do post.
2. **Já no projeto** — o usuário colocou o arquivo na pasta do post. Confira
   que existe antes de escrever o frontmatter.
3. **Caminho no computador** — o usuário informa onde o arquivo está
   (ex: `C:\Users\espir\Downloads\pia.jpg`) e você copia para a pasta do post como `capa.jpg`.

Se a imagem veio **anexada na conversa**, o anexo serve para você ver a foto,
mas não vira arquivo no projeto: peça o caminho dela no computador ou que o
usuário a salve na pasta do post.

Vindo de `drafts/`, confira se sobrou algum marcador do rascunho no texto —
`[CONFERIR: ...]`, `[SUGESTÃO DE ANÚNCIO: ...]` ou `[ISCA: ...]`. Nenhum vai para o ar: o
primeiro depende de decisão do usuário, e o segundo só vira banner se houver
anunciante. Na dúvida, pergunte em vez de apagar por conta própria.

**Imagens de passo a passo:** o rascunho já vem com as referências prontas
(`![alt](./passo-1.jpg)`). Leve todos os arquivos de imagem da pasta do
rascunho junto com o `index.md`. Se o build parar com
`[ImageNotFound] Could not find requested image`, é imagem de passo que o
usuário ainda não gerou: **pare e peça o arquivo**. Nunca remova a referência
nem invente uma imagem no lugar — a referência é o que faz o post ficar
pronto sozinho quando o arquivo chega.

Sobre anúncios: o post já ganha um espaço automático depois do conteúdo,
vindo do layout — não há nada a fazer para isso aparecer. Se o usuário quiser
um **banner de anunciante no meio do texto**, veja a seção logo abaixo.

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

## Banner de anunciante dentro do post

O blog roda AdSense e venda direta ao mesmo tempo. São coisas diferentes:

- **AdSense** — automático, vem do layout (o espaço depois do conteúdo e os da
  barra lateral). Você não faz nada.
- **Venda direta** — banner de um anunciante específico, colocado no meio do
  texto. É isso que você monta quando o usuário pedir.

O banner é só uma imagem com link. Guarde o arquivo na pasta do post, junto do
`index.md`:

```markdown
[![Publicidade: Loja do Zé, 20% off em ferramentas](./banner-parceiro.jpg)](https://loja.com.br)
```

**GIF animado funciona.** O Astro preserva a animação e converte para WebP
animado, que sai menor que o GIF original. Não precisa de `.mdx` nem de
componente para isso.

### Duas regras ao montar um banner

**1. O alt precisa dizer que é publicidade.** É o que separa anúncio de
conteúdo para quem usa leitor de tela. Escreva `alt="Publicidade: Loja do Zé,
20% off"`, nunca uma descrição que soe como ilustração do tutorial.

**2. Link pago leva `rel="sponsored"`.** É o que o Google espera, e o Markdown
puro não gera esse atributo — precisa de HTML. **Só que HTML dentro do `.md`
muda onde o arquivo tem que estar:**

| Como você escreve | Onde o arquivo fica | O que acontece |
| --- | --- | --- |
| `![alt](./banner.gif)` | pasta do post | o Astro resolve e otimiza (vira WebP animado) |
| `<img src="...">` | `public/anuncios/` | servido como está; caminho **absoluto** |

O motivo: o Astro processa caminho relativo do Markdown, mas **não toca no
`src` de HTML bruto** — ele sai literal no HTML final. Um `./banner.gif` ali
vira 404, porque o arquivo nunca é copiado para junto da página. Testado: a
pasta do post no `dist/` fica só com o `index.html`.

Então, quando precisar de `rel="sponsored"`:

```html
<a href="https://loja.com.br" rel="sponsored">
  <img src="/anuncios/banner-parceiro.gif" alt="Publicidade: Loja do Zé, 20% off">
</a>
```

com o arquivo em `public/anuncios/`. A animação do GIF é preservada nos dois
caminhos.

⚠️ Ao escrever HTML dentro do `.md`, use **somente classes CSS que já existam
no projeto**. O Tailwind não escaneia os arquivos da collection, então classe
nova escrita ali não é compilada e simplesmente não estiliza nada.

## Schema do frontmatter (obrigatório em todo post)

```yaml
---
title: "Título do post"
description: "Resumo de 1-2 frases, usado em meta description e nos cards"
pubDate: 2026-08-22
category: "Hidráulica" # deve estar publicada em src/dados/categorias.json
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
2. **Valide a categoria** contra `src/dados/categorias.json`. Se o valor
   recebido não bater exatamente com uma das publicadas, pergunte antes de
   prosseguir.
3. **Gere o slug** do post a partir do título (minúsculo, sem acento, com
   hífen no lugar de espaço) e confira que não existe outra pasta com o mesmo
   slug em `src/content/posts/`.
4. **Crie a pasta** `src/content/posts/<slug>/` e monte o `index.md` dentro
   dela, com o frontmatter exatamente conforme o schema acima, seguido do
   texto recebido do usuário (sem alterar o conteúdo).
5. **Leve as imagens para a pasta do post — sempre pelo otimizador**, nunca
   com cópia direta:

   ```bash
   node scripts/otimizar-imagem.js --entrada drafts/<slug>/capa.jpg      --saida src/content/posts/<slug>/capa.jpg --tipo capa
   ```

   Faça o mesmo com cada imagem do corpo, trocando para `--tipo conteudo`
   (mantém a proporção; `capa` corta para 1200x630, que é o formato de
   compartilhamento). O frontmatter aponta `./capa.jpg`.

   O motivo: `drafts/` fica fora do Git, mas `src/content/posts/` é
   versionado. Arte vinda de gerador costuma ter vários MB, e o Git guarda
   cada versão para sempre — uma capa de 1,75 MB vira 26 KB depois do
   otimizador, sem diferença visível no site. O original em alta continua
   intacto no rascunho.

   Imagem que já for pequena passa sem ser ampliada, e GIF animado mantém
   os quadros.
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
- [ ] Frontmatter completo, válido, categoria publicada no catálogo
- [ ] Pasta criada com o slug certo, sem conflito com post existente
- [ ] Capa dentro da pasta do post, referenciada como `./capa.jpg`
- [ ] Todas as imagens passaram por `scripts/otimizar-imagem.js` — nenhuma
      cópia direta de `drafts/` para `src/`
- [ ] Banner de anunciante, se houver: alt identificando como publicidade,
      `rel="sponsored"` no link, e o arquivo no lugar certo para a forma
      escolhida (pasta do post no Markdown; `public/` no HTML bruto)
- [ ] Se usou HTML bruto: conferiu no `dist/` que a imagem do banner existe
      no caminho que o `src` aponta
- [ ] `npm run build` passou (é ele que valida o schema)
- [ ] `npm run dev` mostra o post certo na home e na categoria
- [ ] Usuário revisou e aprovou antes de qualquer commit/push

## O que nunca fazer

- Nunca escrever ou reescrever o conteúdo do post — isso é responsabilidade
  do usuário ou de outro agente de redação.
- Nunca inventar categoria, imagem ou informação que não foi fornecida.
- Nunca copiar imagem direto de `drafts/` para `src/content/posts/`: passe
  pelo otimizador, senão o arquivo em alta entra no histórico do Git.
- Nunca usar caminho absoluto no `coverImage` — o build passa e a capa quebra
  depois, sem aviso nenhum.
- Nunca deixar banner de anunciante passar por conteúdo: o alt sempre diz que
  é publicidade, e o link sempre leva `rel="sponsored"`.
- Nunca considerar o post pronto tendo rodado só o `npm run dev`: erro de
  schema não aparece lá.
- Nunca publicar (commit/push) sem aprovação explícita do usuário.
