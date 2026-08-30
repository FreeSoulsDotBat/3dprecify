# Prompts de Claude Design — superfícies de UI que nunca foram prototipadas

Cada arquivo desta pasta é **um prompt autocontido**: abra, copie tudo, cole no Claude Design.

## O que cada arquivo contém

| Parte | Conteúdo | Fonte |
|---|---|---|
| **Contexto 1** | O que a plataforma é e faz — produto, público, as 5 abas, o modelo de preço, os canais de marketplace, a fronteira do Premium e os estados reais (offline, Premium pausado, sessão expirada, degradação) | `_CONTEXTO-1-PLATAFORMA.md` |
| **Contexto 2** | Onde a peça vive — o mapa funcional da área e o ponto exato de inserção: rota, como o vendedor chega, vizinhança, dados que entram e saem, o que acontece depois | `_contextos/<area>.json` |
| **Contexto 3** | As regras — marca, tokens dos dois temas, tipografia, geometria, os primitivos `tf-*` que já existem, WCAG 2.2 AA e as regras de honestidade | `_CONTEXTO-3-REGRAS.md` |
| **O pedido** | O desenho pedido: o que já existe hoje, dados e textos literais, estados obrigatórios, viewports, armadilhas já pagas, entregável e perguntas ao dono | `_corpos/<id>.md` |

Contexto 2 disponível para **8 de 8** áreas.

## De onde veio esta lista

Auditoria de 16 agentes (8 mapeadores + 8 verificadores adversariais) sobre o repositório inteiro,
confrontando cada superfície de UI existente contra as **três** autoridades de design que o projeto tem:

1. `docs/design/prompts/claude-design-prototype.md` §E — o protótipo clicável de 2026-07-02 (E1–E9,
   com checkout explicitamente FORA de escopo);
2. `.design-import/` — o DS exportado + 6 telas-esqueleto (59–131 linhas cada) + 2 componentes;
3. `specs/018-abas-desktop/design/Abas-Desktop.dc.html` — o canvas do dono: rail + as 4 abas **desktop**.

**163 candidatas examinadas · 157 confirmadas sem protótipo · 6 derrubadas** pelos
verificadores (estavam desenhadas e o mapeador errou).

Prioridade: **62 ALTA · 80 MEDIA · 15 BAIXA**.

> Uma spec `ux-*.md` escrita pelo subagente `designer-ux` **não** conta como protótipo — é inferência de
> IA em prosa. Screenshot de homologação também não: prova que a tela existe, nunca que houve desenho
> antes dela.

## Antes de rodar os prompts

Leia **[PERGUNTAS-AO-DONO.md](PERGUNTAS-AO-DONO.md)** — 605 decisões de produto que os prompts não
puderam tomar no seu lugar (rótulo ambíguo, hierarquia entre dois avisos, regra que nunca foi escrita).
Cada prompt roda sem elas, mas responder as da sua área antes economiza uma rodada de redesenho.

## Calculadora e precificação (27)

