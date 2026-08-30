# Folha lateral "Minhas simulações" — a lista inteira

## O que desenhar
O painel onde o vendedor guarda e reabre as estratégias de preço dele. Ele vive **por cima da tela Calcular**: é uma folha (sheet) ancorada à direita, que sobe quando o vendedor toca no botão discreto "Minhas simulações" (ícone `boxes`, alinhado à direita, logo abaixo do título da página). Dentro dela ele busca, lê, renomeia, duplica, exclui e — o ato principal — **reabre** uma simulação; ao reabrir, a folha fecha e a calculadora atrás é repovoada com aquela estratégia, recalculada com os preços de hoje. É a única tela do produto onde o trabalho salvo do vendedor aparece como uma lista, e ela nunca passou por um designer.

## Por que este prompt existe
O frame inteiro foi inferido por IA a partir de requisito textual: largura, altura, densidade, a ordem vertical (título → subtítulo → busca → alertas → cards → "Carregar mais"), onde fica o X, e o que acontece com a página atrás. A auditoria confirmou a ausência de protótipo nas quatro autoridades: o prompt do protótipo de 2026-07-02 desenhou E1–E9 (Splash, Login, Shell, Calcular, Catálogo, Histórico, Conta, Upsell, Transversais) e **nenhuma tela de cenários**; os dois prompts de correção colocam "simulador de marketplace" por escrito numa lista de escopo **futuro**; os 6 esqueletos de UI kit não têm `ScenarioScreen`; e o canvas desktop de 018 tem 4 pranchetas (Catálogo, Kits, Orçamentos, Conta) — Calcular não está lá. Ou seja: esta peça existe em produção, é ALTA prioridade, e ninguém nunca a viu desenhada.

## O que já existe hoje (não invente do zero — corrija)
Container: folha à direita, `min(92vw, 26rem)` de largura (**máx. 416px**), altura total da janela, cantos arredondados só à esquerda, sombra grande, overlay escurecendo a Calcular atrás. Botão X de fechar embutido no canto superior direito (alvo ≥44×44px já garantido); o título reserva espaço à direita para não colidir com ele.

Ordem vertical atual, com gap de 12px entre blocos e 8px entre cards:

| Ordem | Elemento | Texto literal hoje |
|---|---|---|
| 1 | Título da folha | "Minhas simulações" |
| 2 | Subtítulo (**só para quem tem Premium**) | "Estratégias salvas. Cada uma recalcula com os preços de hoje quando você abre." |
| 3 | Campo de busca (sem rótulo visível) | placeholder "Buscar por nome…" |
| 4 | Alertas de estado (0 a 2) | ver "Estados obrigatórios" |
| 5 | Pilha de cards | um card por simulação |
| 6 | Botão secundário, só se houver mais páginas | "Carregar mais" |

Card (hoje: `Card` com padding pequeno, tudo empilhado com 4px):
- nome em uma linha, peso médio, **truncado com reticências** — ex.: "Chaveiro 4un — ML + Shopee";
- nota opcional, cor apagada, **cortada em 2 linhas** com reticências explícitas (quebra até dentro de palavra sem espaço) — ex.: "Testar frete grátis a partir de R$ 79 no ML clássico";
- linha pequena e apagada: "Atualizado há 2 dias" (também "agora mesmo", "há 12 min", "há 5 h", "há 3 semanas") — **nunca uma data**, é convenção de produto: a data seria uma alegação sobre o preço, e o preço é sempre recalculado hoje;
- fileira de 3 botões-ícone fantasma alinhados à direita, ícones de 18px: lápis (Renomear) · cópia (Duplicar) · lixeira (Excluir);
- quando as escritas estão bloqueadas, uma quarta linha minúscula e apagada à direita com o motivo.

Toda a área de texto do card é **um único alvo clicável** que abre a simulação.

→ Problemas que o desenho precisa resolver, não repetir:
- **Sem hierarquia entre buscar, ler e reabrir.** Os três pesos visuais hoje são quase iguais: a busca, o nome e a fileira de ícones competem no mesmo card estreito de ~380px úteis.
- **O motivo repetido N vezes.** Offline ou com Premium pausado, o alerta do topo já diz a frase inteira e **cada card repete** "Esta ação precisa de conexão." / "Premium pausado — reative para renomear, duplicar, editar ou excluir." Com 10 cards, a mesma frase aparece 11 vezes.
- **Três ícones fantasma pequenos, colados, com 4px entre eles**, num painel de dedo — risco de alvo abaixo de 44px e de toque errado (o vizinho da lixeira é o duplicar).
- **A folha fecha sem retorno visual nenhum.** Reabrir um card fecha o painel e troca a calculadora inteira embaixo, sem transição, sem confirmação, sem nada dizendo "carreguei a sua simulação".
- **Duplicar dá um salto.** Duplicar cria a cópia, mostra um aviso de sucesso e **abre a cópia imediatamente**, fechando a folha — o vendedor pediu uma cópia e foi levado para outra tela.
- **A lista não mostra número nenhum.** Nenhum preço, nenhum canal, nenhuma contagem: para comparar duas estratégias é obrigatório abrir uma, depois a outra.
- **A busca não tem rótulo visível** (só placeholder e rótulo acessível) — e esta é a peça onde o campo de busca já nasceu com 1×1px, invisível, e passou nos testes.

