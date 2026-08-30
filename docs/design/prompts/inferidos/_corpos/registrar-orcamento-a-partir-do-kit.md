# "Salvar em Orçamentos" dentro do compositor de kits

## O que desenhar
A ação que congela o kit que está na tela como um **orçamento** (documento imutável, com a data de hoje),
e a folha que ela abre. Ela vive na aba **Kits** (`/kits`), na mesma coluna do resumo: hoje aparece entre o
cartão "Total do kit" e o cartão de "Salvar kit". Quem usa é o vendedor Premium ativo, no fim da composição —
já viu o preço do kit e quer guardar aquele número com a data para mandar ao cliente. Precisa desenhar
**duas coisas**: (1) a ação em si, convivendo com "Salvar kit" a um cartão de distância; (2) a folha de
confirmação que ela abre.

## Por que este prompt existe
Nada disso foi desenhado. No canvas do 018 (`Abas-Desktop.dc.html`), a coluna direita de Kits tem exatamente
quatro blocos — Total do kit, Preços por canal (kit), Nome do kit e "Salvar kit" — e **nenhum** botão de
orçamento: a busca por "Salvar em Orçamentos" e por "Registrar" no arquivo dá zero. O protótipo de 2026-07-02
desenhou o Histórico como lista + detalhe congelado + exportar; a **ação de registrar a partir de outra tela**
nunca foi desenhada, e kits não existiam no protótipo. Resultado: duas ações de gravar com efeitos
irreversivelmente diferentes — "Salvar kit" cria uma coisa **viva** que recalcula sempre, "Salvar em
Orçamentos" cria um documento **congelado e imutável** — dividem o mesmo canto da tela, começam com o mesmo
verbo, e não há nenhuma hierarquia visual que as distinga. É a confusão mais provável de todo o fluxo de kits.

## O que já existe hoje (não invente do zero — corrija)
Origem: `apps/web/src/pages/bom/bom-page.tsx` (linhas ~577-665) e
`apps/web/src/features/history/record-snapshot-sheet.tsx`.

Ordem atual da coluna direita, de cima para baixo:

| # | Bloco | Conteúdo real |
|---|---|---|
| 1 | Preços por canal (kit) | "Mercado Livre · Clássico — R$ 268,90", legenda "3 peça(s) somaram neste canal" |
| 2 | Total do kit | "Custo total R$ 96,40" + Varejo **R$ 241,00** + Atacado **R$ 192,80** |
| 3 | **A ação desta ficha** | botão secundário, ícone de disquete 18px, "Salvar em Orçamentos", **centralizado** |
| 4 | Cartão "Salvar kit" | campo "Nome do kit" (placeholder "Kit suporte + base") + botão primário "Salvar kit" |

→ O botão de orçamento é **secundário e centralizado**, sozinho no meio de duas caixas com borda: ele não
pertence visualmente a nada. Não tem título, nem uma linha dizendo o que é congelar. Um vendedor que leu
"Salvar em Orçamentos" logo acima de "Salvar kit" não tem como saber que uma coisa recalcula e a outra não.
→ Desabilitado quando **nenhuma peça válida entrou no total** — e nesse estado ele **não diz nada**. A
explicação existe, mas está no cartão acima: "Sem preço ainda" / "O preço do kit aparece assim que ao menos
uma peça estiver completa e válida."
→ Quando o Premium **não** está ativo, o botão **não existe** (não é cinza, não é teaser — decisão do dono
Q15, 2026-07-13). Mas "Salvar kit", ao lado, continua visível e responde honestamente. Duas ações vizinhas
com políticas opostas de presença, sem desenho que explique a diferença.
→ No mobile o "Total do kit" é uma barra `sticky` no rodapé com `z-index: 10`, e este botão vem **depois**
dela no fluxo: durante a rolagem ele passa por baixo da barra. O lugar dele no mobile precisa ser decidido.

A folha que abre (painel ancorado na borda **direita**, `min(92vw, 26rem)` — ~416px no desktop, ~358px em
390px), nesta ordem:

1. Título: **"Salvar em Orçamentos"** (a terceira vez que a mesma frase aparece: botão, título e submit)
2. Texto: "Vamos guardar os valores exatamente como estão nesta tela, com a data de hoje."
3. Campo "Rótulo (opcional)", dica "Cliente, pedido…", máx. 120 caracteres
4. Campo "Validade da proposta", numérico 1–3650, com o sufixo "dias" à direita do campo
5. Grupo "Preço que você está cotando": duas opções em linha de 44px, rótulo à esquerda e valor à direita —
   "Varejo · **R$ 241,00**" (pré-selecionada) e "Atacado · **R$ 192,80**"
6. Legenda: "Cotado em 20/08/2026"
7. Botão primário: **"Salvar em Orçamentos"**

## Conteúdo e dados reais
- Os valores da folha são **congelados quando a folha abre** — não mudam depois, mesmo que o kit seja editado
  atrás dela. Isso é a promessa central da peça e hoje só está dita na frase do item 2.
- Dinheiro sempre `R$ 0.000,00`, dígitos tabulares. Faixa plausível de um kit: R$ 45,00 a R$ 1.284,90;
  desenhe pelo menos um estado com **R$ 12.480,00** para provar que a linha do rádio não estoura.
- "Validade da proposta" é **opcional** e não é prazo de expiração do registro: é a validade que o vendedor
  prometeu ao cliente. Nada apaga o orçamento depois.
- Só existe a opção Atacado se o kit tiver preço de atacado; com um único preço, o grupo mostra uma linha só.
- O rótulo em branco é gravado como "sem rótulo", nunca como texto vazio.

## Estados obrigatórios
- **Repouso / hover / foco visível / pressionado** do botão de origem, no contexto real da coluna.
- **Desabilitado** — nenhuma peça válida no total. Precisa de uma razão legível junto do botão (hoje não há).
- **Ausente** — sem Premium ativo o botão simplesmente não está lá. Desenhe a coluna **sem** ele e mostre que
  o espaço não fica quebrado; não desenhe versão cinza nem teaser.
- **Premium pausado** — o botão some, e no topo da página fica: "Premium pausado — você pode reabrir e
  recalcular este kit. Salvar precisa do Premium ativo."
- **Folha em repouso** (o estado principal) e **folha enviando** — o submit fica desabilitado durante o envio;
  hoje ele **não** troca de texto, enquanto o "Salvar kit" vizinho troca para "Salvando…". → resolver.
- **Sucesso** — aviso "Registro salvo em Orçamentos." (tom sucesso), folha fecha.
- **Offline** — grava no aparelho e avisa: "Pendente neste dispositivo. Sincroniza sozinho quando houver
  conexão." (tom informativo, **nunca** vermelho, **nunca** "não é premium").
- **Envio pausado por plano** — "Envio pausado — o Premium não está ativo. O registro continua neste aparelho."
- **Sessão expirada** — "Envio pausado — sua sessão expirou. O registro continua neste aparelho."
  (a palavra "conexão" é proibida aqui: a rede está boa, quem morreu foi a sessão).
- **Recusado pelo servidor** — "Não foi possível registrar. O servidor não aceitou este registro." (perigo).
- **O aparelho não conseguiu guardar** — "Não foi possível guardar o registro neste aparelho. Ele não foi
  salvo." (perigo) e **a folha continua aberta**, com tudo preenchido: o vendedor não perde a cotação.

## Viewports
- **Mobile 390px** — a peça existe no mobile e é onde o conflito com a barra fixada do "Total do kit"
  acontece. Desenhe a coluna rolando e a folha ocupando ~92% da largura.
- **Desktop 1280px** — o corte do 018: a coluna da direita tem 480px fixos e é `sticky`. É aqui que os três
  blocos (total, ação, salvar kit) aparecem juntos na mesma tela, e é aqui que a confusão fica mais visível.
- **Desktop 1920px** — só se a folha de 416px ancorada à direita mudar de leitura numa tela larga.

