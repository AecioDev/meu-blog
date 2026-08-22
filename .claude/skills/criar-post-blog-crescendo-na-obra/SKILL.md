---
name: criar-post-blog-crescendo-na-obra
description: Use esta skill sempre que for criar, redigir ou publicar um novo post para o blog "Crescendo na Obra". Isso inclui pedidos como "cria um post sobre X", "escreve um tutorial sobre Y", "novo artigo pro blog", ou qualquer variação que envolva adicionar conteúdo ao blog. Garante que o post siga o schema correto, o tom de voz da marca e o processo de revisão antes de publicar.
---

# Criar post para o blog "Crescendo na Obra"

## Contexto do blog

Blog sobre o dia a dia de cuidar da própria casa (trocar torneira, consertar chuveiro, escolher tinta, tutoriais, notícias, curiosidades). Público: geração Z virando adulta agora, alugando ou comprando o primeiro imóvel, sem experiência nenhuma com isso ainda.

Tom de voz — sempre:

* Caseiro, direto, acolhedor. Como um amigo que entende de casa explicando sem fazer a pessoa se sentir burra.
* Nunca técnico, nunca corporativo, nunca "manual de engenharia".
* Frases curtas. Evite jargão. Se usar um termo técnico inevitável (ex: "disjuntor"), explique em parênteses na primeira aparição.
* Pode usar humor leve e emojis pontuais (como já aparece no site: 🚿 💡 🎨 🧰), sem exagerar.

## Categorias válidas

Use somente uma destas categorias existentes. Se o assunto não se encaixar em nenhuma, PARE e pergunte ao usuário antes de criar uma categoria nova — categoria nova exige ajuste em outras partes do site (navegação, sidebar).

* Hidráulica
* Elétrica
* Pintura
* Dicas Gerais

## Onde o post mora: uma pasta por post

Cada post é uma pasta dentro de `src/content/posts/`, com o texto e todas as
imagens dele juntos:

```
src/content/posts/
└── como-desentupir-a-pia/      ← o nome da pasta é o slug da URL
    ├── index.md                ← o texto do post
    ├── capa.jpg                ← imagem de capa
    └── passo-1.jpg             ← demais imagens do post (opcional)
```

Esse post fica acessível em `/posts/como-desentupir-a-pia/`. O nome da pasta
vira a URL, então use só letras minúsculas, números e hífen — sem acento, sem
espaço.

Dentro do `index.md` os caminhos são **relativos à própria pasta**:

* capa no frontmatter → `coverImage: './capa.jpg'`
* imagem no meio do texto → `![Descrição da imagem](./passo-1.jpg)`

O Astro otimiza as duas automaticamente no build (converte para WebP,
redimensiona e gera as versões responsivas). Caminho absoluto tipo
`/imagens/capa.jpg` **não dá erro de build**, mas a capa fica quebrada no site
publicado e some do compartilhamento — nunca use.

## De onde vêm as imagens

**Nunca gere nem invente a imagem de capa.** O blog não tem gerador de imagem
versionado: a capa sempre vem do usuário.

Aceite de duas formas:

1. **Arquivo já no projeto** — o usuário criou a pasta do post e colocou as
   imagens lá. Confira que existem antes de escrever o frontmatter.
2. **Caminho do arquivo no computador** — o usuário informa onde o arquivo está
   (ex: `C:\Users\espir\Downloads\pia.jpg`) e você copia para a pasta do post,
   renomeando para `capa.jpg`.

Sobre imagem anexada na conversa: o anexo serve para você **ver** a foto (e
escrever um `coverImageAlt` que descreva a imagem de verdade), mas o anexo não
vira arquivo no projeto. Se a imagem só existir como anexo, peça ao usuário o
caminho dela no computador ou que a salve na pasta do post.

Se não houver imagem nenhuma, **PARE e peça** antes de continuar. Não crie o
post sem capa: `coverImage` é obrigatório e o build falha sem ele.

