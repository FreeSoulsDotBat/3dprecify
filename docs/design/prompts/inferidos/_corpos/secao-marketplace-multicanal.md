# Seção Marketplace: a chave mestra e a pilha de canais

## O que desenhar

A seção "Marketplace" da tela **Calcular** (`/calcular`): título com ⓘ, a linha de largura total com a
chave **"Incluir marketplaces no preço"** e, quando ligada, uma **lista repetível de cartões de canal** —
cada cartão é um marketplace (Mercado Livre, Shopee, Amazon, Outro) com suas perguntas e suas taxas — mais
o botão "Adicionar canal" no fim. É onde mora a promessa central do produto: comparar o mesmo produto em
Shopee × ML × Amazon no mesmo cálculo. Quem usa é o vendedor 3D que já preencheu custo e markup acima e
quer saber por quanto anunciar em cada canal. No desktop (≥1024px) ocupa a coluna DIREITA de uma grade de
duas; no mobile é uma seção empilhada. Os PREÇOS por canal **não** ficam aqui — desde 016/US5 vivem no
rodapé, em "Como chegamos no preço". Esta peça é só a ENTRADA.

## Por que este prompt existe

O protótipo de 2026-07-02 (§E4) desenhou **um** canal: um select (Shopee / ML Clássico / ML Premium /
Nenhum) e dois campos (taxa fixa R$ + comissão %), numa seção colapsável compartilhada com "Falha". A
repetição, o interruptor mestre e tudo que veio depois nasceram sem desenho — busca por "Incluir
marketplaces no preço" e "Adicionar canal" nas quatro autoridades de design devolve **zero**. Hoje um
cartão pode ter 8 controles + 2 legendas + 2 selos + 2 avisos, e N deles empilham numa coluna de meia tela:
é a maior fonte de altura da página. E com a chave **desligada** a tela não mostra nada — nem um resumo do
que se perdeu.

## O que já existe hoje (não invente do zero — corrija)

**Cabeçalho.** Título `Marketplace` com ⓘ; o tooltip diz: *"Sobre o marketplace — Calcula o preço para
anunciar em um marketplace de modo que, após a comissão e a taxa fixa, você receba o preço-base. Anúncio =
(preço + taxa fixa) ÷ (1 − comissão%). Recebido líquido = o que sobra após a comissão sobre o anúncio e a
taxa fixa."*

**Linha da chave.** `<label>` de largura total, clicável inteiro: **"Incluir marketplaces no preço"** à
esquerda (tom secundário), Switch à direita, FORA de qualquer área colapsável para a seção ser sempre
religável. Desligar esconde os canais e para de calcular.
→ Problema: desligada, a seção some inteira e **não sobra nenhuma frase** dizendo o que deixou de ser
calculado — o vendedor não tem como saber que perdeu a comparação de canais.

**Cartão de canal** (`Card`, padding md, controles com gap-3), na ordem real do código:

| # | Controle | Rótulo literal | Tipo / unidade | Quando aparece |
|---|---|---|---|---|
| 1 | Marketplace | `Marketplace` | Select: "Mercado Livre", "Shopee", "Amazon", "Outro" | sempre |
| 1b | Remover | botão ✕ (`aria-label` "Remover canal") | ghost, sm, ao lado do select | sempre |
| 2 | Modalidade | `Modalidade` | Select: ML → "Clássico"/"Premium"; Amazon → "Profissional"/"Individual" | só onde o catálogo declara o eixo |
| 3 | Categoria | picker de categoria com busca | só onde o catálogo publica a espinha (hoje ML/Amazon; Shopee não tem) |
| 4 | Perfil | `Você vende como` | Select "Pessoa física (CPF)" / "Pessoa jurídica (CNPJ)", placeholder "Selecione" | só Shopee |
| 5 | Volume | `Mais de 450 pedidos nos últimos 90 dias?` | Select "Sim"/"Não" | só Shopee **e** só se CPF |
| 6 | Comissão | `Comissão` | número, unidade `%` | conforme o plano do canal |
| 7 | Taxa fixa | `Taxa fixa` | dinheiro | idem |
| 8 | Mínimo | `Comissão mínima/item` | dinheiro | idem |
| 9 | Frete | `Frete` | dinheiro; dica "Descontado do valor recebido (não é embutido no anúncio)." | idem |