| Prioridade | Escala | Prompt | O quê |
|---|---|---|---|
| ALTA | ESTADO | [`avisos-de-plausibilidade-nos-campos`](calculadora/avisos-de-plausibilidade-nos-campos.md) | Avisos de plausibilidade por campo (aviso que não é erro) |
| ALTA | TELA | [`calcular-desktop-duas-colunas`](calculadora/calcular-desktop-duas-colunas.md) | Calcular no desktop — grade de duas colunas + rodapé centralizado |
| ALTA | ESTADO | [`campo-de-taxa-pre-preenchido-pelo-catalogo`](calculadora/campo-de-taxa-pre-preenchido-pelo-catalogo.md) | Campo de taxa com valor do catálogo no placeholder + legendas de faixa e regra |
| ALTA | BLOCO | [`cartao-de-canal`](calculadora/cartao-de-canal.md) | Cartão de um canal — composição, ordem e densidade |
| ALTA | ESTADO | [`estados-de-preco-por-canal`](calculadora/estados-de-preco-por-canal.md) | Estados de um canal sem preço: faixa sem tarifa, líquido negativo, sem comissão, canal com erro |
| ALTA | BLOCO | [`gate-premium-do-marketplace`](calculadora/gate-premium-do-marketplace.md) | Gate Premium da seção Marketplace na conta grátis |
| ALTA | BLOCO | [`pergunta-de-custo-de-maquina`](calculadora/pergunta-de-custo-de-maquina.md) | Bloco “quanto custa a máquina” — ritmo + payback + custo/hora derivado + modo ajustar |
| ALTA | BLOCO | [`precos-por-canal`](calculadora/precos-por-canal.md) | Bloco “Preços por canal” dentro de “Como chegamos no preço” |
| ALTA | BLOCO | [`secao-custos-da-peca`](calculadora/secao-custos-da-peca.md) | Seção “Custos da peça” — grade fundida de campos obrigatórios e opcionais |
| ALTA | BLOCO | [`secao-marketplace-multicanal`](calculadora/secao-marketplace-multicanal.md) | Seção Marketplace — chave “Incluir marketplaces no preço” e canais repetíveis |
| ALTA | COMPONENTE | [`seletor-de-categoria`](calculadora/seletor-de-categoria.md) | Seletor de categoria do marketplace — busca, contagem, resultados e árvore |
| ALTA | COMPONENTE | [`selo-de-vigencia-de-tarifa`](calculadora/selo-de-vigencia-de-tarifa.md) | Selo de origem e vigência da tarifa (e o selo separado da taxa fixa) |
| MEDIA | ESTADO | [`avisos-do-resultado`](calculadora/avisos-do-resultado.md) | Avisos que só o resultado denuncia (preço zero, custo absurdo, atacado acima do varejo) |
| MEDIA | BLOCO | [`avisos-shopee`](calculadora/avisos-shopee.md) | Os dois avisos honestos da Shopee (taxa não publicada e frete aferido) |
| MEDIA | BLOCO | [`bloco-usar-do-catalogo`](calculadora/bloco-usar-do-catalogo.md) | Bloco “Usar do catálogo” na Calcular e seus três estados |
| MEDIA | COMPONENTE | [`campo-tempo-h-min`](calculadora/campo-tempo-h-min.md) | Campo de tempo de impressão em horas + minutos |
| MEDIA | BLOCO | [`conta-item-a-item-e-cartoes-de-preco`](calculadora/conta-item-a-item-e-cartoes-de-preco.md) | “Como chegamos no preço” e os dois cartões de preço final |
| MEDIA | COMPONENTE | [`dicas-info-nas-secoes-e-campos`](calculadora/dicas-info-nas-secoes-e-campos.md) | Dicas ⓘ nos títulos de seção e nos rótulos de campo |
| MEDIA | ESTADO | [`estado-formulario-invalido`](calculadora/estado-formulario-invalido.md) | Estado “não dá para calcular” — o resultado inteiro substituído por um alerta |
| MEDIA | ESTADO | [`falha-de-atualizacao-do-catalogo-de-tarifas`](calculadora/falha-de-atualizacao-do-catalogo-de-tarifas.md) | Estado de falha (não bloqueante) na atualização do catálogo de tarifas |
| MEDIA | ESTADO | [`info-subsidio-de-frete-shopee`](calculadora/info-subsidio-de-frete-shopee.md) | Informação do subsídio de frete da Shopee sob a grade de taxas |
| MEDIA | COMPONENTE | [`perguntas-de-perfil-do-vendedor`](calculadora/perguntas-de-perfil-do-vendedor.md) | Perguntas de perfil do vendedor (CPF/CNPJ e alto volume) |
| MEDIA | BLOCO | [`resumo-de-kit-como-base`](calculadora/resumo-de-kit-como-base.md) | Resumo somente-leitura de um kit como base do cálculo |
| MEDIA | BLOCO | [`secao-outros-custos`](calculadora/secao-outros-custos.md) | Seção “Outros custos” — linhas nomeadas adicionáveis |
| MEDIA | COMPONENTE | [`taxas-opcionais-do-canal`](calculadora/taxas-opcionais-do-canal.md) | Chaves de taxa opcional do canal (ex.: item volumoso) |
| MEDIA | BLOCO | [`topo-da-calcular`](calculadora/topo-da-calcular.md) | Topo da Calcular — título, promessa freemium e a porta “Meus cenários” |
| BAIXA | ESTADO | [`aviso-de-campo-aposentado`](calculadora/aviso-de-campo-aposentado.md) | Aviso persistente de campo aposentado ao reabrir uma simulação antiga |

## Catálogo (filamentos, impressoras, produtos) (20)

