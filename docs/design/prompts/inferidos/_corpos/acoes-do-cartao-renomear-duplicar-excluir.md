# Ações do cartão de simulação: renomear · duplicar · excluir

## O que desenhar
A linha de ações que fica no rodapé de cada cartão da lista "Minhas simulações" — a folha (sheet) que o vendedor abre pelo cabeçalho da página Calcular para reencontrar uma estratégia de canais que ele salvou. Cada cartão mostra o nome da simulação, a nota e "Atualizado há 2 dias"; o corpo inteiro do cartão é o alvo de "Abrir". Abaixo dele mora a peça deste prompt: as três ações de gestão do item — **renomear**, **duplicar** e **excluir**. É o único lugar do produto onde o vendedor apaga a cópia que ele tem de uma estratégia salva, e é usado num momento de varredura rápida (ele está procurando uma simulação, não administrando um cadastro).

## Por que este prompt existe
A afordância foi TROCADA no código sem desenho. A autoridade textual (ux §3.1, linhas 279/291) descreve um menu de excesso "⋯" por cartão; o que existe é uma fileira de **três ícones nus** (lápis, cópia, lixeira, 18px) em botões fantasma colados por 4px, sem rótulo visível — só `aria-label`. O próprio arquivo assume a troca num comentário ("T029 dated deviation") justificando-a pela ausência de uma primitiva DropdownMenu no DS.
E aqui o código **contraria uma regra de desenho explícita**: o canvas do dono desenha duplicar/excluir DUAS vezes, sempre como **botões com texto e com separação de peso** — na ficha do Catálogo, `tf-btn--secondary tf-btn--sm` "Duplicar" ao lado de `tf-btn--danger-ghost tf-btn--sm` "Excluir"; na ficha de Orçamentos, o "Excluir" `tf-btn--danger-ghost` é empurrado para longe dos demais com `margin-left:auto`. O protótipo antigo, quando usa ícone nu numa linha de lista, usa **um só** (um lápis "Editar"). Nenhuma das quatro autoridades desenha uma fileira de três ícones nus num cartão. A forma que existe não tem autoridade nenhuma — é preciso desenhá-la.

## O que já existe hoje (não invente do zero — corrija)
Origem: `apps/web/src/features/scenarios/scenarios-list-sheet.tsx` (cartão + folha de renomear + diálogo de excluir).

O cartão, de cima para baixo:

| Elemento | Conteúdo real | Comportamento |
|---|---|---|
| Nome | ex.: "Caneca 3D — Natal 2026" | uma linha, corta com reticências |
| Nota (opcional) | ex.: "testar frete grátis Shopee acima de 79" | 2 linhas com reticências visíveis; quebra até dentro de palavra sem espaço |
| Carimbo | "Atualizado há 2 dias" (também "agora mesmo", "há 12 min", "há 5 h", "há 3 semanas") | nunca uma data — só o tempo desde a última mudança |
| Linha de ações | três ícones: `pencil` · `copy` · `trash-2`, 18px | alinhada à direita, `gap` de **4px** |

→ Os três ícones **não têm rótulo visível**; o significado só existe no leitor de tela ("Renomear Caneca 3D — Natal 2026", "Duplicar …", "Excluir …").
→ A lixeira tem **exatamente o mesmo peso visual** dos outros dois: mesmo botão fantasma, mesma cor de texto forte, mesmo tamanho. Nada nela diz "irreversível".
→ "Duplicar" e "Excluir" ficam a **4px** um do outro, alvos de 44×44px lado a lado: um erro de polegar de 2mm troca a cópia pela exclusão.
→ O corpo do cartão inteiro é um alvo clicável ("Abrir") e a fileira vive **dentro** do mesmo cartão — dois níveis de clique sem nenhuma separação visual entre eles.
→ A ordem hoje é renomear → duplicar → excluir; a destrutiva é a última, mas colada.

O que cada ação dispara, e que já está pronto (não redesenhar o fluxo, só a entrada dele):
- **Renomear** abre uma folha "Renomear simulação" com "Nome" (obrigatório) e "Nota (opcional)", botão "Salvar alterações".
- **Duplicar** age **sem confirmação**: cria a cópia, mostra o toast "Simulação duplicada." e **fecha a folha**, abrindo a cópia na calculadora.
- **Excluir** abre um diálogo central: "Excluir a simulação “Caneca 3D — Natal 2026”?" / "Esta ação não pode ser desfeita." / "Voltar" (fantasma) + "Excluir" (vermelho cheio).