Os campos 6–9 ficam numa **grade de 2 colunas** dentro do cartão. Nascem VAZIOS, com o placeholder
mostrando o valor que o catálogo aplica (ex.: `14,5` em Comissão, `2,00` em Taxa fixa) — placeholder e não
valor preenchido, porque preenchido faria o vendedor achar que ele digitou. → Problema medido em 016/PR-F:
a frase da REGRA nunca cabe como sufixo de placeholder (77–187px úteis: saía "2,50 (= 50").

**Abaixo da grade, na ordem:** legenda de banda ("Tabela por faixa de preço — valores da faixa do seu
anúncio." + "Nesta faixa, a taxa fixa é 50% do preço do anúncio — o placeholder mostra o valor já
calculado.") · legenda do subsídio Shopee · checkbox de sobretaxa opcional vinda do catálogo (ex.: manuseio
de volumoso) · a linha de **selos de honestidade** · os avisos Shopee.
→ Problema: até seis blocos de texto miúdo em sequência num cartão de ~560px (desktop) ou 390px (mobile),
sem hierarquia desenhada entre eles.

**Fim da lista:** `Button` secondary sm **"Adicionar canal"**, à esquerda. Sem limite de canais no código.

## Conteúdo e dados reais

- Selos, ao pé do cartão: "Referência · atualizada em {data}", "pode estar desatualizada", "referência
  embutida (offline)", "ajustado por você", "sem referência — informe as taxas", "estimativa de frete",
  "categoria não informada — usando a maior alíquota da tabela", e o selo SEPARADO "Taxa fixa · vigente
  desde {data}" quando a tarifa fixa tem outra fonte que a comissão.
- Subsídio de frete Shopee (informação, nunca desconto): *"A Shopee oferece cupons de frete grátis (até
  R$ 20,00 nesta faixa de preço) — o custo é da Shopee, não seu. Informe no campo Frete só o que sobrar
  para você, se houver."* + "Fonte: {fonte}, vigente desde {data}." · Sobretaxa opcional: *"{valor} por
  pedido, somado como custo do canal — o preço do anúncio sobe MAIS que isso, porque a comissão incide
  sobre ele também. Somado inteiro nesta unidade (não é dividido entre os itens do pedido)."*
- Números verdadeiros: semente **R$ 16,16** (custo), **R$ 24,24** (varejo), **R$ 21,01** (atacado); taxa
  fixa Amazon Individual **R$ 2,00**; teto de cupom Shopee **R$ 20,00**; comissão típica 10%–20% (abaixo
  disso dispara aviso de plausibilidade), faixa 0–99,99% (≥100% erra **só** aquele cartão); dinheiro ≥ 0.
  Use **R$ 1.234,56** em pelo menos um campo para provar a máscara de milhar. Os campos 6–9 são todos
  opcionais — o preço calcula com o que houver e o selo diz de onde veio.

## Estados obrigatórios

- **Chave ligada, um canal (padrão)** — primeira visita: um cartão só, Amazon Profissional, placeholders
  vindos do catálogo. **Chave desligada** — hoje: seção vazia (ver Perguntas em aberto).
- **Sem permissão (grátis)** — Switch **desabilitado e falso**; abaixo, centrada, a frase "Vender em
  marketplaces faz parte do Premium." com o botão de assinar colado nela, lidos como uma unidade. Aqui a
  seção atravessa as DUAS colunas do desktop, não fica presa numa.
- **Falha de atualização das taxas** — `Alert` tom **info** (nunca perigo), título "Não foi possível
  atualizar as taxas", corpo "Usando a referência salva no dispositivo — o cálculo continua funcionando.
  Você também pode informar as taxas manualmente." e botão secundário "Tentar novamente".
- **Retentando** — o mesmo alerta com o botão carregando; o alerta **não** pisca para fora.
- **Offline / degradado** — selo "referência embutida (offline)", ou "sem referência — informe as taxas" e
  aí os campos ficam vazios, sem placeholder nenhum.
- **Erro no canal** — comissão ≥100%: "A comissão deve ser menor que 100%." só naquele cartão, os outros
  seguem calculando. E, quando o anúncio cai numa faixa sem tarifa publicada: "Sem tarifa publicada para a
  faixa de preço deste anúncio — informe a comissão do canal para precificar."
- **Avisos Shopee** — "A Shopee não publica a fórmula completa desta taxa" (só CPF alto volume sem tarifa,
  corpo verbatim citando R$10/R$6,50 e R$8/R$6) e o de frete aferido, sempre presente em canal Shopee,
  hoje colapsado numa linha com o gatilho "Sobre o frete aferido".