| Prioridade | Escala | Prompt | O quê |
|---|---|---|---|
| ALTA | COMPONENTE | [`cartao-da-lista-desktop-avisos`](catalogo/cartao-da-lista-desktop-avisos.md) | Cartão do item no desktop e seus avisos empilhados (somente leitura · desatualizada · precisa de atenção) |
| ALTA | COMPONENTE | [`dialogo-de-exclusao`](catalogo/dialogo-de-exclusao.md) | Confirmar exclusão de item do catálogo (com o aviso de produtos que o usam) |
| ALTA | TELA | [`editor-de-produto-pagina-cheia`](catalogo/editor-de-produto-pagina-cheia.md) | Editor de produto em página cheia (cabeçalho, cartão de nome + salvar, corpo em duas colunas) |
| ALTA | BLOCO | [`ficha-resumo-produto-kit-desktop`](catalogo/ficha-resumo-produto-kit-desktop.md) | Ficha de resumo de Produto/Kit no desktop (coluna direita que não edita) |
| ALTA | BLOCO | [`lista-catalogo-mobile`](catalogo/lista-catalogo-mobile.md) | Lista do Catálogo no mobile (linha do item + contagem + botão adicionar) |
| ALTA | ESTADO | [`premium-pausado-somente-leitura`](catalogo/premium-pausado-somente-leitura.md) | Premium pausado no Catálogo (faixa calma, formulário inerte e a linha de reativação) |
| MEDIA | BLOCO | [`barra-de-ferramentas-mestre-desktop`](catalogo/barra-de-ferramentas-mestre-desktop.md) | Barra de ferramentas da lista no desktop (busca + contagem + adicionar) |
| MEDIA | ESTADO | [`erro-de-carga-e-tentar-novamente`](catalogo/erro-de-carga-e-tentar-novamente.md) | Erro ao carregar o Catálogo (alerta + "Tentar novamente") |
| MEDIA | ESTADO | [`estado-de-carregamento-catalogo`](catalogo/estado-de-carregamento-catalogo.md) | Carregando o Catálogo (spinner centralizado onde havia skeleton) |
| MEDIA | ESTADO | [`estado-precisa-de-atencao`](catalogo/estado-precisa-de-atencao.md) | Estado "precisa de atenção" / referência manual do produto |
| MEDIA | ESTADO | [`estado-vazio-por-secao`](catalogo/estado-vazio-por-secao.md) | Estado vazio por seção do Catálogo (nenhum filamento/impressora/produto salvo) |
| MEDIA | BLOCO | [`folha-criar-editar-mobile`](catalogo/folha-criar-editar-mobile.md) | Folha (Sheet) de criar/editar filamento e impressora no mobile |
| MEDIA | BLOCO | [`formulario-filamento`](catalogo/formulario-filamento.md) | Formulário de filamento (Nome · Material · Custo do rolo · Peso do rolo) |
| MEDIA | BLOCO | [`formulario-impressora`](catalogo/formulario-impressora.md) | Formulário de impressora (5 campos, com dica de consumo e um campo opcional) |
| MEDIA | ESTADO | [`leitura-offline-desatualizada`](catalogo/leitura-offline-desatualizada.md) | Leitura offline do Catálogo (faixa "Modo leitura offline" + "pode estar desatualizada" por item) |
| MEDIA | ESTADO | [`recados-do-editor-de-produto`](catalogo/recados-do-editor-de-produto.md) | Telas de recado do editor de produto (pré-requisito e produto não encontrado) |
| MEDIA | BLOCO | [`rodape-do-editor-de-produto`](catalogo/rodape-do-editor-de-produto.md) | Rodapé do editor de produto (preço recalculado + registrar orçamento + salvar simulação) |
| MEDIA | BLOCO | [`seletor-de-filamento-e-impressora`](catalogo/seletor-de-filamento-e-impressora.md) | Seletor de filamento e impressora do produto (com a opção "— Manual —") |
| MEDIA | ESTADO | [`vazio-da-busca`](catalogo/vazio-da-busca.md) | Estado "nada encontrado" da busca do Catálogo |
| BAIXA | COMPONENTE | [`abas-de-secao-mobile`](catalogo/abas-de-secao-mobile.md) | Abas de seção do Catálogo no mobile (Filamentos · Impressoras · Produtos · Kits) |

## Kits / BOM multi-peça (17)

