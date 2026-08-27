# Registro congelado em tela cheia (celular)

## O que desenhar
A tela inteira de **um orçamento congelado** no celular: o documento que o vendedor abre a partir da lista de Orçamentos e **mostra ao cliente na tela do telefone**. É a peça mais "documento" do app — nada nela é recalculado, todo número é uma string gravada no dia da cotação e apenas formatada para leitura. Ela vive em `/historico?snapshot=<id>` e, no celular, ocupa a tela toda (no desktop ≥1280px o mesmo conteúdo é a coluna direita do mestre-detalhe, sem "Voltar" e sem título próprio — esse modo já foi desenhado pelo dono e **não é o alvo deste prompt**). Antes dela vem a lista de Orçamentos; depois dela, só o que ela mesma oferece: recalcular, exportar, comparar, renomear, excluir.

## Por que este prompt existe
A **ordem de leitura dos 11 blocos** numa coluna de 390px nunca foi desenhada — foi decidida no código, na ordem em que os incrementos E4/E6/016 foram implementados. Autoridade: `PROTOTIPO_PARCIAL`. O protótipo de 2026-07-02 (`HistoryScreen.jsx`, §E6) desenhava **outra coisa**: um bottom-sheet com PriceHero centrado (`tone=accent`), três linhas de breakdown e [Duplicar]/[Exportar]. O produto abandonou as três: virou página inteira, **proibiu o PriceHero no congelado** (a proibição está escrita no cabeçalho de `snapshot-detail-page.tsx` — o valor congelado nunca recebe o tratamento do preço vivo) e "Duplicar" nunca existiu.
Há ainda uma **divergência declarada contra a única spec textual que existia**: `ux-history.md:362` pedia a ficha técnica "colapsável, calma"; o código entrega `TechnicalSheet` como **Card sempre aberto**, e ainda pendura nela a ressalva do relógio do aparelho (decisão F2). Diga no desenho qual das duas vence.

## O que já existe hoje (não invente do zero — corrija)
Ordem atual, de cima para baixo (celular):

| # | Bloco | Forma hoje | Observação |
|---|---|---|---|
| 1 | Link "Voltar" (com seta) | link discreto, cor `--text-muted` | volta para a lista |
| 2 | Título da página | cabeçalho com o rótulo do registro, ou o nome capturado da origem, ou "Cálculo avulso" | |
| 3 | Badge de sincronização | badge solto, sem card, só quando ≠ sincronizado | tom `danger` se falhou, `info` nos demais |
| 4 | **Card da alegação** | "Cotado em 14/08/2026 às 19:32" · "Valor cotado" + **R$ 196,44** · "preço de varejo" · "Validade da proposta: 7 dias" | número em negrito tabular, **sem** PriceHero |
| 5 | Banner "Premium pausado" | alerta `info` | só quando o plano está pausado |
| 6 | Barra gerenciar | [Editar rótulo] [Excluir], botões secundários pequenos | só com Premium **ativo** e registro **sincronizado** |
| 7 | Alerta de sincronização | alerta com título + corpo + ações | só quando ≠ sincronizado |
| 8 | Legendas congeladas | "Valores congelados em 14/08/2026" (+ a frase de reaproveitamento) | texto solto, caption, `--text-muted` |
| 9 | Peças do kit | bloco solto, título de seção em versalete | só em kit |
| 10 | Detalhamento | bloco solto com linhas rótulo→valor | **não** é Card |
| 11 | Custo total | linha de breakdown com ênfase de total | |
| 12 | Preços por canal | bloco solto, um agrupamento por canal | **não** é Card |
| 13 | **Card** Ficha técnica | sempre aberto | |
| 14 | Comparar com hoje | botão fantasma que vira Card com duas linhas | |
| 15 | Ações | [Recalcular hoje] [Exportar], lado a lado, quebrando linha | **no fim de um scroll longo** |

→ **As duas ações primárias morrem no fim do scroll.** No celular, quem quer exportar rola por detalhamento, canais e ficha técnica antes de encontrar [Exportar]. O desenho do dono para o desktop já resolveu isso: a barra [Exportar] [Recalcular hoje] [Comparar com hoje] [Excluir] fica **logo abaixo do card da alegação**, separada por uma linha. Resolva também no celular.
→ **A hierarquia visual é acidental**: alegação e ficha técnica são Card; detalhamento, peças e canais são texto solto. Não há regra por trás disso — só a ordem em que foram escritos. Decida o que é superfície elevada e o que é texto corrido, e seja consistente.
→ **O valor cotado compete com o detalhamento**: os dois usam número em negrito e tabular. O valor cotado é a alegação; o detalhamento é prova. Isso precisa aparecer no peso, **sem** promover o congelado a PriceHero.
→ **O badge solto (3) flutua** entre título e card, sem âncora — e repete, em duas palavras, o que o alerta (7) diz em duas frases.
→ **A ficha técnica sempre aberta** empurra o comparar e as ações mais cinco linhas para baixo.