## Schema do frontmatter (obrigatório em todo post)

```yaml
---
title: "Título do post"
description: "Resumo de 1-2 frases, usado em meta description e nos cards"
pubDate: 2026-08-22
category: "Hidráulica" # uma das 4 categorias válidas, exatamente como escrito acima
tags: ["opcional", "array de strings"]
coverImage: "./capa.jpg" # relativo à pasta do post
coverImageAlt: "Descrição da imagem para acessibilidade"
author: "Equipe Crescendo na Obra"
featured: false # true só quando o usuário pedir explicitamente destaque
---
```

Existe ainda um campo opcional `draft: true`, que esconde o post do site sem
apagar o arquivo — útil para deixar um rascunho no projeto.

## Passo a passo para criar um post

1. Confirme o assunto e o ângulo com o usuário se não estiver claro (ex: "trocar torneira" pode ser sobre torneira de cozinha ou de banheiro — pergunte se não foi especificado).
2. Verifique a categoria contra a lista acima antes de escrever.
3. Confirme onde está a imagem de capa (ver "De onde vêm as imagens"). Sem capa, pare e peça.
4. Crie a pasta `src/content/posts/<slug>/`, coloque a capa como `capa.jpg` e escreva o `index.md`.
5. Escreva o post seguindo o tom de voz. Estrutura sugerida:
   * Abertura com o problema/dor que a pessoa está sentindo
   * Passo a passo numerado quando for tutorial
   * Lista de materiais/ferramentas necessárias, se aplicável
   * Fechamento com uma dica extra ou aviso de segurança, se o tema envolver risco (elétrica, gás, estrutura)
6. Segurança em primeiro lugar: qualquer post sobre elétrica, gás ou estrutura precisa terminar com um aviso recomendando profissional habilitado para partes de risco — siga o padrão que já existe no rodapé do site.
7. Rode `npm run build` (pega erro de schema e de imagem, que o dev server pode deixar passar) e depois `npm run dev` para conferir que o post aparece na home, na categoria certa e com a capa carregando.
   * Se você **moveu ou renomeou** arquivos de post, o dev server que já estava rodando fica com o índice antigo em cache e acusa erro de imagem que não existe mais. Pare o servidor, apague a pasta `.astro/` e suba de novo. O `npm run build` não sofre disso, por rodar em processo novo.
8. NÃO faça commit nem push automaticamente. Mostre o post pronto para o usuário revisar. Só publique (`git add`, `git commit`, `git push`) depois de confirmação explícita dele.

## Checklist antes de considerar o post pronto

* [ ] Pasta criada com o slug certo (minúsculas, sem acento, com hífen)
* [ ] Frontmatter completo e válido (todos os campos obrigatórios)
* [ ] `coverImage` relativo (`./capa.jpg`), nunca caminho absoluto
* [ ] Capa veio do usuário — nenhuma imagem inventada
* [ ] `coverImageAlt` descreve a imagem de verdade
* [ ] Categoria é uma das 4 válidas
* [ ] Tom de voz consistente (sem jargão técnico não explicado)
* [ ] Aviso de segurança incluído, se o tema envolver risco
* [ ] `npm run build` sem erro e o post aparece certo no `npm run dev`
* [ ] Usuário revisou e aprovou antes de qualquer commit/push

## O que nunca fazer

* Nunca inventar uma categoria nova sem perguntar antes.
* Nunca gerar, inventar ou reaproveitar de outro post a imagem de capa — ela vem sempre do usuário.
* Nunca usar caminho absoluto no `coverImage`: o build passa e a capa quebra depois, sem aviso.
* Nunca publicar (commit/push) sem aprovação explícita do usuário.
* Nunca dar instrução técnica perigosa (ex: mexer em fiação de alta tensão, mexer em botijão de gás) sem o aviso de "chame um profissional".