- **Foco, hover, pressionado, desabilitado** do Switch, do ✕ e do "Adicionar canal"; e **muitos canais** —
  4 cartões empilhados (ML + Shopee + Amazon + Outro), o pior caso real de altura, nunca visto.

## Viewports

- **390px** — onde a peça nasceu e onde a grade de 2 colunas dos campos de taxa fica mais apertada; a linha
  da chave precisa do texto inteiro sem quebrar em 2 linhas ao lado do Switch.
- **1280px** — a coluna direita (~560px úteis) com 4 cartões empilhados, e a página em miniatura ao lado
  para deixar visível o desequilíbrio das colunas. **1920px** — a largura de referência do dono (018),
  mesmo caso de 4 canais.

## Regras que o desenho não pode quebrar

- **Freemium binário**: sem assinatura, zero número de canal — nem parcial, nem exemplo, nem borrado.
- **Procedência sempre dita**: número do catálogo carrega selo; ajustado à mão vira "ajustado por você";
  campo com placeholder de catálogo **não** pode parecer campo digitado.
- **Falha de rede nunca é falta de permissão** (e vice-versa): alerta info e gate Premium, peças distintas.
- **Cupom da Shopee é dinheiro da Shopee**: informação ao lado do campo, nunca desconto dentro do "Frete".
- **Frase honesta nunca em placeholder** — placeholders carregam só números.
- Alvos ≥44px, inclusive o ✕ de remover (hoje é ghost `sm`); contraste medido contra o fundo do `Card`,
  não contra o fundo da página.

## Armadilhas já pagas neste projeto

- **Overflow medido nos dois eixos**: legenda longa ou valor de quatro dígitos num cartão de coluna de
  560px já estourou a coluna (`min-width: 0` existe por isso); e texto ocluso passa em teste — layout se
  afirma com caixas, não com asserção de texto.
- **Sufixo de placeholder cortado** (016/PR-F): "2,50 (= 50" — parêntese aberto e número solto.
- **Órfão de 149,6px** (CTA longe da legenda que o motiva, por isso o gate ganhou centro) e o buraco de
  1.671px a 1440px quando o gate ficou aninhado numa coluna só.
- **Campo vazio ao lado de preço descontado**: "Comissão 0,00 %" com o preço mostrando 15% aplicados.

## Entregável

Pranchetas, tema **escuro** como padrão e **claro** como equivalente de primeira classe:
1. 390px — chave ligada, um canal (Amazon), estado de repouso.
2. 390px — chave desligada (com a sua proposta do que fica no lugar).
3. 390px — sem permissão: switch desabilitado + "Vender em marketplaces faz parte do Premium." + CTA.
4. 390px — Shopee completo: perfil CPF + 450 pedidos + subsídio + sobretaxa + dois avisos + selos.
5. 1280px — coluna direita com quatro canais + "Adicionar canal", página em miniatura ao lado.
6. 1280px — alerta info de falha de atualização e o cartão com erro de comissão ≥100% ao mesmo tempo.
7. 1920px — o mesmo caso de quatro canais, mais um detalhe ampliado da linha da chave e da linha de selos
   com foco/hover/pressionado/desabilitado.

Reutilize os primitivos, sem criar nenhum: `tf-card` (canal), `tf-switch` (chave), `tf-select`
(marketplace/modalidade/perfil), `tf-field` + `tf-input` (taxas), `tf-checkbox` (sobretaxa), `tf-alert` tom
info (falha), `tf-badge` (selos), `tf-button--secondary` ("Adicionar canal"/"Tentar novamente") e
`tf-button--ghost` (✕).

## Perguntas em aberto para o dono

1. Com a chave **desligada**, o que fica no lugar? Nada (hoje), uma frase do tipo "os preços na tela são
   de venda direta, sem marketplace", ou um resumo do último cálculo por canal?
2. Existe **limite de canais**? O código não tem nenhum, e nada impede dez cartões do mesmo marketplace —
   inclusive: repetir o mesmo canal (ML Clássico e ML Premium lado a lado) é uso pretendido?
3. Um cartão preenchido deveria poder **colapsar** (mostrando só "Shopee · 20% · R$ 4,00"), para que
   quatro canais não custem 2.500px de página?
4. Remover um canal preenchido pede confirmação, ou desfazer basta?
