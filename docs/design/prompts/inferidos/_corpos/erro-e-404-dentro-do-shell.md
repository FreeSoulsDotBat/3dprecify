# Erro global e 404 emoldurados pelo shell

## O que desenhar

As duas telas de exceção do Precifica3D — **"Algo deu errado"** (limite de erro global da árvore de rotas) e
**"Página não encontrada"** (404) — desenhadas **como elas realmente aparecem hoje**: dentro do shell, com o
menu lateral (ou a TabBar no celular), a top-bar de marca/tema/conta e as faixas de estado ainda de pé em
volta. Quem vê é o vendedor 3D no meio da jornada: clicou em algo, digitou um endereço errado, ou a tela que
usava quebrou — o momento em que o produto tem menos crédito e mais precisa parecer honesto. Além dos dois
estados normais, o desenho cobre o **pior caso já medido**: a rota de dois segmentos que carrega em branco
absoluto — nem 404, nem tela de erro, nem shell.

## Por que este prompt existe

O **conteúdo** das duas telas já foi desenhado e homologado (protótipo de 2026-07-02, §E9 + item 19 dos
`claude-design-prototype-fixes`): grafismo, título honesto, botão de volta, "Código de suporte:
{correlationId}", nunca stack trace. **O enquadramento nunca foi.** No protótipo as duas são telas do fluxo
— o 404 é descrito como tendo "link de volta ao shell", frase que só faz sentido se ele estiver **fora** do
shell — mas `errorComponent` e `notFoundComponent` estão declarados na `rootRoute`, cujo `component` é o
`AppShell`: as duas renderizam **dentro** dele. O canvas do 018 não tem prancheta nenhuma das duas. O código
contraria a leitura mais natural da autoridade de desenho, e ninguém decidiu se contrariar está certo.

## O que já existe hoje (não invente do zero — corrija)

Origem: `apps/web/src/pages/error/error-page.tsx`, `pages/not-found/not-found-page.tsx`,
`app/router.tsx`, `app/app-shell.tsx`.

**Tela de erro global** — coluna centrada, `max-width: 28rem` (448px), texto centralizado, na ordem:

| Elemento | Conteúdo literal / dado | Observação |
|---|---|---|
| Grafismo | `espada` (96×48px, cor de acento, opacidade 0,55) | decorativo, `aria-hidden` |
| Título `h1` | "Algo deu errado" | tamanho `--fs-xl` |
| Corpo | "Tente novamente. Se persistir, informe o código de suporte." | cor `--text-muted` |
| Ação | botão primário "Recarregar" | recarrega a página inteira |
| Rodapé | "Código de suporte:" + o código | `--text-faint`, `--fs-caption`, numerais tabulares |

O código de suporte é o `correlationId` real da chamada que falhou; quando a falha não veio da API, é um
fallback local `local-<uuid>`, igualmente longo. → **Problema:** 36+ caracteres com `word-break: break-all`
num campo de 448px; a 390px quebra em duas ou três linhas de letra minúscula — e é justamente o texto que o
vendedor precisa **ler em voz alta ou copiar**. Não há botão de copiar.

**Tela 404** — coluna centrada, na ordem:

| Elemento | Conteúdo literal |
|---|---|
| Grafismo | `arco` (96×48px, acento, opacidade 0,55) |
| Ícone do `EmptyState` | `triangle-alert`, 28px |
| Título `h2` | "Página não encontrada" |
| Descrição | "O endereço que você abriu não existe." |
| Ação | link com aparência de botão primário: "Voltar para Calcular" (vai para `/calcular`) |

→ **Problemas:** (1) o 404 traz **grafismo + ícone de alerta** empilhados, duas peças decorativas
concorrendo; (2) o botão diz "Voltar para Calcular", mas dentro do shell o menu já oferece "Calcular" a dois
centímetros dali — a ação principal duplica a navegação visível.

