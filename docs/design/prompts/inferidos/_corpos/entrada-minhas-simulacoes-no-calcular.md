# A porta "Minhas simulações" no topo do Calcular

## O que desenhar

A entrada única para todo o recurso de Simulações (a metade "recalcula com os preços de hoje" do
Premium), que hoje vive como um botão fantasma pequeno no topo da tela **Calcular preço** — a tela que
o vendedor abre primeiro e onde ele passa quase todo o tempo. Ela precisa ser desenhada para três
públicos que hoje veem exatamente o mesmo pixel: quem nunca salvou nada (grátis ou deslogado), quem tem
simulações salvas e quer voltar a uma, e quem está com o **Premium pausado** e ainda pode abrir e
recalcular, mas não pode salvar. O escopo deste prompt é a **porta** (o bloco entre o título da página e
o corpo da calculadora), não a folha lateral que ela abre — a folha só entra como destino, para que a
porta prometa o que ela realmente encontra do outro lado.

## Por que este prompt existe

Ninguém desenhou esta porta. O código a inferiu do requisito: um `Button variant="ghost" size="sm"`
com ícone `boxes` emprestado do catálogo, alinhado à direita, sem contador, sem estado, byte-idêntico
para grátis, deslogado, premium ativo e premium pausado. O protótipo de 2026-07-02 (E4 + §F) desenha a
Calcular inteira — recompute ao vivo, seções coláveis, seletor do catálogo, PriceHero, breakdown,
varejo×atacado, a ação Salvar e a folha de upsell — e **nenhuma entrada de lista de simulações**; o
esqueleto `CalculatorScreen.jsx` tem exatamente duas ações na barra superior (tema e Conta) e nada no
corpo que navegue para simulações. O canvas 018 exclui a Calcular por escrito. E a `ux-scenarios.md`
§10.2/G4 chega a pedir com todas as letras "Design the header entry now" — pedido que nunca virou pixel.
Consequência medida em impacto: metade do valor pago fica atrás de um fantasma no canto.

## O que já existe hoje (não invente do zero — corrija)

Ordem atual dos elementos no topo da tela, de cima para baixo:

| # | Elemento | Texto literal hoje | Observação |
|---|---|---|---|
| 1 | Título da página (centralizado) | "Calcular preço" | `PageHeader`, centralizado |
| 2 | Legenda freemium (centralizada, `caption`) | "Calcular custo e markup é grátis, sem limite. Vender em marketplaces, salvar e exportar fazem parte do Premium." | frase homologada, promovida à primeira dobra por decisão do dono — **não reescrever** |
| 3 | **A porta** (alinhada à direita) | ícone `boxes` + "Minhas simulações" | botão fantasma, `size="sm"`, ~16px de ícone |
| 4 | Barra de contexto (só quando há simulação aberta) | "Simulação: {nome}" + "Recalculado com os preços de hoje" | já desenhada, fora deste escopo |
| 5 | Corpo da calculadora | seções de custo / markup / canais | fora deste escopo |

→ **Problema 1 — hierarquia invertida.** O item 3 é a porta de um recurso inteiro e pesa menos que
qualquer campo do formulário abaixo dele. O olho vai do título centralizado direto para o primeiro
campo e nunca passa pela direita.
→ **Problema 2 — sem estado.** O botão não diz se existem simulações salvas, quantas, nem qual foi a
última. Quem tem 12 simulações vê o mesmo que quem tem zero.
→ **Problema 3 — o ícone é emprestado.** `boxes` é o ícone do catálogo/kits; aqui sugere "peças", não
"estratégias de preço salvas".
→ **Problema 4 — alinhamento à direita num contêiner que cresce.** A partir de 1024px a página se alarga
de 460px para até 1120px; a porta viaja para a borda direita de um bloco largo, ainda mais longe do olho,
enquanto título e frase freemium seguem centralizados: três alinhamentos em três elementos seguidos.
→ **Problema 5 — Premium pausado é invisível na porta.** O aviso "Premium pausado" só aparece **depois**
que a folha abre. Na porta, um assinante congelado e um assinante ativo são idênticos.

## Conteúdo e dados reais

