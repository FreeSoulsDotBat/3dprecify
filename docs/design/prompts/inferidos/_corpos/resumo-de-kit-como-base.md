# Resumo do kit como base do cálculo (Calcular, somente leitura)

## O que desenhar
O bloco que aparece na aba **Calcular** quando o vendedor reabre uma **simulação salva cuja base é um KIT** (um produto multi-peça). Um kit não tem forma escalar para hidratar o formulário da calculadora — são N peças — então, em vez de preencher os campos, a tela mostra **um resumo próprio, somente leitura, com o preço por canal do kit inteiro, recalculado com os preços de hoje**. Ele vive logo abaixo da barra de contexto da simulação carregada e **acima do formulário da calculadora**, que continua na tela inteiro, visível e editável, mas **não alimenta nada** do que está sendo mostrado. Quem usa: vendedor Premium que já montou um kit na aba Kits, salvou uma simulação a partir dele, e agora reabre para conferir o preço de hoje ou registrar um orçamento. Origem no código: `apps/web/src/features/calculator/kit-basis-summary.tsx` e `apps/web/src/pages/calcular/calcular-page.tsx`.

## Por que este prompt existe
Autoridade de desenho: **NENHUMA**. Kits (E3) e simulações com base kit (E5) são posteriores ao protótipo de 2026-07-02 — não existe uma linha sobre kit dentro da Calcular em nenhum artefato de desenho. Tudo aqui foi decidido em código: o cartão, a hierarquia tipográfica, o alerta reaproveitado de outro contexto e o botão de gravar próprio. O canvas 018 desenhou o **mesmo conteúdo** no outro lugar (a aba Kits): lá o preço do kit é `tf-price--accent` com **2,25rem** para o Varejo e 1,5rem muted para o Atacado, sob o título "Total do kit", mais um cartão "Preços por canal (kit)" com uma linha por canal. Aqui, na Calcular, os dois níveis de preço saíram em **12px cinza**, como se fossem legenda. O canvas 018 declara Calcular fora do seu escopo por escrito — logo, esta peça nunca foi desenhada por ninguém.

## O que já existe hoje (não invente do zero — corrija)
Ordem atual na página Calcular, de cima para baixo:

1. Título "Calcular" (centralizado) e a frase de promessa freemium.
2. Botão fantasma "Meus cenários", alinhado à direita.
3. **Barra de contexto da simulação**: "Simulação: {nome}", legenda "Recalculado com os preços de hoje" (nunca uma data), ações "Abrir origem", "Renomear", "Duplicar", "Salvar alterações", "Fechar simulação" e a etiqueta "Alterações não salvas".
4. (Condicional) alerta informativo de campo aposentado: "O documento salvo continha Desperdício (g). O modelo de preço atual não usa mais esse campo — o recálculo abaixo não o inclui."
5. **← ESTA PEÇA** — hoje um `Card padding="sm"` com:
   - título 14px semibold: `"Kit: {nome}"` → ex. **"Kit: Kit suporte + base"**;
   - legenda 12px muted: `"Preços por canal do kit, recalculados com os preços de hoje."`;
   - (condicional) `Alert tone="info"`: `"Corrija os campos deste canal para ver os preços. (2)"` → **problema: essa frase é emprestada de outro contexto.** Aqui o número não conta canais, conta **linhas do kit excluídas do rollup**, e não existe "campo deste canal" nesta tela para corrigir — ela é somente leitura;
   - por marketplace: nome 14px medium ("Mercado Livre" / "Shopee" / "Amazon" / "Outro", ou **"—"** quando o canal não tem marketplace declarado) e, abaixo, **duas linhas de 12px cinza**: `"Varejo: R$ 24,24"` e `"Atacado: R$ 16,16"` → **problema central: o preço final do kit, que é o resultado da tela inteira, está tipografado como legenda.**
   - quando nenhuma linha do kit é precificável, o bloco inteiro vira um `Alert tone="info"` com `"Confira os campos destacados para ver o preço."` → **problema: não há campo destacado nenhum nesta tela.**