| Prioridade | Escala | Prompt | O quê |
|---|---|---|---|
| ALTA | TELA | [`composer-kits-mobile`](kits/composer-kits-mobile.md) | Compositor de kits em mobile (a tela /kits inteira abaixo de 1280px) |
| ALTA | BLOCO | [`editor-de-linha-expandido`](kits/editor-de-linha-expandido.md) | Editor da peça expandido dentro da linha (formulário completo da calculadora aninhado) |
| ALTA | COMPONENTE | [`linha-do-kit-card-recolhido`](kits/linha-do-kit-card-recolhido.md) | Card da peça recolhido (a linha do kit) |
| ALTA | BLOCO | [`recibo-de-materializacao`](kits/recibo-de-materializacao.md) | Recibo 'O que este kit fez no seu catálogo' (pós-salvamento) |
| ALTA | COMPONENTE | [`registrar-orcamento-a-partir-do-kit`](kits/registrar-orcamento-a-partir-do-kit.md) | Ação 'Salvar em Orçamentos' dentro do compositor de kits |
| ALTA | BLOCO | [`seletor-produto-salvo-na-linha`](kits/seletor-produto-salvo-na-linha.md) | Seletor 'Usar produto salvo' e o selo de origem da peça |
| MEDIA | BLOCO | [`aba-kits-no-catalogo`](kits/aba-kits-no-catalogo.md) | Aba Kits dentro do Catálogo (lista de kits salvos e a ficha do kit) |
| MEDIA | ESTADO | [`estado-vazio-do-compositor`](kits/estado-vazio-do-compositor.md) | Estado vazio do compositor de kits |
| MEDIA | ESTADO | [`estados-de-verificacao-de-plano-kits`](kits/estados-de-verificacao-de-plano-kits.md) | Estados de verificação de plano na aba Kits (checando e parede de erro) |
| MEDIA | TELA | [`kits-desktop-duas-colunas`](kits/kits-desktop-duas-colunas.md) | Composição desktop de Kits em duas colunas (o que o canvas cobriu — e o que sobrou inferido) |
| MEDIA | ESTADO | [`kits-premium-pausado`](kits/kits-premium-pausado.md) | Superfícies de Premium pausado em Kits (painel de reativação e faixa no kit reaberto) |
| MEDIA | ESTADO | [`linha-degradada-produto-removido`](kits/linha-degradada-produto-removido.md) | Peça degradada (produto referenciado apagado depois do salvamento) |
| MEDIA | BLOCO | [`nome-da-peca-no-catalogo`](kits/nome-da-peca-no-catalogo.md) | Campo 'Nome da peça no catálogo' e o aviso de que a peça vira produto |
| MEDIA | ESTADO | [`resumo-sem-preco-ainda`](kits/resumo-sem-preco-ainda.md) | Estado 'Sem preço ainda' do Total do kit |
| MEDIA | BLOCO | [`rollup-precos-por-canal-kit`](kits/rollup-precos-por-canal-kit.md) | Cartão 'Preços por canal (kit)' |
| BAIXA | ESTADO | [`aviso-catalogo-de-tarifas-em-kits`](kits/aviso-catalogo-de-tarifas-em-kits.md) | Aviso de falha ao atualizar o catálogo de tarifas na tela de kits |
| BAIXA | COMPONENTE | [`quantidade-e-avisos-da-peca`](kits/quantidade-e-avisos-da-peca.md) | Controle de quantidade e seus avisos (zero e limite do banco) |

## Orçamentos (registros congelados, exportação, comparação) (21)

