# A linha do plano quando o Premium é CORTESIA (grant de operador / programa beta)

## O que desenhar
O estado **cortesia** da linha "Plano", no cartão do topo da tela **Conta** — a mesma linha que para um
assinante diz "Premium · Plano mensal · renova em 01/09/2026". Aqui não há assinatura nenhuma: o Premium
veio de um **grant concedido por um operador** (beta tester, cortesia comercial, parceiro), tem uma **data
de vencimento** e, quando ela chegar, a conta cai para "Premium pausado" — leitura apenas. Quem vê isso é
o vendedor beta, no momento em que abre a Conta para entender "o que eu tenho e até quando". A linha vive
entre o cartão de identidade (avatar + e-mail) e o cartão de Tema; no desktop ela é a primeira peça da
coluna mais larga da grade de três colunas.

## Por que este prompt existe
Este estado nunca foi desenhado. O protótipo de 2026-07-02 trata Premium como um booleano de demonstração
guardado no `localStorage` e escreve a legenda como `isPremium ? "renova em 01/09/2026" : …` — só o caso
assinatura; as palavras "cortesia", "beta" e "expira" **não aparecem em lugar nenhum do artboard**. A
própria revisão do protótipo manda anotar que "o status Premium vem do servidor — o localStorage do
protótipo é apenas simulação", ou seja: a autoridade de desenho declara que a **procedência** do Premium
está fora do que ela desenhou. A distinção de fonte do grant existe como requisito (FR-304 da 007) e como
redação (`ux-billing.md`), e requisito não é desenho. Resultado: a interface de hoje foi montada por
inferência.

## O que já existe hoje (não invente do zero — corrija)
Origem: `apps/web/src/features/billing/plan-panel.tsx`, `plan-view.ts`, `pages/conta/conta-page.tsx`.

| Elemento | Conteúdo real hoje | Observação |
|---|---|---|
| Rótulo da linha | "Plano" | caption, cinza, acima de tudo |
| Selo | "Premium", tom `success` (verde) | → **idêntico, pixel a pixel, ao selo de quem paga** |
| Legenda (mesma linha do selo) | "cortesia · expira em 30/09/2026" ou "via programa beta · expira em 30/09/2026" | `--fs-caption`, `--text-muted` |
| Segunda linha (nota) | *nenhuma* | os outros estados têm; este não |
| Ações | *nenhuma* — só o botão fantasma "Recarregar" que a página desenha ao lado | → **zero caminho para assinar** |
| Offline | a legenda vira "cortesia · expira em 30/09/2026 · última informação do servidor" | três segmentos numa linha só |

→ **Problema 1 — a data mente pela posição.** No estado assinante a mesma posição, o mesmo tamanho e o
mesmo cinza carregam "renova em 01/09/2026": uma promessa de continuidade. Aqui a mesma vaga visual diz
"expira em 30/09/2026": o oposto exato. Nada na forma distingue as duas.

→ **Problema 2 — o selo é o mesmo do assinante.** Verde "Premium", sem qualquer marca de que este acesso
é temporário e emprestado.

→ **Problema 3 — não há conversão.** Um beta tester vai perder o Premium numa data conhecida e a tela não
lhe oferece nenhum caminho para assinar antes disso. Os estados "Gratuito", "Premium pausado" e
"assinatura cancelada" todos ganham botão ("Assinar Premium" / "Assinar novamente"); o desktop chega a
abrir a oferta inline abaixo da linha. Cortesia é o único Premium não-assinante e é o único sem oferta.

→ **Problema 4 — legenda acumulativa.** Offline, a legenda encosta três frases numa linha ao lado de um
selo, à direita do qual ainda ficam os botões.

## Conteúdo e dados reais
- **Selo**: "Premium" (literal, do dicionário). Alternativa a decidir com o dono — ver perguntas.
- **Fonte do grant**: dois rótulos existem, e só dois — `beta` → "via programa beta", `comp` → "cortesia".
  Qualquer outro valor do servidor cai silenciosamente em "cortesia". **O nome de quem concedeu nunca é
  mostrado** (FR-304).
- **Prefixo da data**: "expira em" (literal). Formato pt-BR curto: `30/09/2026`. A data é **opcional** —
  quando o grant não traz vencimento, a legenda é só "cortesia", sem data.
- **Selo de offline**: "última informação do servidor".
- **Preços, caso a peça ganhe uma oferta**: "R$ 15,99/mês", "R$ 155,88/ano", "equivalente a R$ 12,99/mês",
  "~19% de economia frente ao mensal", botão "Assinar Premium". O espaço entre `R$` e o número é
  inquebrável — nunca desenhe uma linha de preço que possa quebrar entre símbolo e valor.
- **O que vem depois do vencimento** (já existe como outro estado, e é a verdade a ser sugerida aqui):
  "Premium pausado" + "Seus itens salvos continuam disponíveis para leitura."

## Estados obrigatórios
1. **Repouso — cortesia com data**: selo + "cortesia · expira em 30/09/2026".
2. **Repouso — programa beta**: idem, com "via programa beta".
3. **Sem data de vencimento**: legenda só com a fonte ("cortesia"), sem prefixo órfão.
4. **Vencimento próximo** (não existe no código; desenhe a proposta): a mesma linha quando faltam poucos
   dias. Hoje o dia 29 e o dia 1 são visualmente idênticos.
5. **Offline / dado guardado**: legenda + "última informação do servidor" — a procedência dita, nunca
   escondida.