6. Botão **"Salvar em Orçamentos"** próprio deste modo (congela exatamente os números deste resumo). O botão normal de salvar da calculadora é **suprimido** enquanto um kit está carregado — de propósito, para não existir uma segunda oferta que congelaria os campos intocados.
7. **O formulário completo da calculadora**, visível e editável, com os valores que já estavam ali antes da reabertura → **problema: é a maior chance de leitura errada do produto inteiro.** A tela mostra um resultado que não vem dos campos que ela exibe, e nada no desenho diz isso.

## Conteúdo e dados reais
| Dado | Origem | Formato / faixa | Exemplo real |
|---|---|---|---|
| Nome do kit | referência do catálogo (ou o nome da simulação, se a referência não resolve) | texto livre, pode ser longo | "Kit suporte + base para monitor" |
| Canais | conjunto único de canais da simulação, aplicado igual a todas as peças | 1..4 canais | Mercado Livre, Shopee |
| Preço de anúncio varejo (por canal) | recalculado agora, do catálogo de hoje | `R$ 1.234,56`, pode ser nulo | R$ 24,24 |
| Preço de anúncio atacado (por canal) | idem, pode ser nulo | `R$ 1.234,56` | R$ 16,16 |
| Linhas excluídas | contagem de peças do kit que não puderam ser precificadas | inteiro ≥ 1 quando aparece | 2 |
| Campo aposentado descartado | documento salvo antes da versão atual do modelo | nome em pt-BR, nunca a chave técnica | "Desperdício (g)" |

Não existe aqui: data, custo unitário por peça, lista de peças, campo editável. Tudo é derivado; nada é entrada. Um canal pode trazer **só varejo**, **só atacado** ou **os dois** — o desenho precisa aguentar as três formas sem buraco visual.

## Estados obrigatórios
- **Repouso, completo** — dois ou mais canais, cada um com varejo e atacado.
- **Um canal só** — não pode parecer um cartão quebrado nem sobrar área vazia.
- **Canal parcial** — só varejo ou só atacado presente.
- **Canal sem marketplace declarado** — o rótulo é literalmente **"—"**; mostre como o desenho evita que isso leia como erro.
- **Com peças excluídas** — alerta informativo com a contagem; diga quantas e o que fazer (a ação real é "Abrir origem", na barra acima).
- **Nada precificável** — o resumo inteiro é substituído por um aviso informativo. Precisa dizer a verdade: o kit não pôde ser precificado, e o conserto é no kit, não aqui.
- **Campo aposentado descartado** — alerta informativo persistente (não um toast) acima do resumo, com a frase inteira citada acima.
- **Offline** — a simulação continua abrindo e recalculando; escrever não. Frase existente: "Suas simulações continuam aqui e podem ser abertas. Salvar, renomear, duplicar ou excluir precisam de conexão."
- **Premium pausado** — "Suas simulações continuam aqui e podem ser abertas e recalculadas. Para salvar, renomear, duplicar ou excluir, reative o Premium." O preço continua sendo mostrado; a etiqueta de estado não degrada o número.
- **Sem entitlement ativo** — o botão "Salvar em Orçamentos" simplesmente **não existe** (ausência, nunca botão morto).
- **Nome muito longo** — título "Kit: …" com um nome de 60+ caracteres.
- Estados de interação: hover/foco/pressionado só nos elementos clicáveis (o botão e, se você propuser, um atalho para a origem). **O corpo do resumo não é clicável — desenhe-o de modo que não pareça.**

## Viewports
- **Mobile 390px** — obrigatório: é onde a Calcular é mais usada e onde o resumo compete por altura com o formulário inteiro logo abaixo.
- **Desktop 1280px** — obrigatório, porque a peça existe no desktop hoje sem nenhum desenho (o canvas 018 tratou Catálogo/Kits/Orçamentos/Conta e deixou Calcular de fora, por escrito). Desenhe pelo menos o repouso completo e o estado "nada precificável".