| Prioridade | Escala | Prompt | O quê |
|---|---|---|---|
| ALTA | ESTADO | [`alerta-de-sincronizacao-no-detalhe`](orcamentos/alerta-de-sincronizacao-no-detalhe.md) | Alerta de estado do registro não sincronizado (4 estados) |
| ALTA | BLOCO | [`banner-agregado-da-fila`](orcamentos/banner-agregado-da-fila.md) | Banner agregado da fila (5 redações, [Ver], [Entrar de novo], [Sincronizar agora]) |
| ALTA | BLOCO | [`bloco-comparar-com-hoje`](orcamentos/bloco-comparar-com-hoje.md) | Bloco "Comparar com hoje" (então vs. hoje) |
| ALTA | TELA | [`detalhe-do-orcamento-mobile`](orcamentos/detalhe-do-orcamento-mobile.md) | Registro congelado em tela cheia (celular) |
| ALTA | BLOCO | [`folha-de-exportacao`](orcamentos/folha-de-exportacao.md) | Folha de exportação PDF/CSV + o botão desabilitado com motivo |
| ALTA | BLOCO | [`folha-salvar-em-orcamentos`](orcamentos/folha-salvar-em-orcamentos.md) | Folha "Salvar em Orçamentos" (onde o registro nasce) |
| ALTA | TELA | [`lista-de-orcamentos-mobile`](orcamentos/lista-de-orcamentos-mobile.md) | Aba Orçamentos no celular (lista completa, 390px) |
| MEDIA | COMPONENTE | [`acoes-de-registro-travado`](orcamentos/acoes-de-registro-travado.md) | Ações do registro travado ([Tentar novamente] / [Descartar] + confirmação) |
| MEDIA | ESTADO | [`avisos-de-topo-da-lista`](orcamentos/avisos-de-topo-da-lista.md) | Avisos de topo: leitura offline, erro de carga com retry inline, Premium pausado |
| MEDIA | BLOCO | [`barra-de-filtros-orcamentos-mobile`](orcamentos/barra-de-filtros-orcamentos-mobile.md) | Barra de filtros da lista no celular (busca + chips de período + chip ativo) |
| MEDIA | BLOCO | [`bloco-pecas-do-kit-no-orcamento`](orcamentos/bloco-pecas-do-kit-no-orcamento.md) | Bloco "Peças do kit" dentro do registro congelado |
| MEDIA | BLOCO | [`bloco-precos-por-canal-congelado`](orcamentos/bloco-precos-por-canal-congelado.md) | Preços por canal no registro congelado (e seus três estados honestos) |
| MEDIA | BLOCO | [`dialogo-recalcular-hoje`](orcamentos/dialogo-recalcular-hoje.md) | Diálogo de confirmação "Recalcular hoje" |
| MEDIA | BLOCO | [`dialogo-sair-com-fila-pendente`](orcamentos/dialogo-sair-com-fila-pendente.md) | Diálogo de sair com registros na fila (+ confirmação destrutiva + falha parcial) |
| MEDIA | BLOCO | [`dialogos-renomear-e-excluir-registro`](orcamentos/dialogos-renomear-e-excluir-registro.md) | Barra gerenciar: diálogos de renomear rótulo e excluir registro |
| MEDIA | ESTADO | [`estado-busca-sem-resultado`](orcamentos/estado-busca-sem-resultado.md) | Estado "nenhum registro encontrado para {termo}" |
| MEDIA | BLOCO | [`folha-periodo-personalizado`](orcamentos/folha-periodo-personalizado.md) | Folha "Período…" (intervalo de datas) |
| MEDIA | BLOCO | [`mestre-detalhe-larguras-1280-1440`](orcamentos/mestre-detalhe-larguras-1280-1440.md) | Mestre-detalhe do desktop entre 1280 e 1440px |
| BAIXA | ESTADO | [`avisos-de-documento-repreçado`](orcamentos/avisos-de-documento-repreçado.md) | Avisos de honestidade sobre o documento repreçado (reaproveitado / modelo aposentado) |
| BAIXA | ESTADO | [`porta-do-plano-verificando-e-erro`](orcamentos/porta-do-plano-verificando-e-erro.md) | Porta do plano: "verificando" e "não foi possível verificar seu plano" |
| BAIXA | ESTADO | [`transicao-pendente-para-sincronizado`](orcamentos/transicao-pendente-para-sincronizado.md) | Momento em que o registro pendente vira sincronizado |

## Simulações salvas (cenários de marketplace) (20)

