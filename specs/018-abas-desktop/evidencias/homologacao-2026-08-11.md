# Homologação visual do 018 — pelo assistente, 2026-08-11

**Quem**: o assistente, a pedido do dono ("homologa primeiro do que eu").
**O que isto vale**: nada aqui é `REVERIFICADO`. Pelo `docs/homologacao/PROCESSO-HOMOLOGACAO.md`, o
resultado desta passada é **`CORREÇÃO DECLARADA`** — quem fecha um ponto é o dono, repassando.
O valor desta homologação é **reduzir o que chega até ele**, não substituí-lo.

**Veredito**: **PASS COM RESSALVAS — 88%.** Dois defeitos encontrados e corrigidos aqui; dois
achados de UX deixados para decisão do dono; uma lacuna de processo que continua aberta.

---

## 1. Como foi feito

Produto real no ar (dev server + backend + emulador), conta premium real, e **dados semeados de
propósito adversariais**: um produto de nome longo ("Organizador de mesa grande com divisórias"), um
rótulo de orçamento longo ("Cliente Bruno · reposição de peças do balcão"), um kit de 3 linhas com
quantidades diferentes, 4 orçamentos gravados **pelo caminho real da UI**.

Cada tela foi medida por **caixa do DOM**, não por texto — `toBeVisible` passa em elemento
totalmente ocluso (lição do 014). O medidor registra, por elemento interativo:

- estouro à direita/esquerda da viewport, em px;
- **oclusão real**, via `elementFromPoint` no centro do elemento;
- vazamento além da borda direita do `<main>` (transbordo interno que a página esconde);
- os dois eixos de rolagem da página.

E cada tela foi **olhada em 1:1** — nunca redimensionada.

**Cobertura**: 1920 · 1280 · 390 · tema claro **e** escuro · Catálogo (4 seções) · Kits (kit salvo
com 3 peças) · Orçamentos (4 registros) · Conta.

## 2. Defeitos encontrados — e corrigidos nesta passada

### A1 (ALTA) — o card aberto não se declarava · **CORRIGIDO**

No mestre-detalhe de Orçamentos, o registro abria à direita e **nenhum card da lista ficava
marcado**. O vendedor perdia o vínculo entre o que escolheu e o que está lendo. O Catálogo já
marcava; aqui faltava — e a própria spec pede (FR-021).

Nada quebrava, nada ficava vermelho, nenhuma medida acusava. **Só a imagem pegou.**

Conserto: `aria-current="true"` + o mesmo tratamento visual do card selecionado do Catálogo.
Trava: `pages/historico/historico-selecao.test.tsx` (3 casos, incluindo "no mobile não há lista para
marcar").

### A2 (MÉDIA) — a 1280px a lista ficava maior que o documento · **CORRIGIDO**

Medido: lista **520px** contra documento **432px**. A prioridade estava invertida — quem precisa de
espaço em Orçamentos é o registro, com sua tabela de detalhamento e os preços por canal; a lista é
um índice. A regra "lista fixa de 520px", correta a 1920, não escalava para baixo.

Conserto: abaixo de 1440px as colunas dividem por fração com piso de leitura na lista; de 1440 para
cima volta a largura fixa do desenho. Medido depois: lista **405** / documento **547**.

## 3. Achados deixados para o dono decidir

### A3 (MÉDIA) — a ficha de Produto/Kit não acrescenta nada ao card

A decisão do clarify foi "resume e abre o editor de página cheia" — e foi respeitada. Mas o resumo
hoje repete **exatamente** o que o card já mostra (nome + referências) e oferece um botão. O
vendedor clica e não ganha informação: a coluna de 560px vira um botão grande.

Sugestão, se você quiser: mostrar na ficha o que o card não mostra — gramas, tempo de impressão,
taxa de falha, e o custo/preço quando houver. Não muda a decisão (o editor continua sendo a página);
só faz a ficha valer o clique. **Não fiz** porque muda escopo e é decisão sua.

### A4 (BAIXA) — a ordem dos blocos no resumo do Kit

O desenho põe "Preços por canal (kit)" **abaixo** do total; a implementação herda a ordem do
componente atual, que renderiza os canais **acima**. Essa ordem foi decidida em 2026-07-12 por causa
da barra fixa (o rollup rolava acima dela) — razão que **desaparece** quando o resumo vira coluna.
Não pude ver na tela: o kit semeado não tem canais habilitados, então o bloco não renderiza (o que é
o comportamento honesto). Fica registrado para quando houver canais.

## 4. O que foi verificado e passou

| Verificação | Resultado |
|---|---|
| Transbordo horizontal, 4 telas × 1920/1280/390, claro e escuro | **0** em todas |
| Oclusão de elementos interativos (`elementFromPoint`) | 0 problemas reais |
| Vazamento além da borda do `<main>` | 0 |
| Exatamente um `<h1>` por tela | sim, em todas |
| Alertas de erro na tela | nenhum |
| Nome longo de produto / rótulo longo de orçamento | cabem, sem estouro e sem reticência |
| Kits: barra do rodapé | ausente ≥1280, **presente** a 390 |
| Catálogo: lista 2 colunas a 1920, 1 coluna a 1280 | confere |
| Tema escuro | contraste íntegro nas 4 telas |
| Menu recolhido devolve largura | +164px ao conteúdo |

## 5. Uma correção sobre o que eu mesmo havia escrito

O `dod-evidence.md` dizia "não foi medido em tema claro". Estava errado ao contrário: **todas** as
capturas anteriores já eram tema claro — quem não tinha sido medido era o **escuro**. Os dois estão
medidos agora.

## 6. Limitação da minha própria ferramenta

O detector de oclusão acusou um `INPUT` "coberto pela TabBar" em `/kits` a 390px. **É falso
positivo**: ele mede a posição no topo da página, e qualquer elemento no fim de uma página que rola
fica sob uma barra fixa. Registro para não virar um "achado" fantasma numa próxima passada.

## 7. O que continua NÃO verificado

- **Leitor de tela real** — não executei tecnologia assistiva. O que garanti foi estrutural: o nome
  acessível de cada item do menu sobrevive ao recolhimento (teste), um `<h1>` por tela (medido).
- **Guarda de geometria permanente no CI** — segue ausente. Tudo nesta homologação foi medido por
  script, uma vez. É a pendência mais séria do PR.
- **e2e (Playwright)** — não rodou neste ciclo.
- **Kits com canais habilitados** — não exercitado (ver A4).
- **Estados de falha** (offline, sessão expirada, premium pausado) **nas composições novas** — não
  foram percorridos.

## 8. Por que 88% e não mais

Dois defeitos reais escaparam da minha implementação e só apareceram quando alguém olhou a imagem e
mediu a proporção das colunas — o que confirma, mais uma vez, que suíte verde não homologa nada. O
que ficou de fora (§7), sobretudo a guarda permanente, é o que impede um número maior.