## Regras que o desenho não pode quebrar
- **Procedência do número acima de tudo**: o desenho tem que deixar impossível confundir o preço do kit com o resultado dos campos abaixo. Essa é a razão de a peça existir.
- **Nunca uma data** nesta superfície. A promessa é "recalculado com os preços de hoje", dita em texto, não em carimbo temporal.
- **Degradação dita, não escondida**: peça excluída e campo descartado aparecem como informação persistente, nunca somem sozinhos.
- **Falha de rede nunca vira "não é Premium"** — offline e Premium pausado têm frases distintas e ambas já existem.
- **Freemium binário**: ou o botão de salvar está lá inteiro, ou não está. Nada de botão desabilitado insinuando compra.
- Frase honesta sempre em elemento de largura cheia, nunca dentro de placeholder ou sufixo cortável.
- Alvo de toque ≥44px no botão; contraste medido contra o fundo real do cartão, nos dois temas.

## Armadilhas já pagas neste projeto
- **Preço grande estoura a coluna**: `R$ 1.234,56` com quatro canais empilhados já quebrou layout em outras telas; teste o desenho com valores de quatro dígitos e nome de kit longo.
- **Overflow horizontal medido, não olhado**: nada pode ultrapassar 390px de largura; o eixo vertical também conta (barra de rolagem clássica não aparece em captura headless).
- **Texto ocluso passa em teste**: o alerta informativo empilhado sobre o resumo já é uma pilha de três avisos possíveis — mostre a pior combinação (descartado + excluídas + canal parcial) em uma prancheta.
- **Copy emprestada de outro contexto** ("Corrija os campos deste canal…" numa tela sem campos) é exatamente a classe de defeito que só aparece quando alguém desenha a peça olhando para ela.

## Entregável
Pranchetas, tema escuro primeiro e tema claro como cidadão de primeira classe:
1. Mobile 390px — repouso completo, dois canais, varejo + atacado.
2. Mobile 390px — pior caso: alerta de campo descartado + alerta de peças excluídas + um canal parcial + nome longo.
3. Mobile 390px — "nada precificável".
4. Desktop 1280px — repouso completo, e como o resumo se relaciona visualmente com o formulário morto abaixo.
5. Um recorte comparativo: a hierarquia de preço do canvas 018 ("Total do kit", Varejo `tf-price--accent`) ao lado da proposta desta peça, para o dono decidir.

Reutilize os primitivos existentes, sem criar novos: `tf-card` (`--pad-sm`) para o contêiner; `tf-price` / `tf-price--accent` para o preço, se a resposta for elevar a hierarquia; `tf-brow` (rótulo + subrótulo + valor à direita) para cada linha de canal, que é exatamente a forma que o canvas 018 já usa em "Preços por canal (kit)"; `tf-badge` para estado ("Ao vivo" / "Premium pausado"); o alerta informativo do DS para as degradações; `tf-btn--primary` para "Salvar em Orçamentos"; `tf-field__hint` para a legenda.

## Perguntas em aberto para o dono
1. **Qual é "o número" desta tela?** No composer de Kits o Varejo é 2,25rem accent porque há um preço só. Aqui há um preço por canal. O resumo deve eleger um canal principal, elevar todos igualmente, ou manter os dois níveis pequenos como hoje?
2. **O que acontece com o formulário editável abaixo** enquanto um kit está carregado: continua como está (visível, editável, inerte), fica recolhido, fica visivelmente desativado, ou some? É o que decide o desenho inteiro da peça.
3. **Que frase substitui "Corrija os campos deste canal para ver os preços."** para peças do kit excluídas, já que aqui não há campo para corrigir e a ação real está em "Abrir origem"?
4. **Calcular entra no tratamento desktop do 018?** O canvas a deixou de fora por escrito; se ela ganhar coluna direita fixa, este resumo é o candidato natural a morar nela.
