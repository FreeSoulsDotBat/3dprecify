# A zona de salvar no fim da Calcular: "Salvar simulação" + "Salvar em Orçamentos"

## O que desenhar
O bloco de ações que fecha a aba **Calcular**, logo abaixo do resultado (detalhamento, avisos e os dois
cartões de preço Varejo/Atacado). Hoje esse bloco é um par de botões empilhados e centralizados, quase
idênticos, que salvam **duas coisas de natureza oposta**: uma *simulação* (estratégia que **recalcula com
os preços de hoje** toda vez que é reaberta) e um *orçamento* (documento **congelado** no dia, imutável).
Quem usa é o vendedor que acabou de ver o preço e precisa decidir o que fazer com ele — é o último gesto
da jornada de precificar. Desenhe a zona inteira, não um botão solto: a decisão de desenho é a
**hierarquia e a distinção** entre os dois salvares.

## Por que este prompt existe
Nenhuma autoridade desenhou o **par**. Foi inferido em código: a ordem (simulação em cima, orçamento
embaixo), o peso `secondary` para os dois, o mesmo ícone de disquete nos dois, o empilhamento centralizado
e o estado desabilitado sem nenhuma explicação ao lado. O protótipo de 2026-07-02
(`.design-import/ui_kits/precifica3d/CalculatorScreen.jsx`) cobre **uma** ação neste ponto: um botão
`primary`, full-width, com glow e ícone de salvar — "Salvar cálculo" — em **linha horizontal** com um
`outline` "Compartilhar", e a frase freemium centralizada logo abaixo. A correção item 33 já tirou o glow
daí (o prompt fixa "um glow por zona", e o glow foi para o PriceHero). O segundo salvar (simulação) nem
existia no protótipo. Ou seja: o slot está desenhado com **uma** ação primária; o produto entrega **duas**
secundárias iguais. O canvas desktop 018 não cobre a Calcular.

## O que já existe hoje (não invente do zero — corrija)
Contêiner: coluna vertical, espaçamento uniforme; a partir de 1024px cada bloco fica centralizado e limitado
a 720px de largura. Ordem atual, de cima para baixo:

| # | Elemento | Texto literal hoje | Comportamento real |
|---|---|---|---|
| 1 | Detalhamento + preços por canal | "Detalhamento", "Preços por canal" | cartão único |
| 2 | Aviso (quando atacado > varejo) | alerta tom `info` | opcional |
| 3 | Dois cartões de preço | "Varejo" / "Atacado" + "markup 100%" | ex.: **R$ 24,24** e **R$ 16,16** |
| 4 | Botão A (simulação) | **"Salvar simulação"** | `secondary`, ícone `save` 18px, centralizado |
| 5 | Botão B (orçamento) | **"Salvar em Orçamentos"** | `secondary`, ícone `save` 18px, centralizado |