## Conteúdo e dados reais
- Rótulos literais das ações, já homologados: **"Renomear"**, **"Duplicar"**, **"Excluir"**. O "Abrir" do corpo do cartão também é literal.
- Nome: obrigatório, até 120 caracteres. Erros literais: "Dê um nome à simulação." e "Máximo de 120 caracteres."
- Nota: opcional, até 500 caracteres — "Máximo de 500 caracteres." Desenhe o cartão com uma nota de 500 caracteres sem espaços para ver a linha de ações não afundar.
- Confirmações (toasts, só em resposta real do servidor): "Simulação renomeada." · "Simulação duplicada." · "Simulação excluída."
- Nenhum valor em dinheiro aparece nesta peça — o cartão da lista não mostra preço; o número (ex.: R$ 24,24) só reaparece quando a simulação é reaberta na calculadora, recalculada com os preços de hoje.
- Ao redor: título da folha "Minhas simulações", subtítulo "Estratégias salvas. Cada uma recalcula com os preços de hoje quando você abre.", campo de busca com placeholder "Buscar por nome…", os cartões separados por 8px, e "Carregar mais" ao final.

## Estados obrigatórios
- **Repouso** — as três ações visíveis, sem hover.
- **Hover / foco por teclado** — precisa distinguir *o cartão* (Abrir) de *cada ação*; hoje o fantasma só ganha fundo suave e o foco é um anel. Desenhe os dois níveis, para que passar por cima de "Excluir" nunca pareça passar por cima do cartão.
- **Pressionado** — o DS reduz a escala do botão; mostre-o na lixeira.
- **Desabilitado (offline)** — as três ações apagadas e, abaixo delas, alinhada à direita, a frase literal **"Esta ação precisa de conexão."** No topo da lista ainda existe o aviso "Modo leitura offline" / "Suas simulações continuam aqui e podem ser abertas. Salvar, renomear, duplicar ou excluir precisam de conexão."
- **Desabilitado (Premium pausado)** — mesmas três apagadas e a frase literal **"Premium pausado — reative para renomear, duplicar, editar ou excluir."**; no topo, o aviso "Premium pausado" / "Suas simulações continuam aqui e podem ser abertas e recalculadas. Para salvar, renomear, duplicar ou excluir, reative o Premium."
  → Hoje essa frase honesta é uma linha de 12px, cinza-mudo, alinhada à direita, debaixo de três ícones apagados. É o ponto mais fraco da peça: o motivo da recusa é menor e mais fraco do que a recusa.
- **Carregando de escrita** — renomear e excluir mostram estado de carregamento nos botões dos seus diálogos; **duplicar não tem nenhum feedback no cartão** enquanto a cópia é criada. Desenhe o que o ícone de duplicar faz nesse intervalo.
- **Erro de duplicar** — não aparece no cartão: sobe como faixa vermelha no topo da lista, longe do cartão que a causou. Marque como problema a resolver.
- **Cartão sem nota** — a linha de ações encosta no carimbo "Atualizado há 2 dias"; verifique o respiro.
- **Não existe para grátis/deslogado** — nesse caso a lista inteira é substituída pelo teaser de Premium; não há cartão, logo não há esta peça.

## Viewports
- **Mobile 390px** — obrigatório e principal. A folha ocupa 92vw; descontado o respiro interno, sobram ~320px de cartão para nome, nota e a fileira de 140px de ações.
- **Desktop 1280px** — a mesma folha, ancorada na lateral, com largura máxima de 26rem (416px). A peça não ganha espaço no desktop: **o cartão é praticamente o mesmo em ambos**, então mostre os dois para provar que a solução não depende de largura. O redesenho desktop de 2026 (018) não tocou nesta superfície: Simulações continua sendo uma folha aberta pela Calcular.