## Conteúdo e dados reais
- **Nome** (obrigatório, até 120 caracteres) — "Máximo de 120 caracteres." / vazio: "Dê um nome à simulação."
- **Nota** (opcional, até 500 caracteres) — "Máximo de 500 caracteres."
- **Atualizado em** (derivado, relativo, nunca data absoluta).
- A lista é paginada por cursor e **não tem total**: existe "Carregar mais" e nada que diga quantas faltam.
- A lista é a **união** do que veio do servidor com o cache do aparelho; offline, ela continua legível.
- Volume plausível: de 0 a algumas dezenas. Desenhe pelo menos uma prancheta com ~8 cards visíveis e rolagem.
- Textos duros a usar VERBATIM nos rótulos e nos avisos (já homologados): "Abrir", "Renomear", "Duplicar", "Excluir", "Voltar", "Tentar novamente", "Carregar mais", "Limpar busca", "Salvar alterações".
- Diálogos de apoio que abrem a partir daqui (desenhe pelo menos o de excluir): renomear = folha aninhada com título "Renomear simulação", campos "Nome" e "Nota (opcional)", botão "Salvar alterações"; excluir = diálogo central "Excluir a simulação “Chaveiro 4un — ML + Shopee”?" + "Esta ação não pode ser desfeita." + "Voltar" / "Excluir".
- Avisos de sucesso (aparecem só em resposta real do servidor): "Simulação renomeada." · "Simulação duplicada." · "Simulação excluída."

## Estados obrigatórios
1. **Carregando (frio)** — hoje só um spinner centrado com bastante respiro vertical, sem título, sem esqueleto. Desenhe o que deve aparecer.
2. **Repouso com lista** — o caso comum, 1 a 8 cards.
3. **Vazio (nunca salvou nada)** — ícone `boxes`, título "Nenhuma simulação salva ainda", corpo "Monte uma comparação de canais na calculadora e toque em “Salvar simulação” para guardá-la e reabrir quando quiser." e botão "Voltar para a calculadora".
4. **Vazio de busca** — "Nenhuma simulação encontrada para “chaveiro”." + botão "Limpar busca". A busca fica visível e preenchida.
5. **Erro frio** (nada em cache, nada servido) — alerta de perigo "Não foi possível carregar suas simulações." + botão "Tentar novamente". Nunca cobre dados já em mãos.
6. **Offline / leitura degradada** — alerta informativo, título "Modo leitura offline", corpo "Suas simulações continuam aqui e podem ser abertas. Salvar, renomear, duplicar ou excluir precisam de conexão." + "Tentar novamente"; os 3 ícones de cada card ficam desabilitados, **abrir continua funcionando**.
7. **Premium pausado (lapsed)** — alerta informativo, título "Premium pausado", corpo "Suas simulações continuam aqui e podem ser abertas e recalculadas. Para salvar, renomear, duplicar ou excluir, reative o Premium." Mesma regra: leitura viva, escrita travada.
8. **Erro de uma ação** (duplicar falhou) — alerta de perigo acima da lista, com a frase específica; offline vira "Esta ação precisa de conexão.".
9. **Sem permissão / porta honesta** — quem está deslogado **ou** nunca comprou Premium vê o mesmo painel com o mesmo título e, no lugar da lista, o convite: "Salve suas simulações" / "Salve uma combinação de marketplaces, taxas e markup para reabrir e comparar quando quiser — sempre com os preços de hoje." / "A calculadora continua grátis." Nesse estado o subtítulo da lista **não aparece** (senão a mesma promessa é dita duas vezes coladas).
10. **Foco de teclado** em: campo de busca, área clicável do card, cada botão-ícone, "Carregar mais", X de fechar.
11. **Hover e pressionado** do card inteiro (é um botão) e dos botões-ícone.
12. **Desabilitado** dos 3 botões-ícone — precisa ser lido como "bloqueado por um motivo dito", não como "quebrado".
13. **Carregando parcial** — "Carregar mais" em estado de carregamento com a lista já visível acima.

## Viewports
- **390px (obrigatório)** — é a tela real do vendedor. A folha ocupa 92vw ≈ 359px; com o respiro interno sobram ~320px de conteúdo, e é aí que nome truncado, nota de 2 linhas e 3 ícones disputam espaço.
- **1280px** — a folha vira uma faixa de 416px sobre uma calculadora larga. Mostre a relação com o que fica atrás (overlay, o que ainda se lê, onde cai o X).
- **1920px** — mesma folha de 416px num monitor grande: 78% da tela é overlay inerte. Desenhe o que faz sentido aí (a resposta pode ser "outra proporção" — veja as perguntas ao dono). Calcular **não** foi redesenhada no canvas desktop de 018, então esta é a primeira vez que alguém decide como esta lista se comporta no desktop.