- Rótulo da porta (chave `scenarios.navEntry`): **"Minhas simulações"**. O título da folha que ela abre
  é o mesmo: "Minhas simulações".
- Subtítulo da folha (só para quem tem acesso): "Estratégias salvas. Cada uma recalcula com os preços de
  hoje quando você abre."
- Cada simulação salva tem: **nome** (obrigatório, até 120 caracteres, ex.: "Caneca 3D — ML Clássico"),
  **nota** (opcional, até 500 caracteres) e um relativo de atualização, nunca uma data:
  "Atualizado há 2 dias", "Atualizado agora mesmo", "Atualizado há 3 semanas".
- **Não existe data em lugar nenhum** desta área — é regra do produto (§0.2). Se o desenho quiser dar
  contexto na porta, o vocabulário disponível é o relativo ("há 2 dias"), nunca "salvo em 14/08".
- Quantidade: a lista é paginada com "Carregar mais", então o número total pode não ser conhecido. Um
  contador exato ("3 salvas") só é honesto para números pequenos e já carregados — ver Perguntas.
- Teaser de quem não tem Premium (título/subtítulo/legenda, textos aprovados pelo dono, não parafrasear):
  "Salve suas simulações" / "Salve uma combinação de marketplaces, taxas e markup para reabrir e comparar
  quando quiser — sempre com os preços de hoje." / "A calculadora continua grátis."
- Nada de dinheiro nesta peça: o preço (ex.: `R$ 24,24`) vive no PriceHero, bem abaixo.

## Estados obrigatórios

1. **Repouso — sem nenhuma simulação salva (premium ativo).** A porta continua visível e convidativa; do
   outro lado ela encontra o vazio "Nenhuma simulação salva ainda" + "Monte uma comparação de canais na
   calculadora e toque em 'Salvar simulação' para guardá-la e reabrir quando quiser." A porta não pode
   prometer uma lista que está vazia.
2. **Repouso — com simulações salvas.** É aqui que o desenho tem de ganhar peso: alguma evidência de que
   há conteúdo do outro lado (contagem, nome da última, ou densidade visual — o desenho decide a forma,
   o dono decide a regra; ver Perguntas).
3. **Grátis / deslogado.** A porta é **visível para todo mundo** — é a porta honesta, não um segredo. Ela
   abre o teaser acima. O desenho não pode escondê-la, nem marcá-la com cadeado que sugira "erro", nem
   duplicar o CTA de compra na própria porta (só um CTA de compra por tela).
4. **Premium pausado (`lapsed`).** Abrir e recalcular continuam funcionando; salvar, renomear, duplicar e
   excluir, não. Frases existentes: "Premium pausado" / "Suas simulações continuam aqui e podem ser
   abertas e recalculadas. Para salvar, renomear, duplicar ou excluir, reative o Premium."
5. **Offline.** A porta continua clicável e a lista continua legível (leitura em cache): "Modo leitura
   offline" / "Suas simulações continuam aqui e podem ser abertas. Salvar, renomear, duplicar ou excluir
   precisam de conexão." A porta **não** pode parecer desligada — a calculadora inteira funciona offline.
6. **Carregando.** A lista carrega com um spinner **depois** que a folha abre; a porta em si não tem
   estado de carregamento hoje. Se o desenho quiser mostrar contagem na porta, precisa de um repouso
   sem-número enquanto o número não existe (nunca "0" enquanto carrega).
7. **Erro de carga (frio).** "Não foi possível carregar suas simulações." + "Tentar novamente" — dentro
   da folha; a porta não muda.
8. **Foco / hover / pressionado / desabilitado.** Foco visível obrigatório (é um alvo de navegação por
   teclado). **Desabilitado não existe para esta porta em nenhum estado** — nem offline, nem grátis, nem
   pausado. Se o desenho propuser um desabilitado, ele está errado.

## Viewports

- **390px (obrigatório)** — é a tela onde o vendedor realmente usa o produto e onde a porta some hoje:
  desenhar a primeira dobra inteira (título + frase freemium + porta + começo do primeiro campo) para
  provar que a porta é vista sem rolar.
- **1280px (obrigatório)** — a página se alarga para até 1120px acima de 1024px, e é exatamente aí que o
  alinhamento à direita mais atrapalha. Desenhar como a porta se comporta na largura maior sem virar um
  elemento perdido no canto.
