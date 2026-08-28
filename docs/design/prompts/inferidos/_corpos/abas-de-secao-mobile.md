# Abas de seção do Catálogo no mobile (Filamentos · Impressoras · Produtos · Kits)

## O que desenhar
A bandeja segmentada que fica no topo da tela **Catálogo** e troca a seção exibida logo abaixo:
Filamentos, Impressoras, Produtos e Kits. É o único jeito de o vendedor sair de uma seção para
outra dentro do Catálogo — não há menu, link ou gesto alternativo. Ela aparece imediatamente
abaixo do título "Catálogo" e imediatamente acima do painel da seção ativa (contador + botão de
adicionar + lista). Quem usa é o vendedor no celular, quase sempre logo depois de abrir o app
para conferir ou cadastrar um insumo. O foco deste prompt é o **mobile estreito**, onde as quatro
pílulas não cabem numa linha e a solução atual esconde a quarta sem avisar.

## Por que este prompt existe
Autoridade `PROTOTIPO_PARCIAL`: o protótipo de origem (§E5) pedia **duas** pílulas
("Filamentos|Impressoras"); o `CatalogScreen.jsx` do protótipo instanciava **três**
(filamento/impressora/produto). **Kits é a quarta pílula e não aparece em nenhuma das quatro
autoridades** — entrou por decisão de implementação. E o comportamento em tela estreita também
foi decidido no CSS, não no desenho: a bandeja declara rolagem horizontal com a **barra de
rolagem deliberadamente escondida** e os rótulos com quebra proibida. Ou seja: quando não cabe,
rola — e nada na tela diz que existe mais coisa à direita. O que nunca foi desenhado é essa
escolha e o seu indício de transbordo. O único ponto que a auditoria já cobria (alvo de toque de
44px) o código honra.

## O que já existe hoje (não invente do zero — corrija)
Origem: `apps/web/src/pages/catalogo/catalogo-page.tsx`, `catalogo-page.css`,
`apps/web/src/shared/ui/segmented.tsx` + `segmented.css`.

| Item | Valor real hoje |
| --- | --- |
| Rótulos, nesta ordem | "Filamentos" · "Impressoras" · "Produtos" · "Kits" |
| Nome do grupo (leitor de tela) | "Seções do catálogo" |
| Seção inicial | Filamentos (ou a que vier na URL: `?tab=products`, `?tab=kits`…) |
| Ícones | **nenhum** nas pílulas do Catálogo (o componente aceita ícone, mas aqui não usa) |
| Contadores | **nenhum** na pílula; a contagem vive abaixo, no painel ("12 filamento(s)") |
| Tamanho | pequeno: rótulo de 12px, peso 600, padding 8px/12px, altura mínima 44px |
| Bandeja | fundo `--bg-muted`, canto pílula (999px), padding 4px, gap 4px entre pílulas |
| Pílula selecionada | fundo `--surface-raised` + sombra sutil + texto `--accent-text` |
| Foco de teclado | contorno de 2px em `--accent`, afastado 2px |
| Teclado | um único ponto de tabulação; setas percorrem e trocam a seção; Home/End vão às pontas |
| Transbordo | rola na horizontal, **sem barra visível**, sem sombra/gradiente/seta de borda |
| Quebra de linha | a **faixa** título+bandeja quebra (título em cima, bandeja embaixo); as **pílulas** nunca quebram entre si |

Espaço disponível: a coluna de conteúdo tem 16px de recuo de cada lado, então sobram **358px a
390px** e **328px a 360px** de viewport. A soma estimada das quatro pílulas (≈ 90 + 96 + 77 + 50,
mais gaps e padding) fica **na casa de 330px** — cabe raspando a 390px e **estoura a 360px**.
Estimativa a medir no desenho, não número fechado.

