# Quickstart — como validar o 018 rodando

Este guia é para **provar que o incremento funciona**, não para explicar como ele foi feito. Ele
assume o produto no ar pelo caminho de `docs/homologacao/ROTEIRO-MANUAL.md` §Antes de começar
(postgres 5433 · backend 8000 via `scripts/run_e2e_server.py` · emulador de auth 9099 · `pnpm dev`).

Confira, antes de abrir o navegador, que `/health` responde **200** e `/api/v1/entitlement` responde
**401**. Um 500 aqui invalida tudo o que vier depois — foi exatamente o que fez o grupo 0 da rodada 1
parecer defeito de tela quando era backend caído.

Para ver as telas premium: `cd backend && uv run python -m app.scripts.grant_premium grant <email>
--source comp --expires 2027-12-31`.

---

## 1. O gate de largura (faça isto primeiro — tudo depende dele)

| Largura da janela | O que tem de acontecer |
|---|---|
| 1920px | mestre-detalhe, lista do Catálogo em **2 colunas** |
| 1600px | mestre-detalhe, lista virando 2 colunas por aqui |
| 1280px | mestre-detalhe, lista em **1 coluna** |
| **1279px** | composição **de hoje**, coluna única — a largura que prova o corte |
| 390px / 360px | mobile de hoje, idêntico |

> Meça a largura da **viewport**, não a da janela: com DevTools acoplado lateralmente, os dois
> números diferem, e é o da viewport que a media query lê.

---

## 2. Catálogo — `/catalogo` (premium, ≥1280px)

1. Abra: título, contagem da seção, 4 pílulas, botão de adicionar, busca, lista, ficha à direita.
2. Clique em outro item: **a ficha troca, a URL não muda e a lista continua na tela.**
3. Em **Filamentos**, mude um campo na ficha e salve: o card correspondente na lista reflete o novo
   valor **sem recarregar**.
4. Em **Produtos**, a ficha resume e o botão abre a página cheia de hoje (`?produto=`).
5. Troque de seção com um item selecionado: a seleção **não vaza** entre seções.
6. Digite na busca: a lista filtra; nenhuma requisição nova sai (aba Network vazia).
7. Seção sem itens: estado vazio **no lugar da lista e no lugar da ficha** — nunca uma ficha órfã.
8. Saia do premium (ou abra deslogado): **um** teaser, nenhuma lista.

## 3. Orçamentos — `/historico` (premium, ≥1280px)

1. Filtros + lista à esquerda, registro mais recente aberto à direita.
2. Clique noutro registro: o painel troca, a lista fica.
3. Confira que o painel tem tudo o que a tela de detalhe entrega hoje: valor cotado + base, data e
   hora, tipo, validade, detalhamento, canais, ficha técnica, e a frase de que o registro é congelado.
4. "Carregar mais": o registro aberto **não muda**.
5. Abra `/historico/<id>` direto na barra de endereço: continua funcionando.

## 4. Kits — `/kits` (premium, ≥1280px)

1. Peças à esquerda, resumo à direita. **Não existe barra colada no rodapé.**
2. Mude a quantidade de uma peça: custo, varejo, atacado e canais respondem.
3. Deixe uma peça inválida: ela fica fora do total, o card mostra o aviso, o resumo diz quantas peças
   ficaram de fora.
4. Estreite para 1279px: a barra do rodapé **volta**, como hoje.

## 5. Conta — `/conta` (≥1280px)

1. Três colunas: identidade+plano · tema · privacidade+sair.
2. Como grátis: a oferta aparece na coluna do plano, com os dois planos e os preços.
3. Clique em Claro/Escuro no segmentado: o tema muda **e sobrevive ao recarregar**.
4. A 390px: o interruptor de tema de hoje, inalterado.

## 6. Menu recolhível (≥1280px)

1. "Recolher": o menu vira 76px de ícones.
2. Navegue: continua recolhido, seção atual continua marcada.
3. Recarregue: continua recolhido.
4. Com leitor de tela (ou inspecionando o nome acessível): cada item **continua se chamando**
   "Catálogo", "Kits"… — o rótulo sumiu da tela, não da acessibilidade.
5. Teclado: Tab entra no menu uma vez; setas percorrem as seções.

---

## 7. As duas medidas que não se fazem no olho

**Rolagem e transbordo** — em 1920, 1600, 1440, 1280, **1279**, 1024, 390 e 360:

```js
// no console, com a tela aberta
const de = document.documentElement;
({ x: de.scrollWidth - de.clientWidth, y: de.scrollHeight - de.clientHeight })
// x > 0 é transbordo horizontal: defeito.
// y > 0 só é aceitável quando a página realmente é mais alta que a viewport.
```

Repita para a coluna fixa (a ficha/resumo): ela pode rolar **por dentro** quando o conteúdo é mais
alto que a viewport; não pode empurrar a página.

> Meça os **dois** eixos. O scroll do item 9 da rodada 1 só apareceu quando o eixo Y foi medido —
> headless não desenha a barra clássica, e o olho não vê o que não é desenhado.

**Nada de número mudou**: rode o vetor canônico do `ROTEIRO-MANUAL.md` §1.1 e confirme
R$ 28,65 / R$ 42,98 / R$ 37,25. Se um número mudou, o incremento saiu do escopo (FR-004 / SC-007).

---

## 8. Comandos

```bash
pnpm gate:all          # o mesmo comando literal que o CI roda
pnpm --filter web test # só a suíte do cliente
pnpm e2e               # Playwright contra a pilha real
```

Lembrete que este projeto pagou caro: **uma suíte verde não homologa nada**. Em 012/PR-B, mais de mil
testes automatizados não acharam nenhum dos três defeitos reais. O que fecha este incremento é a
segunda passada do dono, no navegador — `docs/homologacao/PROCESSO-HOMOLOGACAO.md`.