**O que sobra em volta nas duas telas** (é isto que nunca foi desenhado): a faixa de offline quando aplicável
("Você está offline. O cálculo continua funcionando."), a faixa de sessão expirada quando aplicável ("Sua
sessão expirou" / "Entre de novo para continuar de onde parou." / "Entrar de novo"), a top-bar com marca +
tema + conta, e o menu com os cinco destinos **Calcular · Catálogo · Kits · Orçamentos · Conta** — todos
**clicáveis e navegáveis**, inclusive quando o que quebrou foi a própria árvore de rotas. → **Problema:** o
menu continua se oferecendo como se funcionasse, e ninguém decidiu se ele deve.

## Conteúdo e dados reais

- Todos os textos acima são **homologados — cite-os exatos**. A única frase que marco como fraca é "Voltar
  para Calcular" **no contexto do shell** (ver Perguntas em aberto).
- Código de suporte: dois formatos reais, ambos longos — `7f3c9a12-4b8e-4c21-9d55-a2e1b0f47c38` (UUID de
  correlação do cabeçalho `X-Correlation-Id`) e `local-9f2b7c1a-0e44-4a90-8b3d-6c5e21f0aa77`. Desenhe com o
  **mais longo dos dois**, não com um `ABC-123` de mentira.
- Nada aqui mostra dinheiro, plano, preço ou número do domínio de precificação, nem fala comercial.
- O grafismo é **decorativo** e sem animação (respeita `prefers-reduced-motion`).
- Larguras do shell no desktop: barra lateral **240px** expandida, **76px** recolhida; o conteúdo é o resto.

## Estados obrigatórios

1. **404 em repouso** — grafismo `arco`, "Página não encontrada", "O endereço que você abriu não existe.",
   botão de volta.
2. **Erro global em repouso** — grafismo `espada`, "Algo deu errado", corpo, "Recarregar", "Código de
   suporte:" + código longo.
3. **Foco de teclado** no botão principal e no código de suporte (se ele virar alvo copiável) — anel visível
   contra o fundo real da tela, nos dois temas.
4. **Hover e pressionado** do botão primário ("Recarregar" / "Voltar para Calcular").
5. **Carregando após "Recarregar"** — o clique recarrega a página inteira; mostre o instante entre o clique
   e o recarregamento (botão ocupado, ou nada — mas decida).
6. **Erro + offline** — a faixa "Você está offline. O cálculo continua funcionando." em cima da tela de erro.
   O empilhamento é real e não pode virar duas mensagens que se contradizem.
7. **Erro + sessão expirada** — a faixa "Sua sessão expirou" com "Entrar de novo" sobre a tela de erro: duas
   ações concorrentes ("Entrar de novo" e "Recarregar"); mostre a hierarquia.
8. **Menu durante a falha** — as duas leituras possíveis: (a) menu íntegro e clicável como hoje; (b) menu com
   os destinos atenuados / não navegáveis enquanto a árvore está quebrada. O desenho mostra as duas para o
   dono poder escolher.
9. **Nada renderiza (tela branca)** — o caso `016/A4`: rota de dois segmentos aberta a frio, assets em
   caminho relativo dão 404 e o vendedor vê branco absoluto — sem shell, sem 404, sem tela de erro. Desenhe
   a **tela mínima de salvação** que hoje não existe: marca, uma frase honesta e um caminho de volta.

## Viewports

- **Mobile 390px** — as duas existem no celular. Shell = top-bar + TabBar inferior fixa; a coluna de 448px
  passa a caber justo, e o código de suporte quebra em várias linhas.
- **Desktop 1280px** — onde o menu vira barra lateral com rótulo e pode ser recolhido; menu **expandido**.
- **Desktop 1920px** — obrigatório: é aqui que o defeito de enquadramento fica óbvio. Uma coluna de 448px
  centrada em ~1.680px usa ~27% da largura e a tela de erro parece um recado perdido — o mesmo padrão (39%
  a 1440px) que o 016 já teve de corrigir nas outras páginas.

## Regras que o desenho não pode quebrar

- **Nunca stack trace nem código cru, nunca culpar o usuário** — o único identificador exposto é o
  "Código de suporte:".
- **Falha nunca é vendida como limite de plano** — nada de "assine", "premium" ou caminho comercial aqui.
- **Frase honesta em elemento de largura plena, nunca em placeholder** — a linha do código de suporte cabe
  inteira e legível; se virar campo, não pode ser recortada por reticências.
- **Alvos de toque ≥44px** — botão principal, item de menu, "Entrar de novo" da faixa.
- **Contraste medido contra o fundo real** de cada tema, incluindo a linha `--text-faint` do código de
  suporte — a mais fraca das duas telas e a que mais precisa ser lida.
- **O menu não pode mentir**: destino que não vai funcionar não pode parecer normal.
- **Zero transbordo horizontal a 390px**, com o código de suporte longo presente.

## Armadilhas já pagas neste projeto

- **Transbordo medido, não estimado** — o 016 achou 100,5px de transbordo com um botão nascido fora da
  viewport; o código de suporte com 36+ caracteres e `break-all` é exatamente esse tipo de string.
- **Coluna estreita em campo largo** — 448px sobrevivendo até 1920px já foi defeito de homologação em cinco
  páginas deste app. Não repita só porque a tela é "menor".
- **Texto que passa em teste e não aparece na tela** — asserção de texto é cega para oclusão e recorte; o
  desenho mostra o código de suporte no pior caso (mais longo × tela mais estreita).
- **O caso em que nada renderiza é o mais caro e o único sem desenho** — existe hoje, registrado como
  follow-up, e é a razão de esta peça não ser de prioridade baixa.

## Entregável

Pranchetas, tema **escuro como padrão** e **claro como first-class** (as duas telas nos dois temas):

1. `404 · mobile 390px` — dentro do shell, com TabBar.
2. `404 · desktop 1280px` — menu lateral expandido.
3. `Erro global · mobile 390px` — com o código de suporte longo, quebrando de verdade.
4. `Erro global · desktop 1280px`.
5. `Erro global · desktop 1920px` — a prancheta que resolve a coluna estreita no campo largo.
6. `Erro + offline` e `Erro + sessão expirada` — o empilhamento de faixas e a hierarquia entre as ações.
7. `Menu durante a falha` — duas variantes lado a lado (íntegro × atenuado).
8. `Tela branca / app não subiu` — a tela mínima de salvação, mobile e desktop.

Reutilize os primitivos existentes, não crie novos: `Grafismo` (`espada` no erro, `arco` no 404) ·
`EmptyState` (ícone + título + descrição + ação) no 404 · botão primário `tf-btn tf-btn--primary` em
"Recarregar" e "Voltar para Calcular" · a faixa de status já usada por offline/sessão · barra lateral,
TabBar e top-bar do shell como já desenhadas no 018. Se o código de suporte ganhar copiar, use o
botão-ícone do DS.

## Perguntas em aberto para o dono

1. **O erro e o 404 ficam DENTRO ou FORA do shell?** A decisão central. Dentro: o vendedor continua orientado
   e troca de aba num clique — mas o app parece funcionar enquanto está quebrado. Fora (como o protótipo
   sugeria com o "link de volta ao shell"): a falha fica evidente, ao preço de ele ficar sem menu.
2. **Se ficarem dentro: o menu continua clicável quando a árvore de rotas falhou?** Hoje continua — e se o
   destino também estiver quebrado, o clique leva a outra tela de erro.
3. **"Voltar para Calcular" continua sendo a ação do 404 com "Calcular" já no menu ao lado?** Se sim, é
   redundante; se não, qual passa a ser a ação principal.
4. **O código de suporte ganha botão de copiar?** É longo e existe para ser transmitido a um humano, mas
   copiar é função nova, não desenhada.
5. **A tela branca de dois segmentos (`016/A4`) entra neste desenho ou vira peça própria?**