- 1920px é dispensável: acima de 1024px o conteúdo trava em 1120px e nada mais muda.

## Regras que o desenho não pode quebrar

- **Freemium binário e honesto.** A porta é a mesma para todos; o que muda é o que ela encontra. Nunca
  esconder o recurso de quem não pagou, nunca fingir que ele está ligado.
- **Nenhuma data.** Só relativos ("há 2 dias"). Uma data escrita seria uma alegação que o produto não faz.
- **Falha de rede nunca vendida como falta de Premium**, e o contrário também: offline diz "precisa de
  conexão", pausado diz "reative o Premium". São frases diferentes porque são causas diferentes.
- **Frase honesta nunca dentro de placeholder** e nunca dentro de um elemento que corta texto: se a porta
  ganhar uma legenda, ela vive em elemento de largura cheia.
- **Alvo de toque ≥ 44px** — o botão fantasma `size="sm"` de hoje muito provavelmente não chega lá.
- **Um CTA de compra por tela.** Se o teaser de Premium já está visível na tela, a porta não pode carregar
  um segundo "Assinar".
- **Contraste medido contra o fundo real da Calcular**, não contra um fundo de prancheta.

## Armadilhas já pagas neste projeto

- **Overflow horizontal medido, não olhado.** Já custou 100,5px de estouro com um botão nascido fora da
  viewport. Se a porta virar uma linha com nome + contagem + ícone, desenhe com um nome longo de verdade
  ("Caneca personalizada com logotipo do cliente — Shopee frete grátis") e prove onde o texto corta.
- **Texto ocluso passa em teste.** O desenho deve deixar claro o que trunca e com que marcador — a lista
  já usa reticências explícitas na nota, porque o corte silencioso não avisa nada.
- **Rolagem vertical que o headless não vê.** A primeira dobra precisa caber de verdade a 390px: a frase
  freemium só foi promovida ao topo porque a promessa antiga vivia a 97% da altura da página.
- **Ícone emprestado vira significado errado.** `boxes` já significa catálogo/kits em três telas.

## Entregável

Pranchetas, em **tema escuro (padrão) e claro (first-class)**:

1. **390px — primeira dobra da Calcular** com a porta redesenhada, estado "com simulações salvas".
2. **390px — a mesma dobra**, estado "nenhuma simulação salva ainda" (grátis/deslogado e premium-zero,
   se o desenho os diferenciar).
3. **390px — Premium pausado** e **offline**, lado a lado, mostrando o que muda na porta.
4. **1280px — a dobra na largura de 1120px**, provando o alinhamento, mais o **detalhe do componente**
   em repouso / hover / foco / pressionado, com a medida do alvo anotada.

Reutilizar os primitivos existentes, sem inventar novos: o contêiner da porta como `tf-card` (se ganhar
corpo) ou o próprio `tf-btn` numa variante já existente (se continuar botão); a contagem, se houver, com
o primitivo de selo/badge já usado no projeto; o ícone do conjunto existente, mas **não** `boxes`. A
folha de destino já está composta com `tf-sheet` + `tf-card` + `tf-empty-state` + `tf-alert` — o desenho
da porta não deve pedir mudanças lá.

## Perguntas em aberto para o dono

1. **A porta mostra contagem?** "Minhas simulações (3)" só é honesto enquanto a lista couber numa página;
   com paginação, o total pode não ser conhecido. Alternativas: sem número, número só até um teto
   ("9+"), ou nome da última simulação em vez de contagem.
2. **A porta muda de peso quando o vendedor é grátis?** Hoje é idêntica. Ela deve continuar idêntica (a
   porta honesta) ou ganhar uma legenda que diga que do outro lado há uma oferta?
3. **"Premium pausado" aparece na porta ou só dentro da folha?** Mostrar na porta avisa antes do clique;
   também espalha um aviso de cobrança para dentro da tela de cálculo.
4. **A porta continua no topo, ou passa a viver junto do PriceHero**, ao lado de "Salvar simulação" —
   onde a intenção de salvar/reabrir nasce? O código a colocou no topo por ser "nav-like", nunca por
   decisão de produto homologada.