## Conteúdo e dados reais
Textos literais (não reescreva o que já foi homologado):
- "Voltar" · "Valor cotado" · "preço de varejo" / "preço de atacado" · "Cotado em {data} às {hora}" · "Validade da proposta: {n} dias"
- "Valores congelados em {data}" · "Estes valores foram reaproveitados de um congelamento anterior — a origem não estava disponível para repreçar."
- Seções: "Peças do kit" · "Detalhamento" · "Preços por canal" · "Ficha técnica"
- Detalhamento: "Material" · "Energia" · "Máquina" · "Falha / perdas" · "Acabamento" · "Mão de obra" · linhas de outros custos com o nome que o vendedor deu ("Embalagem") · "Custo total"
- Canal: "Mercado Livre" / "Shopee" / "Amazon" / "Outro" / "Canal" · "Preço para anunciar · Varejo" · "Recebido líquido · Varejo" (idem Atacado) · "sem comissão informada — este canal não teve preço" · "{n} de {total} peças"
- Kit: "{n} un" — uma **contagem**, nunca "3×", porque o total ao lado já está multiplicado
- Ficha técnica: "Calculado com a fórmula versão 2026.08" · "Registro criado a partir de: {nome}" · "Abrir produto" / "Abrir kit" · "Este registro guarda os valores como foram calculados naquele dia. Ele não muda quando você edita o catálogo nem quando a fórmula do app é atualizada." · "Data registrada pelo seu aparelho no momento da cotação."
- Ações: "Recalcular hoje" · "Exportar" · "Comparar com hoje" · "Editar rótulo" · "Excluir"

Números verdadeiros para popular as pranchetas (são os do canvas do dono): Valor cotado **R$ 196,44** (varejo) · Material R$ 3,78 · Energia R$ 0,36 · Máquina R$ 3,55 · Falha / perdas R$ 0,77 · Acabamento R$ 4,69 · Mão de obra R$ 6,19 · Embalagem R$ 2,50 · **Custo total R$ 21,84** · Mercado Livre: anúncio R$ 231,88 / líquido R$ 196,44 · Shopee: anúncio R$ 252,84 / líquido R$ 196,44. Validade 7 dias.
Regras dos dados: **linha ausente nunca vira R$ 0,00** — se o vendedor não cobrou acabamento, a linha simplesmente não existe; um preço de canal vazio some, não vira zero. O rótulo do registro é texto livre, opcional, até 120 caracteres (sem rótulo, o título é o nome capturado da origem; sem origem, "Cálculo avulso").

## Estados obrigatórios
- **Carregando**: indicador centrado, com o "Voltar" e o cabeçalho já no lugar.
- **Erro de leitura (frio)**: alerta `danger` "Não foi possível carregar seus orçamentos." + botão "Tentar novamente". **Nunca** "não encontrado" — dizer que o orçamento sumiu quando o que falhou foi a leitura é uma mentira cara.
- **Registro inexistente**: alerta `info` "Registro não encontrado." (sem botão).
- **Pronto e sincronizado**: sem badge, sem alerta — a maioria dos casos.
- **Pendente**: badge "Pendente neste dispositivo" + alerta `info` "Ainda não sincronizado" / "Este registro está só neste dispositivo e ainda não chegou à sua conta. Ele sincroniza sozinho quando você voltar a ficar online." + a linha muted da durabilidade ("Enquanto não sincroniza, ele existe só aqui — se os dados do app forem limpos, ele se perde.") + [Descartar] (e [Tentar agora] quando online).
- **Envio pausado (Premium)**: badge "Envio pausado · precisa de Premium" + alerta `info` "Envio pausado".
- **Sessão expirada**: badge "Envio pausado · sessão expirada" + alerta `info` "Sessão expirada" + botão secundário "Entrar de novo". Nunca fale em conexão aqui.
- **Falhou**: badge "Não foi possível registrar" + alerta `danger` de mesmo título + código de suporte em caption + [Tentar novamente] [Descartar].
- **Premium pausado (lapsed)**: alerta `info` "Premium pausado — seus registros continuam aqui e podem ser abertos. Para salvar, renomear, excluir ou exportar, reative o Premium." A barra [Editar rótulo]/[Excluir] **desaparece**; [Exportar] fica desabilitado com "Exportar precisa do Premium ativo." **abaixo do botão, em texto legível** — não é tooltip, porque no toque não há hover.
- **Offline**: [Exportar] desabilitado com "Exportar precisa de conexão."; com o comparar aberto, a linha "Sem conexão: usando os valores do catálogo salvos neste aparelho, que podem estar desatualizados."
- **Comparar**: fechado (botão fantasma) · aberto (duas linhas de **peso idêntico** — "Cotado em 14/08/2026" e "Hoje" — mais a nota "Comparação informativa: este registro não muda. Para gravar o valor de hoje, use \"Recalcular hoje\".") · indisponível ("Não foi possível calcular o valor de hoje para este registro com o seu catálogo atual.").
- **Documento ilegível** (payload de versão futura): os blocos 8–14 somem; cabeçalho, card da alegação e a linha de ações **permanecem**.
- **Foco / hover / pressionado** nos alvos: "Voltar", "Abrir produto/kit", cada botão e o link de entrar de novo — anel de foco visível sobre o fundo real de cada superfície.
- **Sem permissão** não é estado desta peça: o vendedor gratuito nunca chega aqui (o teaser barra antes, na lista).