→ **Problema 1:** 4 e 5 são visualmente indistinguíveis — mesmo peso, mesmo ícone, mesmo alinhamento, um
colado no outro — e significam coisas opostas. Nada na tela diz qual recalcula e qual congela.
→ **Problema 2:** o botão A fica **visível porém desabilitado** enquanto o formulário está inválido, sem
nenhuma frase adjacente explicando por quê (a frase honesta existe — "Corrija os campos da calculadora antes
de salvar." — mas só aparece **dentro** da folha, que um botão desabilitado nunca abre).
→ **Problema 3:** o botão B **desaparece** quando o resultado não existe ou quando a simulação carregada é
de base kit (nesse caso um botão igual reaparece junto do resumo do kit, mais acima). A mesma zona mostra
2, 1 ou 0 botões conforme o contexto, e o desenho precisa aguentar as três contagens.
→ **Problema 4:** a promessa freemium ("Calcular custo e markup é grátis, sem limite. Vender em
marketplaces, salvar e exportar fazem parte do Premium.") vive **no topo** da página, longe daqui — a zona
de salvar não tem legenda nenhuma.

## Conteúdo e dados reais
- Rótulos de botão, verbatim: **"Salvar simulação"** e **"Salvar em Orçamentos"**.
- A diferença entre os dois, já escrita no produto (use como fonte da legenda que faltar):
  simulações — *"Estratégias salvas. Cada uma recalcula com os preços de hoje quando você abre."*;
  orçamentos — *"O que você cotou, com a data. Os valores ficam congelados como estavam no dia."*
- Folha de "Salvar simulação": título "Salvar simulação"; intro *"Guardamos a estratégia desta tela —
  canais, taxas ajustadas, base de custo. Ao reabrir, ela recalcula com os preços de hoje."*; campo
  **"Nome"** (obrigatório, máx. 120 caracteres), campo **"Nota (opcional)"** (máx. 500), eco somente-leitura
  **"Base de custo: avulsa"** (ou "referência do catálogo" / "kit do catálogo"), botão de envio "Salvar
  simulação". Sucesso: toast "Simulação salva."
- Folha de "Salvar em Orçamentos": intro *"Vamos guardar os valores exatamente como estão nesta tela, com a
  data de hoje."*; "Rótulo (opcional)" com dica "Cliente, pedido…", "Validade da proposta" em **dias**,
  **"Preço que você está cotando"** com escolha "Varejo"/"Atacado". Sucesso: "Registro salvo em Orçamentos."
- Valores plausíveis para as pranchetas: preço varejo **R$ 24,24**, atacado **R$ 16,16**; casos de estouro
  a testar: **R$ 1.234,56** e **R$ 128.450,00**.

## Estados obrigatórios
- **Repouso** — os dois botões disponíveis, com o resultado válido acima.
- **Hover / foco / pressionado** — foco com anel visível (o produto testa isso); alvo mínimo 44px de altura.
- **Desabilitado (só o "Salvar simulação")** — formulário inválido. Desenhe **onde** mora a explicação:
  hoje a única pista é o alerta que substitui o resultado, "Confira os campos destacados para ver o preço."
- **Carregando** — envio em andamento dentro da folha (botão de envio inerte); nunca um "salvo" otimista.
- **Erro na folha** — frases reais: "Salvar uma simulação precisa de conexão." · "Esta simulação ficou grande
  demais para salvar. Reduza o número de peças ou de custos e tente de novo." · "Dê um nome à simulação."
- **Offline** — assimetria real e obrigatória de mostrar: o **orçamento** tem fila local e fica "Pendente
  neste dispositivo"; a **simulação** não tem fila e simplesmente exige conexão.
- **Sessão expirada** — vocabulário próprio, jamais "sem conexão": "sua sessão expirou" + "Entrar de novo".
- **Sem Premium ativo** — os dois botões **não existem** (não são cinzas, não são isca). A zona fica só com
  o resultado. Desenhe essa versão: é o que a maioria dos visitantes vê.
- **Premium pausado** — mesmo tratamento de ausência aqui; a frase "Premium pausado — reative para renomear,
  duplicar, editar ou excluir." vive nas listas, não nesta zona.
- **Só um botão** — resultado válido com simulação de base kit carregada: sobra apenas "Salvar simulação".

## Viewports
- **Mobile 390px** (obrigatório) — é a tela real do vendedor, e a zona fica no fim de uma página longa.
  Faça também um recorte de estresse em **360px** com "R$ 128.450,00" acima dos botões.
- **Desktop 1280px** — a coluna centraliza e cada bloco fica capado em 720px: dois botões pequenos
  centralizados num vão largo é exatamente onde a solução horizontal do protótipo pode voltar.
- **1920px** opcional, para confirmar que o cap de 720px não deixa a zona órfã no meio da tela.

## Regras que o desenho não pode quebrar
1. **Freemium é binário**: sem Premium ativo a ação não aparece — nem cinza, nem com cadeado, nem "assine
   para salvar" colado no resultado. A porta honesta é a entrada "Minhas simulações", junto do título.
2. **Falha de rede nunca vira "não é premium"** e vice-versa: offline, sessão expirada e Premium pausado são
   três frases diferentes e não podem compartilhar o mesmo desenho de aviso.
3. **A procedência do número é dita**: o que congela precisa parecer congelado; o que recalcula precisa dizer
   que recalcula. A distinção não pode depender só do rótulo do botão.
4. **Frase honesta nunca dentro de placeholder** nem cortada por reticências — ela mora em elemento de
   largura total.
5. **Um glow por zona** — o glow desta zona já foi gasto no cartão de preço acima.
6. Alvo ≥44px, contraste medido contra o fundo real do cartão, zero rolagem horizontal.

## Armadilhas já pagas neste projeto
- Botão nascido fora da viewport e 100px de overflow horizontal em zona de ação: meça a caixa, não confie no
  texto.
- Valor grande estourando a coluna: aqui o preço já quebrou no meio do dígito a 360px antes de a grade ser
  corrigida — qualquer legenda nova abaixo dos botões precisa aguentar seis dígitos acima dela.
- Legenda cortada por vir presa a um campo estreito: se você criar a legenda diferenciadora, dê a ela a
  largura do bloco.
- Botão habilitado que não faz nada visível: o "Salvar simulação" já ficou mudo ao ser clicado — todo estado
  inerte precisa de causa escrita ao lado.

## Entregável
Pranchetas, tema **escuro** (padrão) e **claro** (first-class), reutilizando os primitivos existentes —
`tf-btn` nas variantes já disponíveis para os dois salvares, `tf-card` para a moldura do resultado acima,
`tf-alert` para os avisos, `tf-sheet` para as duas folhas, `tf-field` para Nome/Nota/Rótulo/Validade e
`tf-price` para os cartões Varejo/Atacado. Não crie primitivo novo; se a solução exigir um bloco novo
(por exemplo, uma legenda de duas linhas sob cada ação), descreva-o como composição dos existentes.
Pranchetas pedidas: (1) 390px repouso com os dois botões; (2) 390px sem Premium (zona sem ação nenhuma);
(3) 390px com "Salvar simulação" desabilitado + a explicação onde você decidir colocá-la; (4) 390px estado
offline/pendente contrastando as duas ações; (5) 1280px repouso; (6) folha "Salvar simulação" aberta a 390px
com erro de conexão visível. Marque explicitamente qual das duas ações você elegeu como primária.

## Perguntas em aberto para o dono
1. Qual das duas é a ação **primária** no fim da Calcular — guardar a estratégia (simulação) ou registrar a
   cotação (orçamento)? A hierarquia visual depende disso e ninguém decidiu.
2. Os dois salvares continuam sendo dois botões irmãos, ou viram **uma** ação com escolha (menu/split) —
   como no protótipo, que tinha um único "Salvar cálculo"?
3. Os rótulos ficam como estão? "Salvar simulação" e "Salvar em Orçamentos" não são simétricos (um nomeia o
   objeto, o outro nomeia o destino) — trocar exige sua palavra, a copy já foi homologada.
4. Cada botão ganha uma legenda curta de diferenciação ("recalcula com os preços de hoje" × "congela os
   valores de hoje")? Isso adiciona duas linhas de texto na dobra final da página.
5. A ação "Compartilhar" do protótipo foi descartada de vez ou está apenas pendente? Ela ocupa metade da
   linha horizontal desenhada em 2026-07-02.