| Prioridade | Escala | Prompt | O quê |
|---|---|---|---|
| ALTA | COMPONENTE | [`acoes-do-cartao-renomear-duplicar-excluir`](simulacoes/acoes-do-cartao-renomear-duplicar-excluir.md) | Linha de ações do cartão (renomear · duplicar · excluir) |
| ALTA | BLOCO | [`barra-de-contexto-simulacao-carregada`](simulacoes/barra-de-contexto-simulacao-carregada.md) | Barra de contexto "Simulação: {nome}" (com a simulação aberta) |
| ALTA | COMPONENTE | [`botao-salvar-simulacao-no-calcular`](simulacoes/botao-salvar-simulacao-no-calcular.md) | Botão "Salvar simulação" abaixo do resultado, colado no "Salvar no histórico" |
| ALTA | BLOCO | [`cartao-de-simulacao`](simulacoes/cartao-de-simulacao.md) | Cartão de simulação na lista |
| ALTA | ESTADO | [`congelamento-de-escrita-premium-pausado-e-offline`](simulacoes/congelamento-de-escrita-premium-pausado-e-offline.md) | Congelamento de escrita — "Premium pausado" (lapsado) e offline |
| ALTA | ESTADO | [`duplicar-para-ajustar`](simulacoes/duplicar-para-ajustar.md) | Duplicar-para-ajustar (o movimento central do E5) |
| ALTA | COMPONENTE | [`entrada-minhas-simulacoes-no-calcular`](simulacoes/entrada-minhas-simulacoes-no-calcular.md) | Entrada "Minhas simulações" no topo do Calcular |
| ALTA | TELA | [`folha-minhas-simulacoes`](simulacoes/folha-minhas-simulacoes.md) | Folha "Minhas simulações" (a lista inteira) |
| ALTA | BLOCO | [`folha-salvar-simulacao`](simulacoes/folha-salvar-simulacao.md) | Folha "Salvar simulação" (nome · nota · eco da base de custo) |
| ALTA | BLOCO | [`resumo-de-kit-na-simulacao-reaberta`](simulacoes/resumo-de-kit-na-simulacao-reaberta.md) | Resumo somente-leitura de simulação com base KIT |
| ALTA | TELA | [`simulacoes-no-desktop`](simulacoes/simulacoes-no-desktop.md) | Toda a área de Simulações em tela larga (≥1280px) |
| MEDIA | ESTADO | [`aviso-de-campo-aposentado-na-simulacao`](simulacoes/aviso-de-campo-aposentado-na-simulacao.md) | Aviso de campo aposentado numa simulação antiga |
| MEDIA | BLOCO | [`busca-de-simulacoes`](simulacoes/busca-de-simulacoes.md) | Campo de busca por nome + estado "nada encontrado" |
| MEDIA | ESTADO | [`dialogo-descartar-alteracoes`](simulacoes/dialogo-descartar-alteracoes.md) | Confirmação de descarte ao fechar com alterações não salvas |
| MEDIA | ESTADO | [`estado-vazio-primeira-simulacao`](simulacoes/estado-vazio-primeira-simulacao.md) | Estado vazio — nenhuma simulação salva ainda |
| MEDIA | ESTADO | [`estados-da-lista-de-simulacoes`](simulacoes/estados-da-lista-de-simulacoes.md) | Estados da lista: carregando · erro frio · cache offline · paginação |
| MEDIA | BLOCO | [`folhas-de-renomear-simulacao`](simulacoes/folhas-de-renomear-simulacao.md) | Renomear simulação — duas folhas diferentes para a mesma ação |
| MEDIA | COMPONENTE | [`registrar-orcamento-a-partir-da-simulacao`](simulacoes/registrar-orcamento-a-partir-da-simulacao.md) | Registrar orçamento a partir de uma simulação (ponte E5→E4) |
| MEDIA | COMPONENTE | [`salvar-simulacao-na-ficha-do-produto`](simulacoes/salvar-simulacao-na-ficha-do-produto.md) | "Salvar simulação" dentro da ficha de produto do Catálogo |
| MEDIA | ESTADO | [`teaser-premium-dentro-da-folha-de-simulacoes`](simulacoes/teaser-premium-dentro-da-folha-de-simulacoes.md) | Porta honesta para grátis / deslogado dentro da folha de Simulações |

## Billing, planos e Conta (19)