6. **Carregando**: o botão "Recarregar" em estado de espera; o selo NÃO pode piscar para "Gratuito".
7. **Foco de teclado** em cada controle interativo da linha (anel visível sobre o fundo real do cartão).
8. **Hover e pressionado** dos botões.
9. **Vizinhos, para comparação lado a lado na mesma prancheta** — é o ponto do desenho: assinante ativo
   ("Premium · Plano mensal · renova em 01/09/2026", ações "Gerenciar assinatura" + "Cancelar assinatura")
   e "Premium pausado" ("Seus itens salvos continuam disponíveis para leitura.", ação "Assinar novamente").

## Viewports
- **Mobile 390px** — é onde a linha quebra: selo + legenda longa + botões no mesmo cartão.
- **Mobile 360px** — o pior caso já medido nesta tela; use a legenda mais longa possível
  ("via programa beta · expira em 30/09/2026 · última informação do servidor").
- **Desktop 1280px** — o corte da grade de três colunas; a linha do plano abre a coluna mais larga, e é
  ali que uma oferta inline apareceria, se o dono decidir que ela existe.

## Regras que o desenho não pode quebrar
- **A data é fato do servidor, não decoração.** Ela pode e deve aparecer; o que não pode é aparecer com a
  mesma roupa de uma data de renovação, porque significa o contrário.
- **Nunca degradar o selo enquanto o Premium está ATIVO.** Durante a cortesia o vendedor tem tudo — pintar
  o selo de alerta seria a mentira na direção oposta (foi essa a decisão tomada para a carência: o selo
  segue verde, quem carrega a cautela é o texto).
- **Freemium binário**: não existe meio-premium. A cortesia é Premium inteiro até a data.
- **Falha de rede nunca vendida como "não é premium"**: se o servidor não respondeu, o texto é "Não foi
  possível confirmar seu plano.", jamais "Gratuito".
- **Procedência dita**: quando o dado é o último conhecido, a tela diz que é o último conhecido.
- **Frase honesta em elemento de largura inteira**, nunca espremida ao lado de um selo se isso a corta.
- **Alvo ≥44px** em todo botão da linha; **contraste medido contra o fundo real do cartão**, nos dois temas.
- **Sem padrão escuro na conversão**: se houver oferta, ela não pode usar medo, contagem regressiva
  agressiva nem culpa. O prazo é dito, não brandido.

## Armadilhas já pagas neste projeto
- **Transbordo horizontal medido nesta linha exata**: a 390px o conteúdo mediu 453,5px contra 316px de
  cartão, a página foi a 491px de `scrollWidth` (100,5px de transbordo) e um botão **nasceu inteiramente
  fora da viewport** (x = 396,3). As ações são UM item flex — um item mais largo que o container não
  quebra sozinho. Desenhe explicitamente como o bloco de ações quebra.
- **Texto ocluso passa em teste**: uma asserção de texto não vê um elemento coberto ou fora da caixa.
  Layout aqui se prova com caixas, não com strings.
- **Frase honesta cortada dentro de um campo**: honestidade mora em elemento de largura inteira.
- **Quebra de linha entre `R$` e o número**: só a imagem denuncia; nenhuma medição vê.
- **Rótulo com causa falsa**: "expirado" foi banido desta tela porque afirmava uma causa que o servidor
  não manda; "pausado" ficou. Não reintroduza vocabulário que afirme causa.

## Entregável
Pranchetas, **tema escuro primeiro e tema claro como igual**:
1. **Cortesia · 390px** — os estados 1 a 5 empilhados, cada um rotulado.
2. **Comparação · 390px** — cortesia ao lado de assinante ativo e de Premium pausado, para que a diferença
   entre "renova" e "expira" seja visível na forma e não só na palavra.
3. **Cortesia · 1280px** — a linha na coluna do plano, com e sem oferta inline abaixo (as duas hipóteses).
4. **Detalhes** — foco, hover, pressionado e carregando dos controles da linha.

Reutilize os primitivos existentes, sem criar novos: `tf-card` para a linha, `tf-badge` (tom `success`)
para o selo, o estilo de legenda em `--fs-caption` / `--text-muted` para fonte + data, `tf-button` nos
tamanhos `sm` para "Recarregar" (fantasma) e para qualquer ação nova, `tf-alert` **apenas** se o dono
decidir que o vencimento próximo merece um aviso — e, se a oferta inline entrar, o mesmo bloco de planos
já usado em "Assinar o Premium". Se você precisar de um elemento novo para separar "expira" de "renova",
proponha-o como **variação de um primitivo existente**, e diga qual.

## Perguntas em aberto para o dono
1. **O selo da cortesia deve ser o mesmo "Premium" verde do assinante?** Ou uma variação que diga, no
   próprio selo, que este acesso é temporário — sem sugerir que ele vale menos?
2. **A linha de cortesia deve oferecer assinar?** Se sim: sempre, ou só a partir de N dias do vencimento —
   e qual N? E no desktop ela abre a oferta inline, como fazem "Gratuito" e "pausado"?
3. **Existe um estado "vencimento próximo"?** A partir de quantos dias, e ele muda tom, ganha nota ou só
   ganha o botão?
4. **Deve haver uma segunda linha dizendo o que acontece no dia seguinte** ("Depois disso, seus itens
   continuam disponíveis para leitura")? Hoje essa frase só aparece DEPOIS de o Premium pausar.
5. **Quando a fonte do grant não é `beta` nem `comp`**, o texto cai em "cortesia". Serve, ou deve existir
   um rótulo neutro para fontes que ainda não têm nome?