## Viewports
- **390px (obrigatória)** — é a viewport nativa desta peça, e é exatamente onde a ordem de leitura foi inferida.
- **360px (estresse)** — o projeto já homologa jornadas a 360px; é ali que a linha de ações e os pares rótulo→valor quebram primeiro.
Não desenhe desktop aqui: acima de 1280px este conteúdo entra como coluna direita do mestre-detalhe, já desenhado no canvas do dono, e o corte é estrutural (abaixo dele o app nem monta a árvore de desktop).

## Regras que o desenho não pode quebrar
- **Zero recomputação, e isso é visível**: o valor congelado **não** usa o tratamento do preço vivo (nada de PriceHero, nada de destaque em cor de acento no total). Se aumentar o valor cotado, aumente por tipografia, não por cor.
- **Ausência não é zero**: nenhuma linha placeholder "R$ 0,00", nenhum travessão inventado no lugar de uma linha que não existe.
- **Procedência dita**: data, versão da fórmula e a ressalva do relógio do aparelho não podem sumir dentro de um acordeão fechado por padrão sem que alguém decida isso (ver Perguntas).
- **Degradação nunca escondida**: a frase de reaproveitamento e a de "sem comissão informada" são texto de leitura, em elemento de largura total, nunca truncadas.
- **Falha de rede nunca vendida como falta de Premium**, e vice-versa: são quatro alertas distintos, com quatro títulos distintos.
- **Alvos ≥44px** em "Voltar", nos botões da barra gerenciar e nas ações — inclusive quando a linha quebra em duas.
- **Contraste medido contra o fundo real** de cada bloco: o card da alegação, o alerta colorido e o fundo da página são três fundos diferentes.

## Armadilhas já pagas neste projeto
- **Overflow horizontal se mede, não se olha**: um rótulo longo ("Orçamento — Maria Aparecida, pedido #10482") no cabeçalho e um valor grande (**R$ 12.345,67**) na linha de "Valor cotado" já estouraram colunas neste app. Desenhe com esses valores, não com os curtos.
- **Frase honesta dentro de placeholder some**: honestidade mora em elemento de largura total, nunca como sufixo cortado de um campo.
- **Texto ocluso passa em teste**: um bloco empurrado para fora ou coberto continua "visível" para as asserções — a prova é geométrica, então dê margens que sobrevivam a 360px.
- **Duas ações no fim de um scroll longo** já foi medido como o defeito desta tela; não repita por inércia de implementação.
- **Badge e alerta dizendo a mesma coisa** é ruído: decida qual carrega o estado de sincronização.

## Entregável
Pranchetas a 390px (com as quebras críticas repetidas a 360px), **tema escuro como padrão e tema claro como first-class**:
1. Peça única, sincronizada, com dois canais — a prancheta canônica, com a ordem de leitura redesenhada.
2. Kit, com "Peças do kit" (3 linhas, "{n} un") e o rollup "{n} de {total} peças" em um canal.
3. Premium pausado: banner, barra gerenciar ausente, Exportar desabilitado com a razão em texto.
4. Pendente e offline: badge, alerta, linha de durabilidade e [Descartar].
5. Comparar com hoje aberto, com as duas linhas de mesmo peso e a nota informativa.
6. Carregando e erro de leitura, lado a lado.
Reutilize os primitivos existentes, sem criar novos: `tf-card` no card da alegação e na ficha técnica, `tf-alert` (tons `info` e `danger`) nos quatro alertas, `tf-badge` no estado de sincronização, `tf-brow` / `tf-brow--total` nas linhas de detalhamento e no custo total, `tf-btn` (`--primary`, `--secondary`, `--ghost`, `--danger-ghost`, `--sm`) nas ações, `tf-historico__section` nos títulos de seção, `tf-historico__meta` nas legendas e `tf-tnum` em todo dinheiro. Marque explicitamente na entrega qual bloco virou Card e qual virou texto corrido — é a decisão central que este prompt pede.

## Perguntas em aberto para o dono
1. **Ficha técnica: Card aberto ou colapsável?** A spec pedia "colapsável, calma"; o código entrega sempre aberto. Qual vence — e, se colapsar, a ressalva do relógio do aparelho (decisão F2) fica visível ou colapsa junto?
2. **A barra de ações sobe para logo abaixo da alegação, como no seu canvas de desktop?** E, se subir, "Excluir" entra nela no celular (hoje mora numa barra separada, acima) ou continua apartado de [Exportar]/[Recalcular hoje]?
3. **"Comparar com hoje" é um botão ou um bloco já aberto?** Hoje é um botão fantasma solto no meio da página, sem seção que o anuncie.