| Prioridade | Escala | Prompt | O quê |
|---|---|---|---|
| ALTA | ESTADO | [`cta-assinar-estados`](billing/cta-assinar-estados.md) | Botão "Assinar Premium" — estados pendente, conflito e indisponível |
| ALTA | BLOCO | [`dialogo-cancelar-assinatura`](billing/dialogo-cancelar-assinatura.md) | Diálogo de cancelamento da assinatura |
| ALTA | BLOCO | [`gate-marketplace-faixa-de-preco`](billing/gate-marketplace-faixa-de-preco.md) | Gate de Marketplace na calculadora — interruptor desligado + faixa de preço e "Assinar" |
| ALTA | BLOCO | [`oferta-mobile-gaveta`](billing/oferta-mobile-gaveta.md) | Oferta de planos em GAVETA (mobile / < 1280px) |
| ALTA | ESTADO | [`plano-estado-cancelamento-agendado`](billing/plano-estado-cancelamento-agendado.md) | Linha do plano na Conta — CANCELAMENTO AGENDADO ("ativo até {data} · não renova") |
| ALTA | ESTADO | [`plano-estado-carencia`](billing/plano-estado-carencia.md) | Linha do plano na Conta — estado de CARÊNCIA (pagamento recusado, prazo correndo) |
| ALTA | ESTADO | [`plano-estado-pausado`](billing/plano-estado-pausado.md) | Linha do plano na Conta — "Premium pausado" (grant caducado, leitura congelada) |
| ALTA | TELA | [`retorno-checkout-aguardando`](billing/retorno-checkout-aguardando.md) | Retorno do checkout — "Confirmando seu pagamento…" (espera com sondagem limitada) |
| ALTA | TELA | [`retorno-checkout-nao-confirmado`](billing/retorno-checkout-nao-confirmado.md) | Retorno do checkout — "Ainda não recebemos a confirmação" (paciência esgotada) |
| ALTA | TELA | [`retorno-checkout-sucesso`](billing/retorno-checkout-sucesso.md) | Retorno do checkout — "Premium ativo!" (confirmação de compra) |
| MEDIA | BLOCO | [`aviso-hand-off-pagamento`](billing/aviso-hand-off-pagamento.md) | Aviso de hand-off ("Você paga no Mercado Pago (Pix ou cartão)" · "O cartão nunca passa pelo nosso app") |
| MEDIA | TELA | [`conta-mobile-empilhada`](billing/conta-mobile-empilhada.md) | Aba Conta no MOBILE (coluna única, < 1280px) |
| MEDIA | ESTADO | [`identidade-carregando-e-erro`](billing/identidade-carregando-e-erro.md) | Cartão de identidade da Conta — estados carregando e erro (sessão expirada / falha) |
| MEDIA | ESTADO | [`plano-estado-cortesia`](billing/plano-estado-cortesia.md) | Linha do plano na Conta — CORTESIA / programa beta (grant de operador) |
| MEDIA | ESTADO | [`plano-estado-desconhecido-e-defasado`](billing/plano-estado-desconhecido-e-defasado.md) | Linha do plano na Conta — plano NÃO CONFIRMADO e selo de dado defasado (offline) |
| MEDIA | BLOCO | [`teaser-picker-calculadora`](billing/teaser-picker-calculadora.md) | Teaser do "Usar do catálogo" na calculadora (com botão desabilitado visível) |
| MEDIA | BLOCO | [`teaser-simulacoes-na-folha`](billing/teaser-simulacoes-na-folha.md) | Teaser Premium dentro da folha de Simulações |
| BAIXA | ESTADO | [`oferta-ja-e-premium`](billing/oferta-ja-e-premium.md) | Oferta aberta por quem JÁ é Premium ("Você já é Premium.") |
| BAIXA | ESTADO | [`toast-cancelamento-confirmado`](billing/toast-cancelamento-confirmado.md) | Reconhecimento do cancelamento (toast "Assinatura cancelada. Premium ativo até {data}.") |

## Shell, navegação e telas transversais (12)

| Prioridade | Escala | Prompt | O quê |
|---|---|---|---|
| ALTA | BLOCO | [`banner-sessao-expirada`](shell/banner-sessao-expirada.md) | Faixa de sessão expirada ("Entrar de novo") |
| ALTA | BLOCO | [`dialogo-saida-fila-pendente`](shell/dialogo-saida-fila-pendente.md) | Diálogo de saída com orçamentos na fila |
| ALTA | TELA | [`entrar-dentro-do-shell`](shell/entrar-dentro-do-shell.md) | Tela Entrar emoldurada pelo shell (e sua versão desktop) |
| ALTA | ESTADO | [`shell-deslogado`](shell/shell-deslogado.md) | Shell no estado deslogado (sem identidade, sem "Entrar") |
| ALTA | BLOCO | [`tabbar-mobile-cinco-abas`](shell/tabbar-mobile-cinco-abas.md) | Barra de abas do mobile com 5 seções |
| MEDIA | TELA | [`erro-e-404-dentro-do-shell`](shell/erro-e-404-dentro-do-shell.md) | Telas de Erro e 404 emolduradas pelo shell |
| MEDIA | ESTADO | [`faixa-intermediaria-600-1023`](shell/faixa-intermediaria-600-1023.md) | Faixa intermediária 600–1023px (menu de 240px + coluna de 460px) |
| MEDIA | TELA | [`pagina-privacidade`](shell/pagina-privacidade.md) | Página "Como tratamos seus dados" (rota avulsa) |
| MEDIA | ESTADO | [`pilha-de-faixas-do-topo`](shell/pilha-de-faixas-do-topo.md) | Empilhamento das faixas de aviso no topo do shell |
| MEDIA | ESTADO | [`rail-forcado-426-599`](shell/rail-forcado-426-599.md) | Menu recolhido à força na faixa 426–599px |
| MEDIA | COMPONENTE | [`regiao-de-toasts`](shell/regiao-de-toasts.md) | Região de toasts (posição, empilhamento e dispensa) |
| MEDIA | BLOCO | [`top-bar-mobile`](shell/top-bar-mobile.md) | Barra superior do mobile (logo centralizado + Sair + tema) |