## Regras que o desenho não pode quebrar
- **Congelado ≠ vivo.** O desenho tem que dizer, em palavras, que "Salvar em Orçamentos" guarda os números de
  hoje para sempre e "Salvar kit" guarda uma receita que recalcula. Não pode ficar só na hierarquia.
- **Freemium binário**: sem Premium ativo a ação **não aparece**. Nada de affordance cinza que promete e nega.
- "Salvo" só é dito quando o servidor confirmou. Pendente é pendente, e diz que está só neste aparelho.
- **Falha de rede nunca vira "não é premium"**, e falha de sessão nunca vira falha de rede.
- Frases honestas moram em texto de largura cheia, **nunca dentro de placeholder** (o placeholder só carrega
  exemplos curtos, como "Cliente, pedido…").
- Alvo de toque ≥44px — inclusive cada linha de rádio inteira, não só a bolinha.
- Contraste medido contra o fundo real do cartão, não contra o fundo da página.

## Armadilhas já pagas neste projeto
- **Rótulo longo comendo o número**: no readout do kit, "Preço atacado" (111px) não coube em 101px e a
  reticência apareceria no caso normal de 5 dígitos. Quem cede é sempre o rótulo, nunca o valor.
- **Placeholder que corta a frase honesta** (016/PR-F): a frase foi para o placeholder, o campo estreitou e
  metade sumiu. Placeholder carrega número, não promessa.
- **Elemento visualmente coberto passa em teste**: "está visível" não sabe de oclusão. O botão que passa por
  baixo da barra fixada é exatamente essa classe — resolva no desenho, com posição, não empilhando camadas.
- **Transbordo horizontal medido**: valores de 5 dígitos na linha do rádio, com o rótulo à esquerda e o valor
  empurrado à direita, é o ponto onde 390px estoura.
- **Duas ações com o mesmo verbo lado a lado** já custou uma correção neste app: "Atualizar" (nosso) a 8px de
  "Atualizar forma de pagamento" (Mercado Pago) virou "Recarregar". Aqui são dois "Salvar".

## Entregável
Pranchetas, **tema escuro primeiro e tema claro como igual**:
1. Kits a 1280px, coluna direita completa em repouso, com a ação desenhada em relação a "Salvar kit".
2. A mesma coluna nos estados: ação desabilitada (com razão legível) e ação ausente (sem Premium ativo).
3. A folha aberta em repouso, a 1280px, com valores reais e com o caso de R$ 12.480,00.
4. A folha nos estados enviando · aparelho não guardou (folha aberta com o aviso) — e os avisos de sucesso,
   pendente e sessão expirada.
5. Kits a 390px: a coluna rolando com a barra "Total do kit" fixada, mostrando onde a ação fica.

Reutilize os primitivos existentes, não crie novos: o botão de origem é o `tf-btn--secondary` com ícone; a
folha é o `tf-dialog--sheet-right`; os campos são `tf-field` + `tf-inputwrap`/`tf-input`; os valores dos
rádios usam `tf-price` (ou o par rótulo/valor do `tf-brow`); os avisos são `tf-alert` nos tons `info`,
`success` e `danger`; o cartão de "Salvar kit" continua sendo `tf-card`.

## Perguntas em aberto para o dono
1. **O rótulo continua "Salvar em Orçamentos"?** Ele é o mesmo em três lugares (botão, título e submit da
   folha) e colide com "Salvar kit" logo abaixo. Se puder mudar, mudar **qual** — e a copy já está homologada
   na tela de Orçamentos vazia ("…toque em 'Salvar em Orçamentos'"), então trocar aqui obriga a trocar lá.
2. **Qual das duas ações é a principal no kit?** Hoje "Salvar kit" é primária e o orçamento é secundário.
   É a hierarquia que o dono quer, ou o vendedor chega no kit para cotar?
3. **O botão desabilitado deve dizer por quê**, ou basta o "Sem preço ainda" do cartão acima?
4. **No mobile, a ação fica onde?** Acima da barra fixada, dentro dela, ou só no fim da rolagem?