## Regras que o desenho não pode quebrar
- **Freemium binário e honesto:** ou a lista real, ou o convite Premium — nunca uma lista vazia fingindo que o recurso está ligado.
- **Nenhuma data em lugar nenhum.** Só tempo relativo. Uma data seria uma alegação sobre um preço que é sempre recalculado hoje.
- **Falha de rede nunca vendida como falta de Premium**, e vice-versa: cada alerta diz a causa medida.
- **Degradação dita, não escondida:** offline e Premium pausado continuam permitindo LER e ABRIR; o que trava é escrever, e o motivo aparece.
- **Frase honesta nunca dentro de placeholder** (placeholder some ao digitar e é cortado por largura) — se houver algo a afirmar, é texto de verdade em elemento de largura cheia.
- **Alvos ≥44×44px** para os 3 botões-ícone, para o X e para a área clicável do card.
- **Contraste medido contra o fundo real do card**, não contra o fundo da página — a nota apagada sobre superfície de card é o par crítico.
- **Confirmação sempre para excluir**; sucesso só quando o servidor confirmou.

## Armadilhas já pagas neste projeto
- **Campo de busca invisível**: nesta mesma peça, o controle inteiro já foi ao ar com 1×1px porque o rótulo foi escondido junto — passou em todo teste de texto. Deixe explícito no desenho o tamanho e o contorno do campo.
- **Texto cortado sem sinal de corte**: a nota já cortava em 2 linhas sem reticência quando era uma palavra única gigante. Desenhe com uma nota adversarial (uma palavra de 60 caracteres) e com um nome de 120 caracteres.
- **Estouro horizontal medido**: já houve 100,5px de estouro e um botão nascido fora da viewport nesta base. A 390px, nada pode empurrar a folha para o lado.
- **Rolagem no eixo vertical que o headless não vê** — o painel tem altura total e rola; deixe claro onde começa e termina a área rolável e se título/busca ficam fixos.
- **Contagem que mente**: já houve um "8 encontrados" com 31 resultados. Se o desenho introduzir contador, ele precisa ser da lista carregada, e a paginação torna isso ambíguo.
- **Aviso de sucesso que nunca renderizou** porque o painel desmontou antes: se o desenho depender de um toast após fechar a folha, diga onde ele aparece e sobre o quê.

## Entregável
Pranchetas, em **tema escuro (padrão) e tema claro (first-class, não uma sobra)**:
1. 390px — repouso com 8 cards e rolagem; 2. 390px — vazio (nunca salvou); 3. 390px — vazio de busca; 4. 390px — offline com escritas travadas; 5. 390px — Premium pausado; 6. 390px — erro frio; 7. 390px — carregando; 8. 390px — porta honesta (convite Premium); 9. 390px — diálogo de excluir sobre a folha; 10. 1280px — repouso, com a Calcular visível atrás; 11. 1920px — repouso; 12. um recorte ampliado do card em repouso/hover/pressionado/desabilitado, com o alvo de 44px marcado.

Reutilize os primitivos `tf-*` existentes, sem criar novos: a folha é `Sheet`/`SheetContent` ancorado à direita com `SheetTitle` e `SheetDescription`; cada item é um `Card` de padding pequeno; a busca é o par `Field` + `tf-input` dentro de `tf-inputwrap`; os avisos de estado são `Alert` (tom `info` para offline/pausado, `danger` para falha); vazio e vazio-de-busca são `EmptyState` com ícone `boxes`; as ações do card são `Button variant="ghost" size="sm"` com `Icon` (`pencil`, `copy`, `trash-2`); "Carregar mais" e "Tentar novamente" são `Button variant="secondary"`; excluir usa `Dialog` central com `Button variant="danger"`; o carregamento é `Spinner`. Se algum estado exigir um primitivo que não existe, **diga isso explicitamente** em vez de desenhar um componente novo por conta própria.

## Perguntas em aberto para o dono
1. **Desktop:** a folha continua com 416px sobre a Calcular a 1280/1920px, ou no desktop as simulações viram um painel lateral fixo/mais largo (na linguagem das 4 abas de 018)? Calcular nunca foi redesenhada no desktop, e isso muda a peça inteira.
2. **O card mostra algum número?** Hoje não mostra nenhum — nem preço, nem canal, nem nº de peças. Comparar duas estratégias exige abrir as duas. Se for para mostrar, qual número é honesto num card que só recalcula ao abrir?
3. **Duplicar deve abrir a cópia na hora** (fechando a folha, como hoje) ou permanecer na lista com a cópia já criada e visível?
4. **Reabrir merece retorno visual?** Hoje a folha some e a calculadora troca em silêncio. Quer um aviso ("Simulação carregada"), uma transição, ou o silêncio é proposital?
5. **O motivo do bloqueio** (offline / Premium pausado) deve ficar só no alerta do topo, ou repetido em cada card como hoje?
6. **Contagem/ordenação:** a lista é sempre por atualização mais recente e sem total. Vale expor a contagem carregada e/ou uma ordenação alternativa?