## Primitivos do Design System (21)

| Prioridade | Escala | Prompt | O quê |
|---|---|---|---|
| ALTA | COMPONENTE | [`campo-de-texto-sem-primitivo`](design-system/campo-de-texto-sem-primitivo.md) | Campo de texto — o primitivo que nunca foi construído |
| ALTA | ESTADO | [`densidade-desktop-dos-primitivos`](design-system/densidade-desktop-dos-primitivos.md) | Densidade dos primitivos no desktop (≥1280px) |
| ALTA | COMPONENTE | [`dialogo-modal-central`](design-system/dialogo-modal-central.md) | Diálogo modal central (confirmar / excluir / sair) |
| ALTA | COMPONENTE | [`folha-lateral-direita`](design-system/folha-lateral-direita.md) | Folha lateral (Sheet) que entra pela direita |
| ALTA | COMPONENTE | [`info-tip-de-ajuda`](design-system/info-tip-de-ajuda.md) | Dica de ajuda ⓘ (InfoTip) |
| MEDIA | ESTADO | [`anel-de-foco`](design-system/anel-de-foco.md) | O anel de foco — duas implementações e metade da espessura |
| MEDIA | ESTADO | [`botao-carregando-e-desabilitado`](design-system/botao-carregando-e-desabilitado.md) | Botão em carregamento, desabilitado e com brilho |
| MEDIA | ESTADO | [`campo-aviso-de-plausibilidade`](design-system/campo-aviso-de-plausibilidade.md) | Campo — a terceira camada de mensagem (aviso de plausibilidade) |
| MEDIA | ESTADO | [`estado-de-carregando`](design-system/estado-de-carregando.md) | Carregando — o giro que substituiu o esqueleto desenhado |
| MEDIA | BLOCO | [`estado-vazio`](design-system/estado-vazio.md) | Estado vazio (EmptyState) — a arte que virou ícone, e o vazio da busca |
| MEDIA | COMPONENTE | [`grupo-segmentado`](design-system/grupo-segmentado.md) | Grupo segmentado (bandeja com pílulas) |
| MEDIA | ESTADO | [`numberfield-mascara-de-milhar`](design-system/numberfield-mascara-de-milhar.md) | NumberField — a máscara de milhar que reescreve o valor ao sair do campo |
| MEDIA | ESTADO | [`price-hero-valor-que-nao-cabe`](design-system/price-hero-valor-que-nao-cabe.md) | PriceHero — o preço que não cabe (quebra, encolhe, rola) |
| MEDIA | COMPONENTE | [`selo-badge-e-tons`](design-system/selo-badge-e-tons.md) | Selo (Badge) — o selo Premium desenhado que não existe, e as exceções do selo de tarifa |
| MEDIA | COMPONENTE | [`torradeira-de-avisos`](design-system/torradeira-de-avisos.md) | Aviso efêmero (Toast) — posição, empilhamento e duração |
| BAIXA | COMPONENTE | [`alerta-tons-e-variante-compacta`](design-system/alerta-tons-e-variante-compacta.md) | Alerta em bloco — tons e a variante compacta |
| BAIXA | ESTADO | [`botao-destrutivo`](design-system/botao-destrutivo.md) | Botão destrutivo (danger e danger-ghost) |
| BAIXA | ESTADO | [`cartao-clicavel-e-selecionado`](design-system/cartao-clicavel-e-selecionado.md) | Cartão — o clicável, o selecionado e as variantes sem espelho |
| BAIXA | COMPONENTE | [`interruptor-de-tema`](design-system/interruptor-de-tema.md) | Interruptor (Switch) — a trilha, o polegar e o alvo escondido |
| BAIXA | ESTADO | [`linha-de-detalhamento`](design-system/linha-de-detalhamento.md) | Linha do detalhamento (BreakdownRow) — a ênfase negativa e o nome que o vendedor digita |
| BAIXA | COMPONENTE | [`select-nativo`](design-system/select-nativo.md) | Seletor (Select) — o cursor ▾ e o popup do sistema |

## Como regerar

```bash
node docs/design/prompts/inferidos/_montar.cjs
```

Edite `_corpos/<id>.md` (o pedido) ou os arquivos de contexto e rode de novo — os arquivos finais são
derivados. As fichas cruas da auditoria (o que foi inferido, o impacto, e a refutação adversarial de
cada achado) ficam em `_achados/<id>.json`.