→ **Problema 1**: a 360px a pílula "Kits" fica além da borda de um contêiner cuja barra de rolagem
foi escondida. Não existe seta, sombra, gradiente, recorte de meia-pílula nem marcador de posição:
o vendedor não tem como saber que a seção existe.
→ **Problema 2**: a pílula selecionada pode nascer fora da vista quando a tela abre por link direto
(`?tab=kits`) — hoje nada garante que a seção ativa esteja visível ao entrar.
→ **Problema 3**: não há estado **pressionado**. O único retorno é a transição de cor em 0,15s.
→ **Problema 4**: a diferença entre ativa e inativa é fundo + sombra + cor do texto; o peso da
fonte é 600 em todas. No tema escuro isso já falhou com contraste 1,00:1 (bandeja e pílula eram o
mesmo #14151a) — corrigido em 2026-08-15, mas o desenho precisa deixar o relevo explícito nos dois
temas.

## Conteúdo e dados reais
- Os quatro rótulos são copy homologada e **não devem ser reescritos nem abreviados** sem decisão do
  dono: "Filamentos", "Impressoras", "Produtos", "Kits". "Kits" é a mais curta (4 caracteres) e
  "Impressoras" a mais longa (11) — a assimetria de largura é real e o desenho tem de conviver com ela.
- Nada de número dentro da pílula hoje. O que o painel mostra logo abaixo, por seção:
  "{n} filamento(s)", "{n} impressora(s)", "{n} produto(s)", "{n} kit(s)" — ex.: "12 filamento(s)".
- Botão de ação do painel, à direita do contador: "Adicionar filamento" / "Adicionar impressora" /
  "Adicionar produto" / "Montar kit".
- Acima da bandeja: o título "Catálogo". No rodapé do app: a barra fixa de 64px com Calcular ·
  Catálogo · Kits · Orçamentos · Conta.

## Estados obrigatórios
- **Repouso (não selecionada)**: texto em `--text-muted`, fundo transparente sobre a bandeja.
- **Selecionada**: relevo (fundo + sombra) + texto de destaque; legível **sem depender da cor**,
  no escuro e no claro.
- **Hover**: só existe com mouse; no mobile não conte com ele para nada.
- **Pressionado**: hoje inexistente → desenhe.
- **Foco de teclado**: contorno visível **por cima** da pílula selecionada (não pode sumir justo no
  item já destacado).
- **Transbordo à direita / à esquerda**: o estado que falta. Precisa de um indício de que há mais
  seções fora da vista, e de um jeito de a seção ativa estar sempre visível ao entrar na tela.
- **Carregando o painel**: a bandeja **continua inteira e clicável**; quem carrega é o painel
  (indicador centralizado abaixo). A bandeja nunca vira esqueleto.
- **Erro de carga**: bandeja intacta; abaixo, alerta de perigo "Não foi possível carregar seu
  catálogo." com o botão "Tentar novamente".
- **Offline (leitura)**: bandeja intacta; acima do painel, alerta de **tom informativo** (nunca
  perigo) "Modo leitura offline" / "Seus itens salvos continuam aqui para usar no cálculo. Criar e
  editar precisam de conexão."
- **Premium pausado**: bandeja intacta e as quatro seções navegáveis; alerta informativo
  "Premium pausado" / "Seus itens continuam aqui e podem ser usados no cálculo. Para criar ou
  editar, reative o Premium." As linhas da lista ganham a legenda "somente leitura".
- **Sem permissão (grátis ou deslogado)**: **a bandeja não existe** — a tela inteira vira o teaser
  único de Premium. Desenhe essa ausência para deixar claro que não há uma versão "abas mortas".
- **Vazio**: não se aplica à bandeja — são sempre quatro pílulas fixas. O vazio é do painel
  ("Nenhum filamento salvo ainda" etc.).
- **Desabilitado**: não existe hoje e não deve ser inventado.

## Viewports
- **Mobile 360px** — o caso que motiva o prompt: é onde "Kits" cai fora da vista. Obrigatório.
- **Mobile 390px** — a largura padrão de homologação do projeto; mostrar o limite raspando.
- **Desktop 1280px (referência, 1 prancheta)** — no desktop as quatro pílulas ficam **na mesma linha
  do título, à direita**, já desenhado no canvas do 018 a 1920px. Entra só para provar que a solução
  do transbordo no mobile **não muda** o que já está homologado no desktop. Não redesenhe o desktop.

## Regras que o desenho não pode quebrar
- **Nenhuma seção pode ser invisível.** Uma seção que existe e não se anuncia é a mesma classe de
  desonestidade que esconder uma degradação: se as quatro cabem, mostre as quatro; se não cabem,
  mostre que há mais.
- **Alvo de toque ≥ 44px de altura**, inclusive no tamanho pequeno — regra já paga e honrada; não a
  perca ao encolher pílulas para fazer caber.
- **Zero rolagem horizontal da PÁGINA.** Rolagem dentro de um contêiner que se declara rolável é
  aceitável; a página empurrada para o lado é defeito duro.
- **Contraste medido contra o fundo real** (a bandeja `--bg-muted`, não o fundo da página), nos dois
  temas: indicador de estado ≥ 3:1, e a seleção nunca sinalizada só por matiz.
- **Freemium binário**: ou o Catálogo inteiro está disponível, ou é o teaser. Nada de aba com cadeado.
- **Falha de rede nunca vendida como falta de Premium** — offline usa tom informativo, não o teaser.
- **Frase honesta nunca dentro de placeholder** nem cortada: as frases de offline/pausado vivem em
  elementos de largura cheia.

## Armadilhas já pagas neste projeto
- **Teste headless não enxerga barra de rolagem clássica** — um transbordo real passou despercebido
  porque só se mediu um eixo. Aqui a barra está escondida de propósito: nenhum sinal automático vai
  denunciar o corte. O indício tem de ser desenhado.
- **`toBeVisible` passa em elemento fora da vista ou ocluso.** A pílula "Kits" cortada é exatamente
  esse caso: existe no DOM, responde a teste, e o vendedor não vê.
- **Contraste medido contra o fundo errado** — o mesmo componente, dentro de um cartão, já ficou com
  cartão, bandeja e pílula na mesma cor.
- **Rótulo longo estourando a coluna** — "Impressoras" é o pior caso; qualquer solução que dependa de
  truncar precisa mostrar como fica o texto cortado, não fingir que não acontece.

## Entregável
Pranchetas, **tema escuro como padrão e tema claro como cidadão de primeira classe** (as duas
versões de cada uma):
1. 360px — as quatro pílulas com "Filamentos" ativa e o indício de transbordo à direita.
2. 360px — "Kits" ativa, chegando por link direto: como a bandeja mostra que a seleção está no fim.
3. 390px — repouso, com o painel abaixo (contador "12 filamento(s)" + "Adicionar filamento").
4. 390px — foco de teclado sobre a pílula selecionada, e estado pressionado.
5. 390px — offline: bandeja + alerta informativo "Modo leitura offline".
6. 390px — Premium pausado: bandeja + alerta "Premium pausado".
7. 1280px — referência: título "Catálogo" e as pílulas na mesma linha, à direita (não redesenhar).

Reutilize os primitivos existentes: a bandeja e as pílulas são `tf-segmented` /
`tf-segmented__item` / `tf-segmented__item--selected` no tamanho pequeno; o título é
`tf-page-header` + `tf-title`; os avisos são o alerta do DS nos tons `info` e `danger`; o botão de
adicionar e o "Tentar novamente" são o botão do DS (secundário, pequeno); ícones vêm do conjunto do
DS. Se a solução do transbordo exigir um elemento novo (seta, gradiente de borda, marcador de
posição), descreva-o como **variação de `tf-segmented`**, não como primitivo novo.

## Perguntas em aberto para o dono
1. **"Kits" deve mesmo ser a quarta seção do Catálogo?** Existe uma seção "Kits" na barra inferior
   (`/kits`) *e* uma pílula "Kits" aqui. Nenhuma autoridade de desenho previu a quarta pílula, e é a
   duplicidade que cria o aperto de largura. Manter as quatro, ou o Catálogo volta a ter três?
2. Se as quatro ficam: quando não couberem, o que é preferível — **rolar com indício visível**,
   **encolher os rótulos** ou **quebrar em duas linhas**? Isso muda a solução inteira e é decisão de
   produto, não só de estética.
3. As pílulas devem carregar **contagem** (ex.: "Filamentos 12")? Hoje o número só existe abaixo, e
   colocá-lo na pílula agrava a largura.
4. A **ordem** atual (Filamentos → Impressoras → Produtos → Kits) é intencional por frequência de
   uso, ou pode mudar para pôr a mais usada primeiro?