## Regras que o desenho não pode quebrar
- **Alvo de toque ≥44×44px** em cada ação, inclusive quando o botão é "pequeno" — e o espaço **entre** a ação de cópia e a de exclusão precisa ser desenhado como decisão, não como resto de layout.
- **A ação destrutiva é declarada, não escondida**: ela tem cor de perigo e distância das demais. A convenção já desenhada pelo dono é `tf-btn--danger-ghost` — vermelho legível, sem o convite de um botão cheio.
- **Frase honesta nunca em posição secundária**: o motivo pelo qual uma ação está desabilitada (sem conexão, Premium pausado) é conteúdo de primeira classe, não uma legenda de rodapé — e nunca vive dentro de um placeholder.
- **Falha de rede nunca é vendida como falta de Premium**, e vice-versa: são duas frases diferentes porque são duas causas diferentes.
- **Freemium binário**: ou o vendedor tem a lista (e as três ações), ou ele tem o teaser. Não existe cartão meio-ativo.
- **Confirmação só para o irreversível**: excluir confirma; duplicar não confirma e nem deve passar a confirmar.
- **Contraste medido contra a superfície real do cartão**, não contra o fundo da página — o cartão é uma superfície elevada dentro de uma folha sobre um scrim.

## Armadilhas já pagas neste projeto
- **Ícone nu em fileira já custou caro aqui**: a mesma convenção existe no Catálogo (cópia + lixeira sem rótulo) e foi copiada para cá "para manter um idioma" — a repetição de um erro não o torna um padrão.
- **Texto ocluso passa em teste**: `toBeVisible` e `toContainText` passam num elemento totalmente coberto ou estourado. A legenda do motivo, alinhada à direita ao lado de três ícones, é exatamente o tipo de coisa que "passa" e ninguém lê. Desenhe medindo caixas.
- **Overflow horizontal medido em ambos os eixos**: um nome longo sem espaços + a fileira de 140px de ações num cartão de ~320px é o cenário adversarial obrigatório.
- **Toast que nunca aparece**: já aconteceu de um diálogo desmontar antes do aviso de sucesso renderizar. Se o desenho depender de um toast para fechar o ciclo ("Simulação excluída."), diga onde ele aparece e por quanto tempo.
- **Placeholder que corta a frase**: o campo de busca desta mesma folha já foi um controle invisível de 1×1px; e a frase honesta em placeholder já foi cortada em outro increment. Nada explicativo mora em placeholder.

## Entregável
Pranchetas, no **tema escuro** (padrão) e no **tema claro** (first-class, não uma variação de cortesia):
1. O cartão em repouso, com nome curto e com nome longo, mobile 390px.
2. A fileira de ações em detalhe (zoom), mostrando repouso · hover · foco · pressionado, com as caixas de alvo desenhadas.
3. O cartão desabilitado por offline e o cartão desabilitado por Premium pausado, com as frases literais no lugar que você propõe para elas.
4. O cartão no desktop 1280px dentro da folha lateral de 416px.
5. Uma prancheta comparativa da alternativa que você recomenda contra a forma atual (três ícones nus com 4px) — se a sua proposta for o menu "⋯" que a autoridade textual pede, mostre o menu aberto e o que acontece com o alvo de 44px dentro dele.

Reutilize os primitivos existentes, sem inventar componente novo: `tf-card` (padding pequeno) para o cartão; `tf-btn--ghost` / `tf-btn--secondary` / `tf-btn--danger-ghost` nos tamanhos `--sm` para as ações; `tf-field__hint` para a legenda de motivo, se ela continuar sendo legenda; `tf-alert` para os avisos de offline/Premium pausado; o diálogo central existente para a confirmação de exclusão. Se a sua solução exigir uma primitiva que não existe (um menu de excesso, um separador dentro do cartão), diga isso explicitamente numa nota — é uma decisão de DS, não um detalhe de layout.

## Perguntas em aberto para o dono
1. A autoridade textual pede um menu "⋯" por cartão; seus dois canvases desenham botões **com texto** e afastam o "Excluir". Qual das duas vale para uma **lista** (onde o texto de três botões compete com o nome da simulação)? A resposta muda o desenho inteiro.
2. "Duplicar" hoje age sem confirmação e **fecha a folha**, levando o vendedor para a calculadora com a cópia aberta. Isso é o desejado, ou a cópia deveria aparecer na lista e ele continuar navegando?
3. "Renomear" edita nome **e nota**, mas o rótulo diz só "Renomear". O rótulo deveria dizer "Editar", ou a nota deveria sair dessa folha?
4. Excluir é *soft delete* no servidor, e o texto diz "Esta ação não pode ser desfeita." Existe alguma intenção futura de desfazer (um "Desfazer" no toast)? Se sim, a frase de confirmação precisa mudar antes do desenho.
