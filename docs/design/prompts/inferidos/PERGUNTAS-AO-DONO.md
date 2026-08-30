# Perguntas em aberto para o dono

Levantadas pelos 157 prompts de desenho desta pasta. Cada uma é uma decisão de **produto** que o código
não resolve e que a auditoria não pode tomar no seu lugar — quem responder muda o desenho. Elas também
estão no fim do prompt de origem; aqui ficam juntas para você despachar de uma vez.

**605 perguntas** em **132** das 157 superfícies.

## Calculadora e precificação (73)

### [Aviso de plausibilidade — a mensagem que avisa sem recusar](calculadora/avisos-de-plausibilidade-nos-campos.md)

- Quando o campo tem erro E aviso, o aviso deve mesmo sumir? (hoje a recusa come a dica inteira, e a lição de conversão evapora no caso 'vida útil = 0')
- O aviso aparece a cada tecla ou só no blur? (hoje pisca no meio da digitação de um número maior)
- O aviso pode ser dispensado ('entendi') e, se sim, volta ao redigitar o mesmo valor?
- Com três ou mais avisos, existe algum resumo (contador, marca de seção) — continuando não-bloqueante?
- O aviso de campo ganha ícone (igualando-se ao tf-alert--info do resultado) ou o de resultado perde o ícone? Hoje são duas línguas visuais para a mesma categoria.

### [Os dois avisos honestos da Shopee (taxa não publicada e frete aferido)](calculadora/avisos-shopee.md)

- Peso relativo: os dois avisos devem ter a mesma forma, ou é correto que o condicional pese mais que o permanente? A regra atual nunca foi escrita nem ratificada.
- O aviso do frete aferido pode ser dispensável/aparecer uma vez só, já que se repete em todo slot Shopee?
- O aviso da taxa regressiva deve migrar para junto do campo Comissão (a ação que ele pede), quebrando a ordem 'avisos por último'?

### [Calcular no desktop — as entradas em duas colunas e o preço no rodapé](calculadora/calcular-desktop-duas-colunas.md)

- O preço acompanha a rolagem? Hoje o resultado é rodapé — quem mexe no markup no fim de uma coluna de 2.500px não vê o número mudar. Painel fixo à direita, barra fixa no rodapé, ou fica onde está?
- O corte é em 1024px (esta tela) ou 1280px (o que o 018 fixou para as outras quatro abas)?
- A página continua parando em 1120px a 1920px, ou o conteúdo respira até o limite do shell?
- O cap de 720px do rodapé fica? Ele centraliza, mas joga fora ~400px de largura no bloco mais importante.
- Marketplace é mesmo vizinho de Markup na coluna direita, ou a direita deveria ser reservada ao resultado?
- 'Outros custos' trocar de coluna conforme a assinatura é intencional ou remendo? Quem assina vê a seção mudar de lugar.
- A §F.3 ('desktop 2 colunas' para Varejo × Atacado) segue valendo para os dois cartões de preço, ou foi substituída pelo empacotamento automático (auto-fit minmax(210px,1fr)) que o código faz hoje?

### [Campo de taxa que já está sendo cobrada pelo catálogo](calculadora/campo-de-taxa-pre-preenchido-pelo-catalogo.md)

- Placeholder cinza ou valor preenchido? O protótipo de 2026-07-02 mandava preencher (R$ 6,75 + 14%); o código escolheu placeholder para que o marcador 'ajustado por você'/overridden não minta — qual convenção vale, e se for preenchido, como distinguir 'veio do catálogo' de 'eu digitei'?
- Sem referência, o campo mostra o quê? Hoje mostra '0,00', indistinguível de uma alíquota zero — travessão '—', vazio puro, ou outra marca?
- A legenda deve nomear a faixa em números ('de R$ 12,00 a R$ 80,00: 20% + R$ 7,00') ou continuar genérica ('valores da faixa do seu anúncio')?
- Quando o vendedor digita por cima, o valor do catálogo deve permanecer visível em algum lugar (para comparar e voltar atrás) ou some de propósito?

### [Tempo de impressão em horas + minutos](calculadora/campo-tempo-h-min.md)

- O atalho do fatiador (2:30 / 2h30 / 2h30m) deve ser anunciado no hint ou fica como facilidade escondida?
- Este campo ganha o ⓘ InfoTip que todos os vizinhos do card têm — e com qual texto?
- Minutos ≥ 60 devem continuar sendo aceitos e transbordados (90min → 1h30) ou passam a ser recusados?
- Existe teto de horas? Hoje 100000 é aceito e só gera aviso; um limite de negócio mudaria o estado de erro.

### [Cartão de um canal de venda (marketplace) na aba Calcular](calculadora/cartao-de-canal.md)

- Um cartão de canal pode ser recolhido? Se sim, o que o cabeçalho recolhido mostra (só marketplace, ou marketplace + comissão aplicada + preço do anúncio, que hoje vive noutro cartão)?
- Remover um canal pede confirmação? Hoje o '✕' apaga direto, sem desfazer, levando junto categoria, perfil e taxas digitadas.
- Os dois avisos da Shopee ficam sempre abertos por cartão? O 'Frete aferido' é estático e se repete em cada cartão Shopee — sobe para o nível da seção, vira ⓘ recolhido, ou continua por cartão?
- Existe limite de canais? O botão 'Adicionar canal' não tem teto declarado — 8 cartões empilhados é cenário real a desenhar?

### [Quando o canal não tem preço: as quatro recusas de "Preços por canal"](calculadora/estados-de-preco-por-canal.md)

- (b) pode acontecer sem frete digitado? A frase 'frete maior que a margem' afirma uma causa que pode ser falsa se o líquido ficar negativo só por comissão + taxa fixa.
- (a) é aviso ou erro? Hoje é vermelha (--danger-text), mas quem não publicou a tarifa foi o marketplace, não o vendedor.
- (d) deve levar o vendedor ao campo culpado (link/rolagem até o campo inválido do canal) ou continua uma frase passiva?

### [A legenda do subsídio de frete da Shopee, sob a grade de taxas](calculadora/info-subsidio-de-frete-shopee.md)

- O teto (R$ 20,00) deve ganhar peso visual — número destacado, ícone, faixa informativa — ou continuar em texto miúdo? Destacar melhora a leitura e aumenta o risco de leitura como desconto.
- A fonte deve virar link para o artigo publicado (sourceUrl existe e hoje é ignorado), colapsar num gatilho de dica como o aviso de frete aferido, ou continuar por extenso?
- Sem preço calculado no canal, deve aparecer uma versão sem teto ou a legenda continua ausente, deixando o campo Frete sem contexto?
- Quando o vendedor digita valor no campo Frete, a legenda muda de texto / ganha confirmação ('este valor é seu; o cupom não') ou permanece idêntica?
- Mostrar a data de última revisão do dado (07/08/2026) além da vigência (01/03/2026), ou só a vigência?

### ["Quanto custa a máquina" — a pergunta em linguagem natural, o custo/hora dito em voz alta e o modo de ajuste](calculadora/pergunta-de-custo-de-maquina.md)

- Voltar para "Usar estimativa por ritmo" reescreve as horas digitadas sem avisar — pedir confirmação, avisar, ou manter o descarte calado?
- O que a legenda derivada diz quando não há número honesto (valor da máquina vazio ou vida útil 0)? Hoje afirma "≈ R$ 0,00 por hora de impressão".
- As 3.600 h derivadas devem aparecer no modo estimativa junto do custo/hora, ou o número em horas é deliberadamente escondido de quem escolheu não pensar em horas?
- "1 anos" (molde "{n} anos" aplicado a 1..5): vira "1 ano" por opção ou o rótulo muda de forma?
- Quando valor da máquina e vida útil vieram de uma impressora do Catálogo (premium), o bloco deveria dizer isso? Hoje não diz nada — e o modo ajustar pode abrir sozinho por causa disso.

### [Preços por canal — a comparação que hoje é uma pilha](calculadora/precos-por-canal.md)

- Varejo + atacado por canal, ou só um nível? O canvas 018 (Orçamentos e Kits) mostra apenas anúncio + líquido por canal, sem o par varejo/atacado; a Calcular mostra os dois.
- O bloco vira card próprio ao lado do 'Detalhamento' também na Calcular (como no canvas 018), ou continua fundido na cauda do mesmo card (decisão 016/US5)?
- Existe canal 'vencedor'? Marcar o de maior líquido é uma recomendação de produto — o dono quer que o produto aponte ou apenas apresente?

### [Seção "Custos da peça" — a grade que a calculadora abre inteira](calculadora/secao-custos-da-peca.md)

- Volta o disclosure progressivo do protótipo (§E4: "1 aberta + 1 fechada, nunca tudo aberto") ou fica tudo aberto como hoje?
- Se voltar: quais grupos são coláveis (Energia · Máquina/Depreciação · Falha) e o que fica sempre visível (Material e Tempo)?
- Os dois campos opcionais (Reserva de manutenção, Taxa de falha) nascem visíveis ou atrás de um "ajustes finos"?
- A pergunta da máquina continua dentro de "Custos da peça" ou vira sua própria seção?
- "1 anos" no select de payback — corrigir para "1 ano" (singular)?

### [Seção Marketplace: a chave mestra e a pilha de canais](calculadora/secao-marketplace-multicanal.md)

- Com a chave 'Incluir marketplaces no preço' DESLIGADA, o que fica no lugar? Nada (como hoje), uma frase dizendo que os preços na tela são de venda direta, ou um resumo do último cálculo por canal?
- Existe limite de canais? O código não tem nenhum, e nada impede dez cartões do mesmo marketplace — inclusive: repetir o mesmo canal (ML Clássico e ML Premium lado a lado) é uso pretendido?
- Um cartão de canal preenchido deveria poder colapsar (mostrando só 'Shopee · 20% · R$ 4,00'), para que quatro canais não custem ~2.500px de página?
- Remover um canal preenchido pede confirmação, ou desfazer basta?

### [Seção "Outros custos" da Calcular — lista de itens nomeados](calculadora/secao-outros-custos.md)

- Rótulos por linha visíveis, cabeçalho só na primeira linha, ou manter só placeholder?
- O estado vazio apenas explica ou oferece atalhos de um toque (Embalagem, Etiqueta)?
- Mostrar subtotal da seção dentro do bloco ou manter a soma só no detalhamento do rodapé?
- A migração de coluna conforme o plano (premium à esquerda, grátis à direita) continua?
- Existe limite de linhas e o que acontece na lista longa?
- Nomes repetidos são erro a avisar ou comportamento aceito?

### [Seletor de categoria do marketplace (busca + árvore) dentro do slot de canal](calculadora/seletor-de-categoria.md)

- Busca e árvore hoje são exclusivas (digitou → o botão da árvore some). É intencional, ou a busca deveria filtrar a árvore e manter uma superfície só?
- Item de resultado mostra caminho completo; item de árvore mostra só o nome. Unificar em caminho completo ou manter as duas gramáticas?
- O rótulo "(opcional)" no campo que define a alíquota — mantém, troca por algo que diga "sem isto usamos a tabela geral", ou o selo do card já basta?
- O corte em 8 resultados foi inferido. Vira lista rolável completa (como a árvore) ou continua corte + pedido de refinamento?
- Nós intermediários são escolhíveis, mas nada distingue um nó com tarifa própria de um que herda a do pai. Deve distinguir?

### [Selo de procedência e vigência da tarifa (e o selo separado da taxa fixa)](calculadora/selo-de-vigencia-de-tarifa.md)

- sourceUrl existe no catálogo e nunca é renderizado — a fonte deve virar link alcançável? Isso torna a peça interativa (foco, hover, alvo ≥44px, abrir fora do app).
- O selo 'none' (sem referência — informe as taxas) deve virar aviso de bloqueio em vez de pílula discreta?
- 'stale' deve ganhar tom próprio de alerta ou permanece neutral para não treinar o vendedor a ignorar o alarme mensal?
- A citação longa da fonte (~160 caracteres) pode ser truncada com o texto completo atrás de 'ver fonte'/tooltip, ou a procedência aparece inteira e sempre?
- Deve existir um padrão único de rótulo entre os dois selos (ex.: 'Comissão: …' / 'Taxa fixa: …'), já que hoje 'Referência' nomeia a natureza e 'Taxa fixa' nomeia o número?

### [Chave de taxa opcional do canal (ex.: "Manuseio de item volumoso" da Shopee)](calculadora/taxas-opcionais-do-canal.md)

- A legenda longa aparece sempre ou parte dela só quando a chave está ligada?
- O encargo ligado mostra impacto local (+ R$ 50,00 no custo do canal) ou basta o preço mudar no resultado?
- O bloco ganha título (ex.: 'Taxas opcionais deste canal')? Hoje não existe nenhum e seria copy nova.
- O `sourceUrl` do catálogo (seller.shopee.com.br/edu/article/3305) deve virar link clicável ou o app cita sem linkar?
- Com catálogo desatualizado/embutido, o encargo herda o aviso de frescor do selo do slot ou fica fora dessa sinalização?

## Catálogo (91)

### [Abas de seção do Catálogo no mobile (Filamentos · Impressoras · Produtos · Kits)](catalogo/abas-de-secao-mobile.md)

- "Kits" deve mesmo ser a quarta seção do Catálogo? Há uma seção Kits na barra inferior (/kits) e uma pílula Kits aqui; nenhuma autoridade de desenho previu a quarta pílula, e é essa duplicidade que cria o aperto de largura a 360px.
- Se as quatro ficam: quando não couberem, o preferido é rolar com indício visível, encolher os rótulos ou quebrar em duas linhas? Muda a solução inteira.
- As pílulas devem carregar contagem (ex.: "Filamentos 12")? Hoje o número só existe abaixo, no painel, e movê-lo agrava a largura.
- A ordem atual (Filamentos → Impressoras → Produtos → Kits) é intencional por frequência de uso ou pode mudar para pôr a mais usada primeiro?

### [Barra de ferramentas da lista do Catálogo (desktop)](catalogo/barra-de-ferramentas-mestre-desktop.md)

- Com filtro ativo, o que a contagem deve dizer? '3 de 40 filamento(s)', '3 filamento(s) encontrados' ou manter '{n} filamento(s)' e explicar noutro lugar?
- O botão 'Adicionar…' fica na barra da lista (código atual) ou volta para o cabeçalho ao lado das abas de seção (canvas 2026-07-02)?
- Com Premium pausado ou offline, o botão de adicionar desabilita (como o canvas mandava, disabled={{writeBlocked}}) ou continua aceso abrindo uma gaveta somente-leitura (como o código faz)? Qual frase explica, e onde?
- A busca deve ignorar acentos ('acucar' achar 'Açúcar')? Hoje não ignora.
- A busca deve existir também no mobile, ou o mobile continua sem nenhum caminho de filtro?

### [Cartão do item na lista do Catálogo (desktop) e seus avisos](catalogo/cartao-da-lista-desktop-avisos.md)

- Dois ou três avisos no mesmo cartão: um badge com precedência, dois badges, ou badge para o estado do ITEM e faixa única acima da lista para os estados de LISTA/CONTA?
- 'pode estar desatualizada' e 'somente leitura' são verdadeiros para a lista inteira e hoje se repetem em cada cartão — devem sair do cartão para uma faixa única?
- Kits: o canvas dá ao kit 'custo R$ 52,34 · varejo R$ 157,02'; FR-310 proíbe preço no cartão de Produto. Kit mostra dinheiro na lista ou segue a mesma regra?
- Mantemos os dois textos do estado degradado (badge 'precisa de atenção' + frase 'Vincule um filamento e uma impressora salvos') ou a frase fica só na ficha à direita?

### [Confirmar exclusão de um item do catálogo](catalogo/dialogo-de-exclusao.md)

- O aviso de referências deve subir para antes de 'Esta ação não pode ser desfeita.' (virando o corpo principal) ou continuar como alerta abaixo?
- '{n} produto(s)' deve virar copy com plural real ('1 produto' / '3 produtos')? Muda copy já em produção.
- A frase de falha offline deve ganhar uma variante para exclusão (hoje diz 'Criar e editar precisam de conexão.' num diálogo de excluir)?
- A cabeça da ficha do desktop fica com botão de texto 'Excluir' (canvas 018) ou com ícone de lixeira (código atual)? A resposta também afeta o mobile.
- Excluir com sucesso deve mostrar toast de confirmação? Hoje não mostra nenhum — a única evidência é a linha sumir.

### [Editor de produto em página cheia (Catálogo → Produtos)](catalogo/editor-de-produto-pagina-cheia.md)

- Onde mora o botão 'Salvar produto' — cartão do nome (hoje), barra de ação fixa no rodapé, cartão de ação junto ao preço, ou faixa de cabeçalho?
- A tela precisa de uma saída explícita (voltar/cancelar/fechar) e, se sim, o que acontece com as edições não salvas: descarta, pergunta ou salva?
- A tela entra no mestre-detalhe do 018 a 1920px ou segue página cheia com o teto de 1720px das outras quatro? (research.md §E rejeitou os 560px, mas não decidiu esta via.)
- O cartão 'Usar do catálogo' continua separado ou se funde ao cartão de identidade do produto (nome + filamento + impressora)?
- A ordem 'custos à esquerda, markup + marketplace à direita' é obrigatória, ou o produto pode ter ordem própria — quebrando a paridade visual com a Calcular?

### [Catálogo que não carregou: o caminho de volta](catalogo/erro-de-carga-e-tentar-novamente.md)

- O bloco de erro deve ser alerta vermelho (tf-alert danger) ou estado de página (tf-empty com ícone, corpo e ação)?
- Vale o título do código ('Não foi possível carregar seu catálogo.') ou o do protótipo ('Não foi possível carregar. Tente de novo.'), e as variantes irmãs (Catálogo, Orçamentos, seletor do cálculo) convergem para uma frase só?
- No ENTITLEMENT_REQUIRED de LEITURA, qual é a ação (levar para Conta/reativação ou só explicar) e qual frase, já que 'Salvar faz parte do Premium.' fala de escrita num erro de leitura?
- No desktop, o erro ocupa a faixa inteira ou fica só na coluna da lista, com a ficha de 560px exibindo um estado próprio de 'nada selecionado'?

### [Catálogo carregando — o esqueleto da lista (e da ficha) no lugar do spinner](catalogo/estado-de-carregamento-catalogo.md)

- Durante o carregamento, o botão "Adicionar filamento" e a busca ficam habilitados ou desabilitados até os dados chegarem?
- Existe tempo mínimo/atraso antes de mostrar o esqueleto (ex.: nada por 150ms, depois pelo menos 300ms), ou ele aparece sempre, mesmo em cache quente?
- A ficha de 560px na primeira carga mostra esqueleto de FORMULÁRIO (filamento/impressora editam ali) ou de RESUMO (produto/kit só resumem)?

### [O estado "precisa de atenção" de um produto (cartão, ficha e editor)](catalogo/estado-precisa-de-atencao.md)

- Quando falta só uma das duas referências, a frase continua sendo "Vincule um filamento e uma impressora salvos" (pede duas coisas para um problema só), ou existe uma segunda variação nomeando o que falta?
- O corpo "Os valores atuais foram mantidos e continuam editáveis." deve aparecer também na ficha do desktop, ou o alerta curto da ficha é intencional porque ela só resume?
- Badge danger "precisa de atenção" e "somente leitura" (Premium pausado) convivem no mesmo cartão, ou um deles vence e o outro some?
- O estado de resolução vira skeleton (forma sem texto) ou uma palavra neutra? Trocar por forma resolve o "parece defeito", mas muda o que o leitor de tela anuncia.

### [Catálogo vazio: o primeiro contato de cada seção (Filamentos · Impressoras · Produtos · Kits)](catalogo/estado-vazio-por-secao.md)

- A semeadura volta? O CTA secundário 'Começar com filamentos comuns' (PLA/PETG/ABS) existia no protótipo V3 e não existe em linha nenhuma do código atual — gravar itens na conta do vendedor em um clique é decisão de produto, e falta definir para quais seções.
- Qual grafismo para a seção Kits? O protótipo só nomeou espada (filamento/produto) e arco (impressora); Kits nasceu depois (008/K1) e não tem arte atribuída.
- No desktop (mestre-detalhe ≥1280px) o vazio mantém a barra de ferramentas (busca + contagem + botão) visível, ou esconde? Manter dá estabilidade de layout entre 0 e 1 item; esconder dá uma tela de boas-vindas mais limpa.
- O vazio de Produtos deve levar o vendedor de volta para Filamentos quando o pré-requisito ('Para criar um produto, salve antes um filamento e uma impressora no catálogo.') não estiver cumprido, ou apenas informar?

### [Ficha de resumo de Produto e de Kit (coluna direita do Catálogo no desktop)](catalogo/ficha-resumo-produto-kit-desktop.md)

- A ficha somente-leitura pode mostrar dinheiro? Exigiria recalcular ao vivo (e dizer isso); kit nunca guardou preço (FR-407), mas o canvas desenhou 'Custo total' e 'Markup varejo'.
- 'Usar no cálculo' — ação do rodapé desenhada no canvas e nunca construída — é ação real ou cenografia do protótipo?
- Produto ganha 'Duplicar' (hoje só Kit tem), ou a assimetria é intencional?
- Mostrar 'criado em' / 'atualizado em' (existem no wire, nunca exibidos) ou é ruído?
- Quanto do produto cabe na ficha: só o essencial (gramas, tempo, falha, referências) ou tudo o que foi salvo (acabamento, mão de obra, tarifa, canais de marketplace, outros custos)?

### [Folha de criar/editar filamento e impressora (mobile)](catalogo/folha-criar-editar-mobile.md)

- Ancoragem: volta para bottom-sheet (§D.2 + protótipo) ou mantém a gaveta lateral que só a spec textual registra?
- Rodapé: dois botões full lado a lado (Voltar | Salvar) ou Salvar full-width com a saída secundária acima — e onde fica o erro de gravação sem deslocar o alvo?
- A palavra de saída: 'Voltar' continua ou vira algo que diga que o digitado será descartado (com 'cancelar' ainda proibido)?
- Descartar com alterações pendentes: X/Esc/scrim hoje fecham sem perguntar e perdem o digitado — deve haver confirmação?
- Avisos de plausibilidade (consumo, vida útil, peso do rolo, reserva) existem no Calcular e não nesta folha, que grava os mesmos campos — devem passar a existir aqui?

### [Formulário de filamento (Catálogo → aba Filamentos)](catalogo/formulario-filamento.md)

- A unidade do peso do rolo é kg (código) ou g (canvas)? Mudar altera o dado salvo de todos.
- O campo 'Cor', pedido duas vezes pelo protótipo e nunca construído, entra? Como quinto campo opcional ou junto/no lugar de 'Material'?
- 'Material' é opcional declarado (ganha a tag 'opcional') ou passa a obrigatório? Hoje não tem nem asterisco nem tag.
- O formulário deve exibir o custo por grama derivado (ex.: R$ 0,13/g), que é o número que o app realmente usa e hoje nunca aparece?
- O aviso de plausibilidade de peso que existe na Calculadora deve aparecer também no Catálogo, onde o valor fica salvo?

### [Formulário de impressora — os 5 campos que decidem depreciação e energia](catalogo/formulario-impressora.md)

- Ordem dos campos: canvas (Valor → Consumo → Vida útil → Reserva) ou código (Valor → Vida útil → Consumo → Reserva)?
- Nível de ajuda: os InfoTip longos já homologados na Calculadora (Consumo, Vida útil, Reserva) entram no Catálogo, ou fica só a dica curta do consumo?
- O aviso de plausibilidade ('Confira o consumo… Nada foi recusado.') deve disparar também neste formulário, ou continua exclusivo da Calculadora?
- O cadastro da impressora deve oferecer a derivação da vida útil por ritmo de uso + payback (como a Calculadora), ou continua pedindo horas cruas?
- Resumo do item na lista: 'R$ 2.400,00 · 4.680 h · 0,12 kW' (código) ou '0,12 kW · 4.680 h de vida útil' com o valor à parte (canvas)?

### [Catálogo em leitura offline — a faixa "Modo leitura offline" e a marca "pode estar desatualizada"](catalogo/leitura-offline-desatualizada.md)

- Qual dos três sinais sobrevive: faixa do shell, faixa do painel e/ou a linha 'pode estar desatualizada' por item?
- Adicionar/Salvar ficam desabilitados offline (§E3/§G do protótipo) ou continuam ativos com falha honesta ao salvar (código atual)?
- 'Sem internet' e 'servidor não respondeu' devem ser o mesmo aviso para o vendedor? Hoje são dois gatilhos distintos com aparência quase igual.
- Qual copy vale: o §D.2 canônico 'Offline — o cálculo continua funcionando' ou as duas frases já implementadas?
- Vale mostrar quando o cache foi salvo ('salvo há 2 dias')? Esse dado não existe no produto hoje — seria requisito novo.

### [Lista do Catálogo no celular — a linha do item, a contagem e o botão de adicionar](catalogo/lista-catalogo-mobile.md)

- Volta ao cartão único com divisórias (protótipo) ou fica um cartão por item (produto de hoje)?
- A faixa de contagem fica? Se ficar, "3 filamento(s)" precisa de forma melhor; se sair, o botão de adicionar vira ícone sólido na barra de título e perde o texto.
- Avatar/inicial de 36px no começo da linha entra, sai, ou vira ícone da seção? (iniciais de 1 letra já foram apontadas como problema e nunca corrigidas)
- A linha inteira vira um alvo só? Hoje só a área de texto abre o item.
- Três avisos ao mesmo tempo: mostrar todos ou eleger um? Se eleger, qual vence — referência faltando, dado velho, ou somente-leitura?
- O resumo da impressora deve nomear as grandezas ("4.680 h de vida útil · 0,12 kW"), separar em duas linhas como o desktop, ou mostrar menos?

### [Premium pausado no Catálogo — a faixa calma, o formulário inerte e a linha de reativação](catalogo/premium-pausado-somente-leitura.md)

- A linha "Reative o Premium" oferece caminho (botão para Conta/assinatura) ou continua só aviso sem ação?
- Com o plano pausado, o botão "Adicionar filamento/impressora" continua ativo abrindo formulário inerte, fica desabilitado ou some?
- Os ícones de lixeira e lápis mudam de rótulo/forma quando pausado (ex.: virar um só "Ver") ou continuam iguais e só desviam o destino?
- A faixa "Premium pausado" deve aparecer também com catálogo vazio, com erro de carga e junto do aviso de offline — e nesse caso as duas frases convivem ou uma vence?
- O estado pausado pode mostrar quando o acesso pausou ou até quando os dados ficam guardados?

### [Os dois recados que substituem o editor de produto](catalogo/recados-do-editor-de-produto.md)

- Estado vazio de marca (EmptyState/tf-empty, com grafismo e ação em destaque) ou alerta seco (Alert tone=info)? A indefinição é o buraco central da peça.
- O atalho 'Adicionar filamento'/'Adicionar impressora' pode abrir o sheet dentro do editor de produto, ou leva à aba do Catálogo e o vendedor volta a pé?
- Pode contar o que falta ('você já tem 3 filamentos; falta salvar uma impressora')? Isso revela contagem do catálogo numa tela que hoje não revela nada.
- No desktop estes recados acompanham tf-page-wide (até 1720px) ou ganham teto próprio centrado? O 018 redesenhou as 4 abas, não estes recados.
- Quando o produto-base de um cenário salvo não é encontrado, o recado menciona o cenário de origem ou permanece genérico?

### [Rodapé do editor de produto — o preço recalculado e as três ações que disputam o fim da página](catalogo/rodape-do-editor-de-produto.md)

- Qual é a ação principal no fim da página? 'Salvar produto' desce para o rodapé, é repetida, ou fica só no topo?
- A ordem das duas ações diverge de Calcular (lá é Simulação → Orçamentos, aqui é Orçamentos → Simulação) apesar do corpo declaradamente idêntico (SC-305); unifica, e qual ordem manda?
- Produto novo: as duas ações continuam ausentes sem explicação, ou aparecem desabilitadas com uma linha dizendo que precisam do produto salvo?
- Premium pausado: o rodapé fica calado (o alerta do topo já explicou) ou repete ali que salvar está pausado?
- A assimetria offline (Orçamento vira pendente, Simulação é recusada) deve ser dita antes do clique, no rodapé, ou continua só dentro da folha?

### [Seletor "Usar do catálogo" dentro do editor de produto](catalogo/seletor-de-filamento-e-impressora.md)

- A saída manual é link/botão sempre disponível (protótipo §E4) ou opção do select que só nasce após perder o vínculo (código atual)? E, se for a do protótipo, ela desvincula mantendo os valores ou limpa?
- O que acontece quando escolher um item sobrescreveria um valor editado à mão: confirmar antes, avisar depois com desfazer, ou sobrescrever marcando os campos como vindos do catálogo?
- Um produto vinculado cujos números foram editados continua vinculado? Hoje sim, em silêncio, guardando valores que discordam do item do catálogo.
- No produto novo sem nenhum item salvo, o editor continua bloqueado pela tela de pré-requisito ou abre com o caminho manual liberado e o catálogo como atalho?

### [Nada encontrado para essa busca — o vazio do FILTRO no Catálogo (desktop)](catalogo/vazio-da-busca.md)

- A contagem com filtro ativo deve virar '0 de 12 filamento(s)', sumir durante a busca, ou continuar mostrando '0 filamento(s)' (hoje uma afirmação falsa sobre os dados do vendedor)?
- Quando a busca não acha nada, o botão de adicionar deve virar atalho contextual ("Adicionar 'petg'", com o termo já no nome) ou permanecer genérico? É funcionalidade nova, não ajuste de desenho.
- A busca deve ignorar acentos além de maiúsculas? Hoje só ignora maiúsculas, e isso muda quantos zeros este bloco vai mostrar.

## Kits / BOM (50)

### [A pilha de avisos no topo da tela de Kits (e o aviso de tarifas não atualizadas)](kits/aviso-catalogo-de-tarifas-em-kits.md)

- Qual a ordem/prioridade entre os três avisos de topo (plano não conferido, Premium pausado, tarifas não atualizadas) quando coexistem? A ordem atual é acidental — é a ordem em que o código foi escrito.
- O aviso de tarifas deve aparecer com o kit vazio e quando nenhuma peça vende em marketplace? Na calculadora ele só aparece dentro da seção de marketplaces quando ela está ligada; em Kits aparece sempre, no topo.
- Compactar o aviso para uma linha (como o alerta de Orçamentos já desenhado) esconde as frases 'o cálculo continua funcionando' e 'você também pode informar as taxas manualmente'. Elas podem ir para um ⓘ ou precisam ficar sempre visíveis?
- Mostrar a data da referência salva (ex.: 'referência de 06/08') tornaria o aviso mais honesto, mas é dado novo na tela — vale a pena?
- Depois de um 'Tentar novamente' bem-sucedido o bloco simplesmente some, sem confirmação nenhuma. O vendedor precisa ser avisado de que as taxas foram atualizadas?

### [Compositor de kits em mobile — a tela /kits inteira a 390px](kits/composer-kits-mobile.md)

- A barra fixa 'Total do kit' e as ações de guardar: no fim do scroll a barra libera o rodapé, encolhe, ou 'Salvar em Orçamentos' e 'Salvar kit' sobem para dentro dela? Hoje as duas ações ficam POR BAIXO da barra e ninguém decidiu isso.
- Precedência entre os três alertas de topo (plano não verificado · Premium pausado · falha do catálogo de tarifas): empilham (~380px antes da primeira peça), colapsam numa faixa com contagem, ou algum some por ser menos urgente?
- 'Uma peça aberta por vez' continua sendo a regra? Hoje abrir uma peça recolhe a anterior — é decisão de produto e muda o desenho da lista inteira.
- A diferença entre 'Salvar kit' (kit vivo, recalcula) e 'Salvar em Orçamentos' (congela o preço de hoje) ganha uma frase na tela? Se sim, qual — é copy nova.

### [Verificação de plano na aba Kits: "checando" e a parede de "não sei"](kits/estados-de-verificacao-de-plano-kits.md)

- Depois de quantos segundos 'Verificando seu plano…' deixa de ser aceitável, e o que aparece então? Não existe copy de espera longa nem de tempo esgotado.
- A parede de 'não sei' é tela cheia (como hoje) ou bloco dentro de um esqueleto do compositor desabilitado?
- 'Não foi possível verificar seu plano.' deve virar duas frases distintas — parede (sem resposta nenhuma) vs faixa (Premium ativo, só não reconfirmado)? Se sim, qual copy para cada.
- A parede deve oferecer saída alternativa além de 'Tentar novamente' (ex.: caminho para a calculadora de peça única, grátis e offline) ou isso confunde com upsell?
- O tom da parede continua `info` — a mesma cor de plano pausado e taxas desatualizadas — ou ganha um tom próprio de atenção?

### [Kits no desktop: peças à esquerda, ficha do kit à direita](kits/kits-desktop-duas-colunas.md)

- O selo "Ao vivo" promete "recalcula enquanto você digita" ou "tarifas atualizadas"? A segunda pode ficar falsa quando o refresh do catálogo falha e exigiria um estado alternativo do selo.
- Ordem da coluna direita: "Total do kit" primeiro (canvas) ou "Preços por canal (kit)" primeiro (código de hoje, que empurra a manchete de dinheiro para depois de ~300px de tabela)?
- Com "Adicionar peça" no cabeçalho da página, o botão do fim da lista continua existindo?
- A grade de 4 métricas por peça (Gramas / Impressão / Custo unitário / Total da linha) do canvas vale? Ela exige expor gramas e tempo no cartão recolhido, que hoje só existem dentro do editor.
- Quando a ficha não cabe na altura da janela, o que fica sempre visível — rolar a coluna inteira (esconde o total) ou fixar o total dentro dela (segunda camada grudada)?

### [Premium pausado em Kits — o painel de reativação e a faixa do kit reaberto](kits/kits-premium-pausado.md)

- O painel de reativação deve listar os kits salvos ali mesmo (como o ux-bom.md §3 desenhou no ASCII) ou continuar só apontando para a aba Kits do Catálogo?
- O CTA de reativação leva à oferta existente da Conta (/conta?assinar=1, o alvo que os teasers já usam) ou o dono quer um caminho próprio de reativação, distinto da primeira compra?
- Como antecipar a recusa no botão "Salvar kit" sem desabilitá-lo: trocar o rótulo, acrescentar legenda ao lado, ou manter idêntico ao do premium ativo e deixar a antecipação por conta da faixa?
- O painel de Kits deve adotar a copy de lapso do Catálogo ("Reative o Premium" / "Reative o Premium para voltar a criar e editar. Seus itens estão salvos.") para haver uma só voz de lapso no app, ou a copy específica de Kits permanece?

### [Peça de kit que perdeu o produto vinculado](kits/linha-degradada-produto-removido.md)

- A peça degradada merece marcador de linha visível com o card fechado (ícone ou tf-badge no cabeçalho), ou a legenda calma segue sendo o único sinal, como decidiu o T021 em 2026-07-12?
- O resumo do kit e a linha da lista de kits no Catálogo devem contar quantas peças estão sem vínculo, ou isso vira alarme sobre um estado recuperável e comum?
- Quando o vendedor revincula um produto e a legenda some, deve haver confirmação positiva (selo momentâneo/toast) ou o silêncio basta?
- A consequência 'esta peça vira um produto novo no catálogo no próximo salvamento' deve ser dita na peça degradada — como já é dita para a peça ajustada — ou fica implícita no campo 'Nome da peça no catálogo'?

### [Card da peça recolhido — a linha do kit](kits/linha-do-kit-card-recolhido.md)

- A grade de quatro métricas do canvas (Gramas · Impressão · Custo unitário · Total da linha) vale nas três larguras, ou em 390px a linha recolhida mostra só o Total da linha?
- Os botões de rodapé do canvas ('Editar esta peça' / 'Usar produto salvo') entram na linha recolhida — e, se entrarem, 'Editar esta peça' soma-se ao chevron ou substitui o chevron?
- Qual grafia sobrevive: 'Peça 2 · (avulsa)' (código) ou 'Peça 2 (avulsa)' (canvas)?
- A origem ('do catálogo: Vaso G' / '— Manual —') deve ser visível na linha recolhida (canvas) ou continua só dentro do editor expandido (produto no ar)?

### ["Nome da peça no catálogo" — o campo que anuncia que a peça vai virar produto](kits/nome-da-peca-no-catalogo.md)

- Isto é um campo por peça (hoje), um aviso agregado perto do 'Salvar kit' ('2 peças vão virar produtos novos') ou uma confirmação no momento de salvar listando os nomes? Muda o desenho inteiro.
- O nome derivado ('Peça 1 · Kit suporte + base') deve ser pré-preenchido de verdade no campo, como texto editável, em vez de viver como placeholder?
- Revincular um produto apaga o nome digitado: deve avisar antes, guardar o nome para uma próxima edição, ou seguir descartando em silêncio?
- 'Nome da peça no catálogo' é o rótulo certo? Ele não diz que a peça VAI NASCER no catálogo.

### ["Salvar em Orçamentos" dentro do compositor de kits](kits/registrar-orcamento-a-partir-do-kit.md)

- O rótulo continua 'Salvar em Orçamentos'? Ele aparece três vezes (botão, título e submit da folha) e colide com 'Salvar kit' logo abaixo; trocar aqui obriga a trocar a copy já homologada do vazio de Orçamentos.
- Qual das duas ações é a principal no kit? Hoje 'Salvar kit' é primária e o orçamento é secundário — é essa a hierarquia desejada?
- O botão desabilitado deve declarar a razão junto dele, ou basta o 'Sem preço ainda' do cartão acima?
- No mobile, onde fica a ação em relação à barra fixada 'Total do kit' (acima dela, dentro dela, ou só no fim da rolagem)?

### [Total do kit no estado "Sem preço ainda"](kits/resumo-sem-preco-ainda.md)

- Quando TODAS as peças estão fora do total, o bloco deve declarar quantas e apontar para os avisos? O texto '{n} peça(s) fora do total — confira os avisos nas peças acima.' já existe mas hoje não renderiza justamente nesse caso — reaproveitar, escrever um específico, ou manter só a frase genérica?
- O badge 'Ao vivo' (tf-badge--success) que o artboard populado do 018 traz ao lado de 'Total do kit' deve existir no produto? Se sim, o que ele faz neste estado — some ou vira etiqueta neutra de espera?
- O bloco deve levar o vendedor até a primeira peça incompleta (link/botão que rola e abre a peça)? Seria o primeiro alvo interativo dentro do resumo.
- No desktop, os ~400px que sobram na coluna de 480px enquanto não há preço: ficam vazios ou o card de nome/Salvar kit sobe para ocupá-los (e desce quando o preço aparece)?
- O botão 'Salvar em Orçamentos' desabilitado deve explicar por que está desabilitado enquanto não há preço, ou continua mudo?

### [Vincular uma peça do kit a um produto salvo — o seletor e o selo de origem](kits/seletor-produto-salvo-na-linha.md)

- O vínculo é lista suspensa (código) ou botão que abre um seletor com busca (canvas 018)? Os dois não podem estar certos.
- A opção da lista mostra só o nome, ou nome + segunda linha (material / custo unitário)?
- Onde mora o selo de origem: no cabeçalho da linha (visível com a peça recolhida) ou dentro do editor expandido (como está no ar)?
- 'Ajustado por você' deve aparecer também no cabeçalho recolhido, junto de 'Peça 1 · Vaso G'?
- Sem nenhum produto salvo, o que o vendedor vê — nada (como hoje), controle desabilitado com explicação, ou convite para cadastrar um produto (e para onde ele leva)?
- Desvincular ('— Manual —') mantém os valores preenchidos, hoje em silêncio. Isso deve ser dito na tela?

## Orçamentos (64)

### [Ações do registro travado — [Tentar novamente] / [Descartar] e a confirmação do descarte](orcamentos/acoes-de-registro-travado.md)

- Os dois rótulos de retry ("Tentar agora" para pendente × "Tentar novamente" nos travados) continuam diferentes ou viram uma frase só? A diferença nasceu no código, não numa decisão de produto.
- As ações destrutivas continuam dentro do card da lista (que é inteiro clicável), ou o card só abre o registro e o descarte passa a viver apenas no detalhe?
- No desktop mestre-detalhe, quando o registro travado está aberto à direita, o par de botões do card da esquerda deve sumir ou os dois ficam?
- Um retry bem-sucedido deve avisar explicitamente ("Registro sincronizado.", frase que já existe no app) ou o sumiço da insígnia basta?

### [Alerta de estado do registro não sincronizado (Orçamentos → registro aberto)](orcamentos/alerta-de-sincronizacao-no-detalhe.md)

- Badge do topo e alerta ao mesmo tempo? Em `failed` o texto é idêntico nos dois ('Não foi possível registrar') — mantemos os dois com papéis distintos ou o badge some quando o alerta está presente?
- Onde o alerta entra na ordem vertical do registro? Hoje é o 5º bloco (abaixo da dobra em 390px), depois do valor cotado, da faixa de plano e das ações de gerenciar.
- 'Código de suporte: 422' deve continuar sendo o status HTTP cru? O vendedor não tem o que fazer com o número e a tela não cita nenhum canal de suporte.
- Em `pendente` offline o botão [Tentar agora] some e a única ação visível vira [Descartar] (destrutiva). Aceitamos isso, ou o botão fica visível e desabilitado com o motivo ('Precisa de conexão para enviar')?

### [Os dois avisos de honestidade do orçamento repreçado](orcamentos/avisos-de-documento-repreçado.md)

- O registro reaproveitado deve se declarar na LISTA? Hoje o card é idêntico ao de um repreço verdadeiro e a diferença só aparece ao abrir — se sim, é selo, legenda ou mudança de tom?
- Os dois avisos devem ter o mesmo peso visual? Se não, qual é o mais grave: 'o número não é de hoje' ou 'parte da diferença vem da fórmula antiga'?
- Quando os dois caem na mesma tela, mostram-se os dois inteiros, um resume o outro, ou um vira secundário?
- A nota do modelo aposentado deveria aparecer também no documento congelado sozinho (ao lado de 'Calculado com a fórmula versão 3.1.0'), e não só quando há um número novo ao lado?

### [Faixas de aviso no topo de Orçamentos](orcamentos/avisos-de-topo-da-lista.md)

- Com Premium pausado E registros bloqueados na fila, a mesma causa aparece em duas faixas — a faixa da fila deve calar (como a genérica cala sob sessão expirada) ou as duas falam?
- Existe teto de faixas simultâneas? Se três é demais, colapsar numa faixa única '3 avisos' que expande, ou sacrificar a menos urgente?
- A faixa 'Premium pausado' deve ganhar ação ('Reativar Premium') ou continuar só texto? Hoje é a única sem saída.
- A variante de uma linha (tf-alert--compact, botão fora do corpo) do desenho desktop de 018 substitui o padrão construído em todas as faixas com ação, ou é exclusiva do desktop?

### [Bloco "Comparar com hoje" — o congelado ao lado do preço de hoje](orcamentos/bloco-comparar-com-hoje.md)

- Onde fica o gatilho: na fileira de ações como tf-btn--secondary (canvas do dono, linha 315) ou solto e fantasma acima dela (código atual)?
- O bloco pode ser fechado depois de aberto? Se sim, vira alternador — e no desktop, ao trocar de registro na lista, ele volta fechado ou permanece aberto?
- A recusa em mostrar a diferença vale também para o desenho: uma pista visual neutra (seta sem valor, cor de tendência) é permitida ou também proibida?
- O estado 'não foi possível calcular' oferece alguma saída (explicação do motivo, link para Recalcular hoje) ou continua um beco sem saída deliberado?
- A ordem de leitura deve ser sempre congelado-primeiro (cronológica, como hoje) ou hoje-primeiro (o que o vendedor veio buscar)?

### [Preços por canal dentro de um orçamento congelado](orcamentos/bloco-precos-por-canal-congelado.md)

- Um canal sem comissão deve manter o nome com o mesmo peso dos canais que têm preço, ou o bloco inteiro deve ser rebaixado/marcado?
- A contagem de kit deve dizer o que aconteceu com as peças restantes? A frase '2 sem este canal' já existe no app e não é mostrada neste cartão — omissão ou decisão?
- Existe o caso '0 de 5 peças'? Se sim, isso é canal sem preço, erro, ou outra coisa?
- Varejo e atacado sempre juntos, ou destacar o par correspondente à base do orçamento e recolher o outro?

### [Registro congelado em tela cheia (celular)](orcamentos/detalhe-do-orcamento-mobile.md)

- Ficha técnica: Card sempre aberto (código) ou colapsável e calma (ux-history.md:362)? E se colapsar, a ressalva do relógio do aparelho (decisão F2) fica visível ou colapsa junto?
- A barra de ações sobe para logo abaixo do card da alegação, como no canvas de desktop? E, se subir, 'Excluir' entra nela no celular ou continua apartado de [Exportar]/[Recalcular hoje]?
- 'Comparar com hoje' é um botão fantasma solto (como hoje) ou um bloco já aberto com seção própria?

### [Sair da conta com orçamentos ainda não sincronizados](orcamentos/dialogo-sair-com-fila-pendente.md)

- A lista dos registros em risco entra? Em qual etapa, com rolagem ou 'e mais X', e o descarte continua tudo-ou-nada?
- O aviso de falha parcial deve nomear a causa por registro (Premium pausado / sessão expirada / recusado)? E 'Sincronizar agora' continua primário quando nenhum dos restantes pode ser resolvido por nova tentativa?
- A ordem dos botões muda? Hoje o destrutivo 'Sair e descartar' fica ACIMA de 'Voltar'.
- A contagem fica em 'registro(s)' ou vira singular/plural real — e o vocabulário deveria dizer 'Orçamentos', como o resto do app?
- No desktop com o rail de 018, o diálogo cobre a tela inteira ou fica ancorado à área de conteúdo?

### [Renomear rótulo e excluir registro — os dois gatilhos e os dois diálogos](orcamentos/dialogos-renomear-e-excluir-registro.md)

- Adotamos a posição do canvas 018 — 'Editar rótulo' fantasma com lápis colado ao rótulo e 'Excluir' danger-ghost no fim da fileira de ações — matando a barra separada inclusive no mobile? Ou o mobile mantém barra própria com hierarquia corrigida?
- Quando o registro não tem rótulo, o que o diálogo de exclusão deve ecoar: o nome da origem gravada, o literal 'Cálculo avulso', ou valor+data ('R$ 24,24, cotado em 06/08/2026')? Ecoar a origem afirma uma procedência que o vendedor não escreveu.
- Apagar o rótulo salvando o campo vazio é caminho intencional? Se for, precisa dizer-se (texto de ajuda ou ação explícita 'Remover rótulo'), e isso muda o rodapé do diálogo.
- Sem conexão, renomear e excluir ficam bloqueados com motivo dito (a família já tem 'Criar e editar precisam de conexão.') ou continuam clicáveis e falham com um toast que hoje não nomeia a causa?

### [Busca sem resultado na aba Orçamentos](orcamentos/estado-busca-sem-resultado.md)

- O vazio deve listar todos os filtros em vigor (termo + período) ou só nomear o termo, como hoje?
- Uma ação ou duas: 'limpar só a busca' e 'limpar tudo'? Hoje o botão diz 'Limpar busca' mas zera também o período.
- Offline com filtro ativo: mostrar a lista sem filtro com aviso de que buscar precisa de conexão, ou só o aviso sem lista?
- Orçamentos e Catálogo convergem para a mesma frase de busca vazia, ou Orçamentos mantém a frase citando o termo?

### [Folha "Período…" — o intervalo de datas dos Orçamentos](orcamentos/folha-periodo-personalizado.md)

- Seletor nativo do sistema operacional ou calendário desenhado (primitivo novo no DS)? A escolha muda a peça inteira.
- Entram atalhos de período (Este mês, Mês passado, Este ano)? Se sim, substituem ou convivem com os presets Tudo/30 dias/90 dias?
- Aplicar com os dois campos em branco deve equivaler a 'Tudo', ficar desabilitado, ou mostrar erro?
- Offline: a folha 'Período…' fica indisponível com frase honesta, ou continua abrindo e explica o resultado depois?

### [Folha "Salvar em Orçamentos" — onde o registro congelado nasce](orcamentos/folha-salvar-em-orcamentos.md)

- Quando só existe UMA base possível, o que a folha mostra: o rádio solitário já marcado (hoje), uma linha de leitura sem escolha ('Cotando: Varejo — R$ 24,24'), ou nada?
- A folha deve avisar ANTES de confirmar que o aparelho está offline e o registro ficará pendente, ou a honestidade continua só no toast depois de fechar?
- A folha deve dizer em texto que a escolha é irreversível (ex.: 'Depois de salvo, só o rótulo pode ser alterado')? É copy nova e afeta o tom da peça inteira.
- O botão de confirmar continua repetindo 'Salvar em Orçamentos' (terceira vez na mesma interação) ou recebe texto próprio? E qual é o texto do estado gravando (hoje não existe; o Kits usa 'Salvando…')?
- A validade da proposta deve ter valor sugerido (ex.: 15 dias) ou continuar em branco por padrão — já que pré-preencher grava uma promessa que o vendedor não digitou?
- No desktop, a folha continua ancorada à direita (mesmo Sheet de 26rem, sem variante) ou vira diálogo central?

### [Aba Orçamentos no celular — a lista completa em 390px](orcamentos/lista-de-orcamentos-mobile.md)

- Agrupamento por mês e/ou contagem de registros na pilha longa — hoje não existe nenhum dos dois.
- Anatomia da linha do dinheiro: 'Valor cotado' + total com a base abaixo (código de hoje) ou base à esquerda + total à direita sem 'Valor cotado' (canvas de 1920px)?
- As três faixas de aviso coexistentes podem ser condensadas numa só, ou os três fatos precisam ser lidos separadamente mesmo custando a primeira tela?
- Paginação no celular continua em [Carregar mais] ou passa a carregar ao rolar?

### [Orçamentos no desktop: a lista e o documento entre 1280 e 1440px](orcamentos/mestre-detalhe-larguras-1280-1440.md)

- Na faixa 1280–1440, qual a proporção certa entre lista e documento — fração com piso de leitura (o improviso do código) ou largura fixa menor (ex.: 420px) com todo o resto para o documento? E o salto de ~40px na lista exatamente em 1440 é aceitável ou deve ser transição contínua até os 520px do desenho de 1920?
- Quando a busca não acha nada, o que a coluna direita deve dizer? Hoje repete o vazio frio 'Nenhum registro ainda', que é falso nesse contexto, e não existe copy aprovada.
- Num notebook 1366×768 o documento não cabe na altura: scroll interno da coluna (como hoje) ou a página inteira rolando junta? Se for interno, 'Recalcular hoje' e 'Exportar' ficam no fim do conteúdo ou fixos no rodapé da coluna?
- Abrir automaticamente o primeiro registro é desejado a 1280px? A 1920 preenche a tela; a 1280 consome a coluna mais estreita com um documento que o vendedor talvez não tenha pedido.

### [O momento em que o orçamento pendente chega à conta](orcamentos/transicao-pendente-para-sincronizado.md)

- O sinal de sucesso aparece em qualquer tela (a fila drena com o vendedor na Calculadora) ou só quando ele está em Orçamentos?
- Com vários registros sincronizando juntos, qual a frase? Só existe o singular 'Registro sincronizado.' — o plural precisa ser escrito e aprovado.
- O toast leva uma ação ('Ver registro') ou é só confirmação?
- Quando a sincronização acontece com o app em segundo plano e o vendedor volta depois, mostrar um resumo calmo ou nada?
- As ações que aparecem no momento (Editar rótulo, Excluir, exportar destravado) entram imediatamente sob o dedo de quem lê o registro, ou o desenho deve segurar/anunciar essa mudança?

## Simulações salvas (94)

### [Ações do cartão de simulação: renomear · duplicar · excluir](simulacoes/acoes-do-cartao-renomear-duplicar-excluir.md)

- Menu "⋯" (autoridade textual) ou botões com texto e "Excluir" afastado (canvas do dono) — qual vale numa LISTA, onde três rótulos competem com o nome da simulação?
- "Duplicar" hoje age sem confirmação e FECHA a folha, abrindo a cópia na calculadora — é o desejado, ou a cópia deveria aparecer na lista?
- "Renomear" edita nome E nota, mas o rótulo diz só "Renomear" — deveria ser "Editar", ou a nota sai dessa folha?
- Excluir é soft delete e o texto diz "Esta ação não pode ser desfeita." — existe intenção futura de um "Desfazer" no toast? Se sim, a frase muda antes do desenho.

### [Aviso de campo aposentado ao reabrir uma simulação antiga](simulacoes/aviso-de-campo-aposentado-na-simulacao.md)

- Mostrar a diferença exige guardar o preço antigo: o documento de simulação não guarda preço congelado nem versão do modelo (só o Histórico guarda). Vale mudar isso para dizer 'antes R$ 24,24 → hoje R$ 21,01', ou a declaração continua qualitativa?
- A declaração fica no topo, junto do preço, ou nos dois lugares? Se nos dois, o texto se repete igual ou o de cima vira uma linha curta que aponta para o de baixo?
- No kit, a declaração é uma só rolada para o kit inteiro, ou uma por linha afetada (nomeando quais peças tinham o campo)?
- O aviso pode ser dispensado pelo vendedor? Se sim, volta na próxima reabertura ou fica dispensado para sempre?
- Existe ação a oferecer junto ao aviso (ex.: 'salvar alterações' para o documento passar a viver no modelo atual e o aviso sumir), ou a peça é puramente informativa?

### [Barra de contexto da simulação carregada ("Simulação: {nome}")](simulacoes/barra-de-contexto-simulacao-carregada.md)

- A barra deve ficar fixa no topo ao rolar (como a spec pedia) ou continuar rolando junto com a página?
- A linha 'Base de custo: {nome}' entra na barra — e mostra o nome, o tipo ('avulsa'/'referência do catálogo'/'kit do catálogo'), ou os dois?
- Quais das cinco affordances (Abrir origem · Renomear · Duplicar · Salvar alterações · Fechar simulação) ficam expostas e quais colapsam num menu?
- Ao fechar com alterações pendentes, existe uma terceira saída 'Salvar e fechar' além de 'Voltar' e 'Descartar'?
- 'Salvar como novo' deve existir nesta barra? A copy está escrita no dicionário e nunca foi renderizada em lugar nenhum.
- A nota (até 500 caracteres) aparece na barra? Ela é salva e nunca mostrada depois.

### [A zona de salvar no fim da Calcular: "Salvar simulação" + "Salvar em Orçamentos"](simulacoes/botao-salvar-simulacao-no-calcular.md)

- Qual das duas é a ação primária no fim da Calcular — guardar a estratégia (simulação) ou registrar a cotação (orçamento)?
- Os dois salvares continuam sendo dois botões irmãos ou viram uma única ação com escolha (menu/split), como o 'Salvar cálculo' único do protótipo?
- Os rótulos ficam como estão? 'Salvar simulação' nomeia o objeto e 'Salvar em Orçamentos' nomeia o destino — não são simétricos, e a copy já foi homologada.
- Cada botão ganha legenda curta de diferenciação ('recalcula com os preços de hoje' × 'congela os valores de hoje'), somando duas linhas na dobra final?
- A ação 'Compartilhar' do protótipo de 2026-07-02 foi descartada de vez ou está pendente?

### [Busca dentro de "Minhas simulações" (campo + "nada encontrado")](simulacoes/busca-de-simulacoes.md)

- Busca offline: filtrar o cache local do aparelho, ou dizer "a busca precisa de conexão" e devolver a lista completa guardada? (hoje é servidor-only e vira parede de erro vermelha)
- Contador de resultados: mostrar sempre (como no Catálogo) ou só durante a busca — e qual a frase, já que a lista é paginada por cursor e o total não é conhecido?
- Copy do vazio de busca: manter o eco do termo ("Nenhuma simulação encontrada para “X”.") ou unificar com a frase já homologada do Catálogo ("Nada encontrado para essa busca" + "Tente outro termo, ou limpe a busca para ver tudo de novo.")?
- Mínimo de caracteres antes de disparar a busca no servidor (hoje 1 caractere já dispara), e a busca deve casar também a nota ou só o nome?

### [Cartão de simulação na lista "Minhas simulações"](simulacoes/cartao-de-simulacao.md)

- O cartão deve dizer nele mesmo que reabrir recalcula (selo permanente) ou basta a frase no subtítulo da folha?
- O cartão pode mostrar a base de custo e os canais salvos, derivados da configuração que hoje não é exposta na lista?
- As três ações seguem como ícones inline na face do cartão ou viram um menu '⋯' como o UX original pedia?
- O motivo do bloqueio (offline / Premium pausado) repete em cada cartão ou basta a faixa do topo?

### [Congelamento de escrita em Simulações — "Premium pausado" e "Modo leitura offline"](simulacoes/congelamento-de-escrita-premium-pausado-e-offline.md)

- Lapsado + offline ao mesmo tempo: mostrar as duas causas juntas ou eleger uma (hoje o código escolhe o lapso e silencia o offline, sem decisão registrada)?
- O aviso de Premium pausado deve levar ao checkout//conta? Se sim, o botão é 'Assinar novamente' (copy do painel de plano) ou uma frase nova?
- Lista vazia + lapsado: o vendedor sem nenhuma simulação salva deve ver o aviso de lapso ou o EmptyState puro basta?
- O aviso deve grudar no topo (sticky) enquanto rola uma lista longa, ou pode sair de vista depois de lido?

### [Diálogo de descarte ao fechar uma simulação com alterações não salvas](simulacoes/dialogo-descartar-alteracoes.md)

- Qual é a frase do corpo (DialogDescription) que hoje não existe? A verdade técnica é que só as edições desta sessão se perdem e a simulação salva continua como estava, mas a redação é copy de produto.
- Existe uma terceira saída "Salvar e fechar"? A copy "Salvar como novo" está no dicionário e nunca foi renderizada — funcionalidade esquecida ou copy morta? E o que ela faz offline / com Premium pausado, quando salvar é impossível?
- O diálogo deve nomear a simulação ("Descartar as alterações de “{nome}”?"), como o de excluir faz, ou o nome é ruído?
- O X de fechar do primitivo fica, duplicando o [Voltar], ou a caixa perde o escape visual e fica só com [Voltar]/[Descartar] + Esc?
- As duas confirmações destrutivas (descartar edições vs. excluir a simulação) convergem para uma anatomia única, ou a exclusão ganha um degrau a mais de atrito?

### [Duplicar-para-ajustar: a troca de contexto que hoje só um toast anuncia](simulacoes/duplicar-para-ajustar.md)

- Nome da cópia: duplicar duas vezes gera dois 'Cópia de X' idênticos — numerar ('Cópia 2 de X'), pedir o nome no ato, ou aceitar a colisão?
- Duplicar com alterações não salvas: a cópia sai do que está salvo (hoje, descartando a tela) ou do que está na tela? A chave 'Salvar como novo' existe nas mensagens e nunca foi usada — era este movimento?
- Entrada A (cartão): depois de duplicar, a folha deve fechar e a calculadora virar a cópia, ou continuar aberta mostrando a cópia na lista?
- Aviso de troca de contexto: basta o toast de 5s, ou a barra de contexto carrega uma marca permanente ('cópia de …') enquanto a cópia estiver aberta?

### [A porta "Minhas simulações" no topo do Calcular](simulacoes/entrada-minhas-simulacoes-no-calcular.md)

- A porta mostra contagem? Com paginação ("Carregar mais") o total pode não ser conhecido — sem número, teto "9+", ou nome da última simulação?
- A porta deve continuar byte-idêntica para o vendedor grátis (porta honesta) ou ganhar legenda avisando que do outro lado há uma oferta?
- "Premium pausado" aparece já na porta ou só dentro da folha? Avisar antes do clique espalha aviso de cobrança para dentro da tela de cálculo.
- A porta continua no topo (posição escolhida pelo código por ser "nav-like") ou passa a viver junto do PriceHero, ao lado de "Salvar simulação", onde nasce a intenção de salvar/reabrir?

### [Primeiro contato com "Minhas simulações" — a tela vazia](simulacoes/estado-vazio-primeira-simulacao.md)

- O CTA do vazio deve agir (conduzir ao botão "Salvar simulação" / criar uma simulação-semente) ou continuar apenas fechando o painel como "Voltar para a calculadora"?
- Se houver semente, o que ela contém — uma comparação de canais fictícia é número na tela, e o produto proíbe número sem procedência; qual o rótulo de exemplo?
- O campo de busca deve sumir quando não há nenhuma simulação salva, ou ficar desabilitado com motivo? (hoje ele renderiza sobre o nada)
- O assinante com Premium pausado e zero simulações deve ver o aviso "Premium pausado" no vazio? Hoje não vê, e o vazio o convida a salvar algo que ele não consegue salvar.

### [Estados da lista "Minhas simulações": carregando · erro frio · cache offline · paginação](simulacoes/estados-da-lista-de-simulacoes.md)

- No desktop (018), "Minhas simulações" continua sendo um sheet de 416px ancorado à direita ou vira painel mestre-detalhe como o Catálogo?
- Offline e Premium pausado ao mesmo tempo: hoje só o aviso de offline aparece — as duas verdades empilham ou uma tem precedência?
- "Carregar mais" deve declarar quantas faltam e o fim deve ser marcado ("Fim da lista · 37 simulações")? O contrato keyset não devolve total hoje.
- O motivo do bloqueio de escrita pode ser dito uma única vez no topo, em vez de repetir em cada cartão?
- O cartão deve mostrar a base de custo (produto/kit/avulsa) ou os canais, ou nome + nota + tempo é deliberadamente todo o conteúdo?

### [Folha lateral "Minhas simulações" — a lista inteira](simulacoes/folha-minhas-simulacoes.md)

- Desktop: a folha continua com 416px sobre a Calcular a 1280/1920px, ou vira painel lateral fixo/mais largo na linguagem das 4 abas de 018? (Calcular nunca foi redesenhada no desktop)
- O card deve mostrar algum número (preço, canal, nº de peças)? Hoje não mostra nenhum e comparar duas estratégias exige abrir as duas.
- Duplicar deve abrir a cópia na hora, fechando a folha (comportamento atual), ou permanecer na lista com a cópia já criada?
- Reabrir uma simulação merece retorno visual (aviso/transição) ou o silêncio atual é proposital?
- O motivo do bloqueio (offline / Premium pausado) fica só no alerta do topo ou repetido em cada card como hoje?
- Vale expor a contagem carregada e/ou ordenação alternativa, sendo que a lista é paginada por cursor e não tem total?

### [Folha "Salvar simulação" — nome, nota e o eco da base de custo](simulacoes/folha-salvar-simulacao.md)

- O eco 'Base de custo: {nome}' sobe para o topo como contexto de cabeçalho, ou continua como última linha cinza de confirmação?
- 'Base de custo: avulsa' é entendível por um vendedor leigo — existe rótulo aprovado para 'não veio do catálogo'?
- A folha deve abrir com nome sugerido (produto + data, editável) ou o campo vazio é intencional?
- Fica só o ✕ para sair, ou entra um 'Voltar' explícito (o protótipo tinha rodapé [Cancelar][Salvar])?
- Em 390px: gaveta lateral de altura cheia (como está) ou folha ancorada embaixo (como o protótipo de 'Adicionar filamento')?
- O estado 'simulação grande demais para salvar' ainda deve existir? Se sim, a recusa aparece na folha ou antes, no gatilho?

### [Renomear simulação — uma folha só, hoje são duas](simulacoes/folhas-de-renomear-simulacao.md)

- A folha canônica passa a editar a Nota também quando aberta pela barra de contexto, ou renomear é só o Nome e a nota vira outra porta?
- Qual é o rótulo do botão de confirmar, já que 'Salvar alterações' está ocupado pelo PUT da configuração inteira na mesma barra ('Salvar nome' / 'Renomear' / 'Salvar')?
- Contador de caracteres (120 / 500): mostrar sempre, só ao se aproximar do limite, ou nunca?
- Esvaziar a área de nota na folha deve mesmo apagar a nota da simulação (é o que acontece hoje pelo caminho da lista), ou remover a nota precisa de uma ação explícita?

### [Congelar um orçamento a partir de uma simulação aberta](simulacoes/registrar-orcamento-a-partir-da-simulacao.md)

- A ação fica junto da barra de contexto da simulação (ux §8) ou permanece junto do resultado que está sendo congelado?
- O rótulo do botão deve mudar com simulação carregada (ex.: 'Congelar como orçamento') ou 'Salvar em Orçamentos' atende os dois casos?
- A intro da folha deve nomear a simulação de origem, em vez do atual 'nesta tela'?
- O orçamento gerado a partir de uma simulação deve ter link de volta ('Abrir simulação' não existe hoje — só 'Abrir produto' e 'Abrir kit')?
- Na base KIT, o formulário escalar do rodapé (com números que não são os do kit) deve ser ocultado?

### [Simulação de kit reaberta dentro de Calcular](simulacoes/resumo-de-kit-na-simulacao-reaberta.md)

- O que acontece com o formulário da calculadora enquanto uma simulação de kit está aberta: esconder, desabilitar com frase, ou manter editável com aviso?
- Se o formulário continuar editável, o que 'Salvar alterações' salva — a simulação de kit ou os campos de peça única que não são dela?
- O resumo deve listar as peças do kit (nome + quantidade, excluídas marcadas) ou só total e rollup por canal?
- O título deve ser 'Kit: {nome}' ou 'Total do kit' (o rótulo já desenhado no canvas 018)?

### ["Salvar simulação" no rodapé da ficha de produto](simulacoes/salvar-simulacao-na-ficha-do-produto.md)

- Esta ação deve existir na ficha do produto? O canvas 018 desenhou a ficha com Duplicar/Excluir/Salvar alterações/Usar no cálculo e nenhuma cria simulação; a spec 010 põe todas as entradas na Calcular.
- Qual é a hierarquia entre 'Salvar em Orçamentos' e 'Salvar simulação'? Hoje as duas são secundárias e estão desalinhadas por acidente (uma à esquerda, outra centralizada).
- O rodapé deve explicar ali mesmo a diferença entre congelar um orçamento e guardar uma simulação (reaproveitando a frase já homologada em outra tela)?
- O gatilho e o botão de envio dizem os dois 'Salvar simulação' — o envio deve ter outro rótulo?
- Com Premium pausado os botões simplesmente somem numa aba que o vendedor acessou como premium; devem sumir ou aparecer inertes com a frase 'Premium pausado — reative para renomear, duplicar, editar ou excluir.'?
- O rótulo da base '(referência do catálogo)' é vocabulário do vendedor ou nosso?

### [Simulações em tela larga (≥1280px)](simulacoes/simulacoes-no-desktop.md)

- Simulações vira mestre-detalhe como Catálogo/Kits/Orçamentos? Se sim, o que a ficha da direita mostra — hoje não existe prévia de simulação, abrir uma simulação É preencher a calculadora.
- A área continua dentro da aba Calcular (folha sobre a calculadora) ou Simulações ganha lugar próprio no menu no desktop, já que 'Calcular Desktop' está fora deste incremento?
- A copy de celular homologada ('toque em “Salvar simulação”', 'Voltar para a calculadora') ganha versão de desktop?
- A barra de contexto da simulação aberta fica fixa no topo enquanto o vendedor rola a calculadora, ou rola junto com o conteúdo?

### [Porta honesta do Premium dentro da folha "Minhas simulações"](simulacoes/teaser-premium-dentro-da-folha-de-simulacoes.md)

- O bloco de venda dentro da folha deve ganhar o ícone e o card do canvas 018, ou o painel estreito pede uma forma própria?
- Vale mostrar uma amostra do que o Premium destrava (cartões de exemplo rotulados), já que hoje não existe nenhuma?
- No desktop, 'Minhas simulações' deve continuar como painel de 416px à direita ou virar superfície mais larga como as outras abas do canvas 018?
- Deslogado e grátis continuam vendo exatamente a mesma tela, ou o deslogado merece um 'Entrar' separado do 'Assinar Premium'?
- Offline: o 'Assinar Premium' aparece desabilitado com motivo dito, ou permanece ativo e falha honestamente depois?

## Billing, planos e Conta (89)

### [Aviso de hand-off de pagamento (a garantia que cerca o botão "Assinar Premium")](billing/aviso-hand-off-pagamento.md)

- A garantia vem ANTES ou DEPOIS do botão? Protótipo diz antes, código faz depois, canvas 018 não mostra nada — qual autoridade vale?
- O logo do Mercado Pago aparece no aviso? (confiança do vendedor vs. regras de uso de marca de terceiro)
- As duas frases viram UMA linha só? Fundir mexe em copy já homologada.
- "Pix ou cartão" continua verdade nos DOIS planos? Se a assinatura anual recorrente não aceitar Pix, a frase mente para metade dos compradores.

### [Aba Conta no celular — a coluna única (identidade · plano · tema · privacidade · Sair)](billing/conta-mobile-empilhada.md)

- O vendedor gratuito ganha de volta um cartão de valor do Premium no celular (o "TRUTH'S FORGE PREMIUM" do protótipo de 2026-07-02), ou a linha de plano + o botão bastam?
- O aviso de privacidade continua entre o tema e o Sair, vai para o fim (abaixo do Sair) ou vira um bloco recolhido?
- Os cartões passam a viver sob títulos de seção ("Preferências" / "Sobre seus dados"), como o protótipo antigo fazia, ou seguem soltos?
- Volta um rodapé de versão/build ("Precifica3D · v…")? Hoje o suporte não tem número para pedir.
- O aviso de privacidade ganha link para a política completa? Hoje o código deliberadamente não tem um.
- O botão "Recarregar" fica sempre visível, ou só nos estados em que recarregar resolve algo (desconhecido, offline, recém-assinado)?

### [Botão "Assinar Premium" — os três estados que ninguém desenhou](billing/cta-assinar-estados.md)

- Quando a falha é do aparelho (offline), o app pode dizer "Você está sem conexão" em vez de atribuir ao Mercado Pago?
- O 409 deve ganhar uma ação explícita para concluir no Mercado Pago, ou continua sendo só uma frase para reler e esperar?
- Durante o pending, o rótulo pode trocar de "Assinar Premium" para "Abrindo o Mercado Pago…", ou a frase entra como legenda separada abaixo?
- Para quem não está logado, o toque deve avisar que o próximo passo é entrar, ou continua navegando direto para o login sem intermediação?

### [Diálogo "Cancelar a assinatura?" — a única ação destrutiva paga do produto](billing/dialogo-cancelar-assinatura.md)

- As duas saídas devem ter a mesma largura? (igualá-las foi a opção considerada e não escolhida no remendo de 015/A8)
- Ordem e posição: 'Voltar' continua à esquerda do destrutivo, ou o destrutivo se afasta para não ser o alvo mais próximo do polegar no mobile?
- O '✕' de fechar no canto continua, já que duplica a função de 'Voltar'?
- Perguntar o motivo do cancelamento? (não existe hoje e a §5 proíbe atrito)
- Quando a cortesia sobrevive ao fim do período pago, a caixa deve avisar ANTES de confirmar (hoje só o painel avisa depois)?

### [Bloco "Marketplace" trancado na calculadora (gratuito)](billing/gate-marketplace-faixa-de-preco.md)

- Premium pausado (lapsed) deve ver 'Assinar Premium' como hoje ou uma variante de reativação que reconheça o cliente antigo?
- O interruptor morto permanece visível como afordância travada ou dá lugar a outra representação da tranca?
- O gratuito pode ver a estrutura do que compraria (lista de canais suportados ou exemplo rotulado como ilustrativo), ou vale sem exceção a regra 'nenhum número de canal, nem de exemplo'?
- Enquanto o app verifica o direito, é aceitável mostrar a oferta de imediato (pode oferecer compra a quem já paga) ou o bloco deve exibir estado neutro de espera?
- O §I do protótipo ('computar é sempre grátis') fica formalmente revogado, ou alguma parte do cálculo com canal continua livre (ex.: um único canal)?

### [Cartão de identidade da Conta — carregando, sessão expirada e falha](billing/identidade-carregando-e-erro.md)

- Na sessão expirada, a ação de volta é 'Entrar de novo' (preservando a Conta como retorno, precedente do Histórico) ou 'Sair' (descarta a sessão morta)?
- Sessão expirada é problema deste cartão ou da página inteira? O cartão Plano ao lado também falhará — duas tarjas vermelhas empilhadas dizendo a mesma coisa, ou um aviso único no topo da Conta?
- O rótulo 'Conectado como' entra no cartão resolvido (o canvas o desenha, o app não o renderiza)? Antes ou depois do e-mail?
- Quando o e-mail é nulo e sobra o uid opaco: mostrar o uid cru, um texto de 'conta sem e-mail', ou tratar como falha?

### [Oferta de assinatura aberta por quem JÁ é Premium](billing/oferta-ja-e-premium.md)

- A folha deve oferecer gestão ('Gerenciar assinatura' no Mercado Pago, 'Cancelar assinatura'), duplicando o cartão de plano da Conta, ou só uma saída neutra ('Fechar' / 'Voltar para a Conta')?
- O título da folha muda? Hoje continua 'Assinar o Premium' para quem já assina — se muda, para qual frase?
- Em carência (assinatura ativa mas cobrança falhou), esta tela continua dizendo só 'Você já é Premium.' ou traz o problema de pagamento à frente?
- A data de fim do acesso (ex.: 23/09/2026), que o app já conhece e o painel ignora, entra aqui como 'renova em …' ou fica só no cartão de plano da Conta?

### [Gaveta "Assinar o Premium" (mobile, abaixo de 1280px)](billing/oferta-mobile-gaveta.md)

- A gaveta deve subir do rodapé (85vh, cantos superiores) em vez de entrar pela direita — o 'direita' de hoje é só o padrão do primitivo?
- Volta o botão de dispensa 'Agora não' do protótipo de 2026-07-02, ou o X basta?
- O cartão anual deve vir primeiro na lista, já que é o recomendado e o pré-marcado?
- Os quatro benefícios do protótipo ('NO PLANO GRÁTIS VOCÊ TEM' + linhas com cheque) voltam para a gaveta, ou o corpo de uma linha é a versão final?
- Quem já é Premium ou está com o Premium pausado deve ver esta gaveta, e com que conteúdo?
- 'Abrindo o Mercado Pago…' deve aparecer no CTA enquanto envia? A frase existe na copy e nenhuma superfície a mostra.

### [Linha do plano na Conta — cancelamento agendado ("ativo até 31/12/2026 · não renova")](billing/plano-estado-cancelamento-agendado.md)

- Ratificar ou derrubar a §10-F1: a frase 'Seu acesso de cortesia continua depois disso.' fica — e como (terceira frase emendada, linha própria, ou substituindo a data de corte)?
- Existe caminho para RETOMAR a assinatura antes da data de corte, ou o único caminho é um checkout novo (o rótulo 'Assinar novamente' afirma a segunda hipótese)?
- O desenho pode mostrar contagem regressiva ('faltam 12 dias') ou só a data — dado que contagem pressiona e a política sem padrão escuro é decisão do dono?
- O selo deve carregar alguma marca de 'agendado' (ponto, sufixo) ou o verde puro + legenda bastam?

### [Linha do plano na Conta — o estado de CARÊNCIA (pagamento recusado, prazo correndo)](billing/plano-estado-carencia.md)

- A carência deve mostrar dias restantes além da data, ou só a data?
- A frase escrita e nunca exibida 'Mudou de plano agora?' deve aparecer ao lado de 'Recarregar' ou ser apagada?
- Em carência deve haver algum caminho de reassinatura/troca de plano no app, ou o botão do Mercado Pago é a única saída?
- Além da cor info, a carência pode ganhar marcação de forma (faixa, ícone, contorno) — e vale para o card inteiro ou só para o par de frases?

### [A linha do plano quando o Premium é CORTESIA (grant de operador / programa beta)](billing/plano-estado-cortesia.md)

- O selo da cortesia deve ser o mesmo 'Premium' verde do assinante, ou uma variação que diga no próprio selo que o acesso é temporário?
- A linha de cortesia deve oferecer assinar — sempre, ou só a partir de N dias do vencimento? E abre a oferta inline no desktop como 'Gratuito' e 'pausado'?
- Existe um estado 'vencimento próximo'? A partir de quantos dias, e ele muda tom, ganha nota ou só ganha botão?
- Deve haver uma segunda linha dizendo o que acontece no dia seguinte ('seus itens continuam disponíveis para leitura'), que hoje só aparece depois de pausar?
- Quando a fonte do grant não é 'beta' nem 'comp', o texto cai em 'cortesia' — serve, ou deve existir um rótulo neutro?

### [Linha do plano na Conta: "não consegui confirmar" e "esse dado é de antes"](billing/plano-estado-desconhecido-e-defasado.md)

- O rótulo do "não sei": selo curto (ex.: "Não confirmado") com a frase completa fora dele, ou a frase inteira continua sendo o selo?
- Carregando é visível ("Verificando seu plano...") ou esqueleto silencioso até haver resposta?
- A marca de dado defasado vira elemento (chip/ícone) ou continua sufixo textual — e convive com a faixa global de offline ou uma suprime a outra?
- No plano gratuito a legenda vira só o fragmento "última informação do servidor", sem sujeito: aceita assim ou quer frase completa (copy nova)?

### [Linha do plano na Conta — o estado "Premium pausado"](billing/plano-estado-pausado.md)

- O selo do pausado deve ganhar tom próprio (informativo/perigo) ou permanecer neutro como o Gratuito?
- A tranquilização deve sair da legenda --fs-caption e virar bloco/faixa própria com as duas metades (o que continua e o que trava)?
- "Assinar novamente" deve ser a ação primária preenchida desta linha, ou continuar do mesmo peso que "Recarregar"?
- No desktop a oferta inline já abre automaticamente para quem está pausado — isso é desejado para um ex-pagante, ou deve ficar fechada até ele pedir?
- O painel pode mostrar quando o Premium pausou ou até quando a leitura dura? Hoje o wire só traz none|active|lapsed — seria mudança de contrato.

### [Retorno do checkout — a espera "Confirmando seu pagamento…"](billing/retorno-checkout-aguardando.md)

- Mostrar a passagem do tempo como quê — contador de tentativas, barra determinada de ~45s ou só uma legenda? E qual a frase exata (copy nova precisa de ratificação).
- "Atualizar" continua existindo? O corpo promete que nada é preciso, e o mesmo gesto já virou "Recarregar" no painel de plano para não colidir com o botão do Mercado Pago.
- O trilho de navegação e as abas continuam visíveis e clicáveis durante a espera, ou a tela é focada sem navegação até haver desfecho?
- Sem conexão: qual é a frase? Precisa ser distinta de "Ainda não recebemos a confirmação" e não pode afirmar nada sobre a cobrança.
- Depois do "não confirmado" existe caminho de suporte (falar com a gente, consultar o comprovante no MP), ou o único destino continua sendo voltar para a Conta?
- "Verificar de novo" deve abrir outra rodada de ≈45s com a mesma tela de espera, ou uma verificação única com resposta imediata?

### [Retorno do checkout — "Ainda não recebemos a confirmação"](billing/retorno-checkout-nao-confirmado.md)

- Existe canal de suporte para quem pagou e não vê o Premium? (não há e-mail, WhatsApp ou formulário em lugar nenhum do produto)
- Mostrar o 'Código de suporte:' (correlationId) nesta tela, como já acontece na tela de erro técnico?
- A tela deve lembrar qual plano a pessoa tentou assinar (R$ 15,99/mês ou R$ 155,88/ano)?
- Qual das duas leituras vem primeiro — 'se você concluiu' ou 'se você não concluiu'?
- A espera pode ser esticada por escolha da pessoa além dos 45s, ou o único caminho é sair e voltar depois?

### [Retorno do checkout — a única confirmação de compra do produto](billing/retorno-checkout-sucesso.md)

- A confirmação vira recibo? (plano + valor pago + data da próxima cobrança exige consultar o espelho do PSP no retorno, além do direito — os três dados ou só plano + próxima cobrança?)
- Link para o comprovante do Mercado Pago em nova aba, ou o comprovante fica exclusivamente por e-mail do MP?
- Para onde vai o botão principal? Hoje é sempre "Ir para a calculadora", descartando a intenção do teaser (TEASER_UPGRADE_TARGET) que o app carregou até o pagamento. Volta para a superfície de origem? E o padrão sem intenção guardada: calculadora ou Conta?
- Quantas ações no sucesso — uma só, ou primária de destino + secundária "Ver minha assinatura" para o painel de plano na Conta?
- A espera de ~45s deve ser visível (contagem/barra/"verificando há alguns segundos") — honestidade a mais ou ansiedade a mais?

### [Teaser do "Usar do catálogo" na calculadora — com o controle trancado à vista](billing/teaser-picker-calculadora.md)

- Qual decisão vale: o desenho de 2026-07-02 (esconder o controle + link discreto "Ver Premium") ou a inversão implementada (controle morto visível + CTA de compra com preço)?
- Se o controle trancado fica, ele deve aparecer no lugar onde o seletor real vive (acima da promessa, com a forma dos campos "Filamento salvo"/"Impressora salva") em vez de abaixo do botão de compra?
- O controle trancado deve mostrar a forma do recurso (dois seletores desabilitados com exemplos) ou continuar um único botão genérico?
- Tocar no controle trancado deve fazer algo (levar à oferta, abrir explicação) ou continuar inerte e invisível ao teclado?
- No desktop (até 1120px) o teaser ganha composição de duas colunas ou fica estreito e centrado como no mobile?

### [A oferta Premium dentro da gaveta "Minhas simulações"](billing/teaser-simulacoes-na-folha.md)

- A âncora do CTA: 'Assinar Premium' logo abaixo do texto (topo) ou fixado no rodapé do painel?
- O vazio vertical no desktop: fica vazio, ganha prova de valor, ou o painel deixa de ter altura total no estado de teaser?
- A regra do CTA único: a oferta vive só na gaveta (apagando o card atrás, como hoje) ou a página mantém o card e a gaveta abre sem oferta?
- O que a gaveta mostra enquanto o plano é verificado — hoje mostra a lista vazia por um instante e depois troca pelo teaser.

### [O reconhecimento do cancelamento da assinatura](billing/toast-cancelamento-confirmado.md)

- Um aviso que some em 5s basta como recibo de cancelamento, ou uma ação de cobrança exige um toast que só sai por dispensa manual e/ou um destaque temporário na linha do plano?
- O toast deve carregar uma ação ("Ver plano" / "Assinar novamente") ou permanece só texto + fechar?
- Existe recibo fora do app (e-mail do Mercado Pago) que o toast possa citar? Se existe, a frase muda.
- No desktop 018, o toast ancora no canto inferior direito (por cima da área da ficha de 560px) ou passa a nascer dentro da coluna de conteúdo, ao lado do painel que o originou?

## Shell e navegação (60)

### [Faixa de sessão expirada — o caminho de volta quando o servidor recusa a sessão](shell/banner-sessao-expirada.md)

- A faixa pode ser dispensada? Hoje não pode — se puder, qual é o caminho de volta depois de dispensar?
- Tom `info` ou `danger`? O código escolheu `info` porque nada foi destruído; é decisão de produto (alarmar para agir vs. acalmar para continuar).
- A faixa do shell deve contar quantos registros ficaram parados ("3 registro(s) não foram enviados") ou isso continua só dentro de Orçamentos, gerando duas tarjas?
- Quando offline e sessão expirada acontecem juntos, quem manda? "Entrar de novo" é impossível de executar sem rede.

### [Diálogo de saída com orçamentos ainda não sincronizados](shell/dialogo-saida-fila-pendente.md)

- O diálogo deve mostrar QUAIS registros estão em jogo (rótulo, data, preço, estado) ou continua sendo só uma contagem?
- O descarte deve ser tudo-ou-nada? Hoje 'Sair e descartar' apaga a fila inteira, misturando entradas que passariam com entradas que nunca vão passar.
- Qual é a ação primária quando o vendedor está offline — hoje sobra só o botão vermelho; 'Voltar' deve virar o primário nesse estado?
- 'Sair e descartar' deve ter o mesmo peso visual de 'Sincronizar agora' no passo 1?
- Plural: '1 registro(s)' fica ou a copy passa a flexionar — e o produto já renomeou Histórico para Orçamentos, mas estes textos ainda dizem 'registro'.
- Entradas bloqueadas por Premium: o diálogo oferece reativar ali, ou isso é upsell no pior momento e fica fora?

### [Entrar — a porta de entrada e a moldura em volta dela](shell/entrar-dentro-do-shell.md)

- Login dentro ou fora do shell? O protótipo (§F item 7 + LoginScreen.jsx) pediu fullscreen; o código entrega emoldurado — e a decisão também define o caminho de volta no 'sair'.
- Se ficar emoldurado, o menu continua clicável nos itens que exigem login (4 dos 5 devolvem o usuário para a mesma tela) ou eles aparecem marcados como 'precisa entrar'?
- A proposta de valor volta? 'Forje o preço certo' + 'Precifique suas impressões 3D com a conta transparente — do material à margem.' estavam desenhadas e não foram implementadas.
- Rodapé legal: fica só o link 'Como tratamos seus dados' ou volta a frase do protótipo sobre Termos e Política de Privacidade? Não existe página de Termos hoje.
- O controle 'Alternar tema' aparece na tela de entrada? É o único elemento visível da barra superior nessa rota.
- A promessa 'Login por Google. Mais opções em breve.' continua de pé?

### [Erro global e 404 emoldurados pelo shell](shell/erro-e-404-dentro-do-shell.md)

- O erro e o 404 ficam DENTRO ou FORA do shell? O código os põe na rootRoute (dentro); o protótipo falava em 'link de volta ao shell' (fora).
- Se ficarem dentro, o menu continua clicável quando a própria árvore de rotas falhou? Hoje continua, e o clique pode levar a outra tela de erro.
- 'Voltar para Calcular' continua sendo a ação do 404 quando 'Calcular' já está visível no menu ao lado?
- O código de suporte (UUID de 36+ caracteres) ganha botão de copiar? Ele existe para ser transmitido a um humano.
- A tela branca de dois segmentos (016/A4) entra neste desenho ou vira peça própria?

### [A faixa intermediária: o shell entre 600px e 1023px](shell/faixa-intermediaria-600-1023.md)

- Na faixa 600–1023px o menu deve nascer recolhido (rail de 76px) ou expandido a 240px?
- Deve existir o botão Recolher/Expandir nesta faixa, hoje exclusivo de ≥1280px?
- A coluna de conteúdo continua travada em 460px até 1024px ou cresce com a janela — e com que teto?
- Vale antecipar uma composição de duas colunas antes de 1280px (lista + ficha mais estreita a partir de 1024px)?
- O tablet em paisagem (1024–1279px) segue o desenho desta faixa ou o do desktop?

### [Página "Como tratamos seus dados" (rota /privacidade)](shell/pagina-privacidade.md)

- "Termos de Uso" existem? O kit de login antigo prometia "os Termos e a Política de Privacidade", mas só a Política existe hoje — o desenho cita um documento ou dois?
- A página deve mostrar data de vigência/versão ("Atualizado em {data}")? Não existe hoje e criar o carimbo obriga a mantê-lo.
- A relação página × cartão da Conta: o cartão continua com 2 frases e sem link (como o canvas 018 desenhou) ou vira resumo com "Ler a política completa"?
- O botão de voltar, para quem chega deslogado, leva a /sign-in (a origem real) ou a /calcular (a única tela pública de produto)? O menu não tem "Entrar".
- A frase do Sentry pode ganhar cinco palavras de explicação ("um serviço que nos avisa quando algo quebra") ou a redação ratificada é intocável?
- O texto deve dizer o que acontece com o catálogo salvo quando o Premium acaba (lapso/pausa)? Hoje a política é silenciosa.
- Existe um canal/e-mail de contato para pedido sobre dados? Sem isso o desenho não pode oferecer "Fale conosco".

### [A região de avisos do topo do shell (quando são DUAS faixas)](shell/pilha-de-faixas-do-topo.md)

- Quando as duas aparecem juntas, empilha ou uma suprime a outra? (offline torna 'Entrar de novo' inoperante)
- A faixa de offline deve virar sticky também, ou continua rolando embora?
- No desktop as faixas atravessam por cima do menu lateral ou começam depois dele (só na coluna de conteúdo)?
- O vendedor pode dispensar alguma das faixas — e se puder, quando ela volta?
- Existe teto/prioridade para faixas simultâneas se surgir um terceiro aviso (plano pausado, cobrança em atraso)?

### [Menu recolhido à força — a faixa de 426px a 599px](shell/rail-forcado-426-599.md)

- A resposta a "não cabe" é o rail forçado, ou é manter a barra inferior do celular até 599px (mover o corte de 425px para 599px)?
- Como o vendedor descobre o nome das cinco seções sem mouse: rótulo miúdo sob o ícone dentro dos 76px, revelação ao toque, ou gaveta temporária sobre o conteúdo?
- O cabeçalho encolhe junto abaixo de 600px (logotipo vira só a marca, "Conectado como {e-mail}" some) ou fica como está numa coluna de ~350px?
- A descontinuidade em 600px é aceitável — o menu reabre para 240px e segue sem botão de recolher até 1280px — ou o botão deve nascer já a partir de 600px?

### [Região de toasts — onde a confirmação do app aparece, empilha e some](shell/regiao-de-toasts.md)

- Quantos toasts podem coexistir? Hoje é ilimitado — teto de 3 com descarte do mais antigo, ou agrupar ('+2 mensagens')?
- Qual o limiar de posição? A região troca de canto a 768px, mas o desktop do 018 começa a 1280px e a barra de abas some a 425px — um único limiar ou os três continuam?
- O tom 'neutral' deve existir? Nenhuma chamada do app o usa — ganha papel ou o desenho fixa três tons?
- Erro deve auto-dispensar? Os 5000ms valem igualmente para 'Kit salvo.' e para 'Não foi possível guardar o registro neste aparelho. Ele não foi salvo.'
- Toast disparado com folha aberta: aparece por cima do véu, ou a folha exibe a mensagem internamente e o toast só surge depois que ela fechar?

### [O shell deslogado — o app inteiro antes de existir uma conta](shell/shell-deslogado.md)

- O convite deslogado deve dizer "Entrar" (copy já existente) ou "Criar conta" (o que o vendedor de primeira viagem realmente faz)?
- O convite fica permanente na barra superior ou aparece só quando o vendedor esbarra na fronteira do freemium?
- Os itens gateados do menu devem ganhar marca visual (cadeado/badge) para o deslogado, ou isso vende o produto como bloqueado antes de mostrar valor?
- Quando um deslogado toca em "Assinar Premium" no teaser ele cai no login sem aviso: o botão muda de rótulo para o deslogado, ou o login explica que é etapa da assinatura?
- O controle segmentado de tema ("Claro"/"Escuro") do canvas 018 vale também no estado deslogado, ou o deslogado fica com o botão-ícone atual?

### [Barra de abas inferior do mobile — as 5 seções](shell/tabbar-mobile-cinco-abas.md)

- Quando "Orçamentos" não couber em 360px: truncar com reticências, abreviar (qual palavra?), reduzir a fonte abaixo de 12px, ou só-ícone nos inativos?
- A pílula de 28×3px do ativo fica, ou o ativo volta a ser marcado só por cor como o protótipo de 2026-07-02 manda?
- A barra deve sinalizar estado do app (offline, orçamento na fila do outbox, Premium pausado) com um indicador sobre o ícone, ou isso segue exclusivo da faixa do topo?
- Kits continua como uma das cinco seções de topo para o usuário gratuito, ou a IA de cinco itens deve ser reavaliada agora que os rótulos ficaram mais longos?

### [Barra superior do mobile (56px): marca, "Sair" e tema](shell/top-bar-mobile.md)

- Vale a migração do protótipo (§E3/TD-017): 'Sair' e tema saem da barra do mobile e ficam só na aba Conta, deixando a faixa com a marca sozinha?
- Se ficarem nos dois lugares (barra + Conta), qual manda e o que justifica a repetição?
- Se o tema ficar na barra, o rótulo deve dizer o destino ('Modo claro'/'Modo escuro') em vez de 'Alternar tema'?
- A marca no mobile continua centralizada ou passa a alinhada à esquerda como no desktop do 018?

## Primitivos do Design System (84)

### [O anel de foco — a única pista de onde o cursor está](design-system/anel-de-foco.md)

- 2px ou 3px? O token exportado do Claude Design diz 3px + halo 28%; o app redefiniu 2px em camada única com justificativa escrita no comentário — uma das duas fontes precisa deixar de ser verdade.
- Uma linguagem só, ou três com regra? Vale desenhar 'anel colado nas superfícies, contorno afastado nas pílulas, anel interno no menu' como REGRA, ou o desenho deve unificar tudo numa forma?
- O grupo segmentado migra de --accent para --focus-ring? Isso muda a cor do anel dele no tema escuro (#7800ff → #9a4bff), hoje o único anel roxo escuro sobre bandeja escura.
- O 'abrir/fechar' da árvore do seletor de categorias ganha anel? Hoje só troca a cor do texto no foco (cor como único sinal).
- Existe um 'pular para o conteúdo'? Não há nenhum no app; sem ele, todo Tab de toda página começa percorrendo a navegação inteira — decisão de produto, não de estilo.

### [Botão: carregando, desabilitado e com brilho](design-system/botao-carregando-e-desabilitado.md)

- O rótulo troca durante o carregamento (protótipo: 'Entrando…') ou permanece intacto como nos 25 casos do app? Trocar exige ~24 frases novas e ainda mexe na largura.
- O brilho (glow) fica ou sai do DS? Hoje tem ZERO usos no app inteiro; se fica, quais são as 'zonas' e qual é o CTA focal de cada uma.
- Todo botão desabilitado passa a exigir motivo visível? Hoje só 'Exportar' e a barra de simulações mostram; os demais ficam mudos — sim implica escrever ~20 frases de motivo.
- O tamanho sm de 36px é intenção ou engano? Ele é impossível hoje (min-height 44px vence): ou vira oficialmente 44px, ou precisa de exceção declarada de alvo para densidade em desktop.

### [Botão destrutivo: `danger` (sólido) e `danger-ghost` (contornado)](design-system/botao-destrutivo.md)

- O rótulo branco sobre o vermelho base reprova o AA (~4,0:1 medido, rótulo 16px semibold). Trocar o repouso do sólido para o vermelho profundo (o atual hover, ~5,9:1), mudando a cara do botão em cinco telas já homologadas, ou manter e registrar a exceção?
- Regra única para o gatilho de exclusão fora do diálogo: hoje convivem lixeira-ícone ghost (Simulações), botão secondary cinza (Histórico) e danger sólido (registro pendente), e o canvas 018 usa danger-ghost. Padronizar tudo no contornado, inclusive na lista de Simulações?
- 'Descartar' e 'Excluir' são dois verbos para duas coisas diferentes (o que nunca chegou à conta vs. o que já está salvo). A distinção é intencional e fica, ou unificamos em 'Excluir'?

### [Campo — a terceira camada de mensagem (o aviso de plausibilidade)](design-system/campo-aviso-de-plausibilidade.md)

- O aviso de campo ganha ícone (ou outro sinal que não seja cor), sabendo que qualquer glifo de alerta pode ser lido como recusa?
- Com erro E valor implausível no mesmo campo, o aviso deve sumir (comportamento atual) ou aparecer abaixo do erro?
- O controle (tf-inputwrap) deve sinalizar o aviso — borda ou afixo em tom info — ou o sinal fica só na linha de texto abaixo?
- O dinheiro dentro das frases sai sem centavos ('R$ 3.000', 'R$ 0,1234'); padroniza em R$ 1.234,56?
- 'Nada foi recusado.' repete no fim de todas as frases: vira elemento fixo da peça ou continua como parte do texto de cada mensagem?
- Na linha de kit o aviso aparece em text-sm e fora de um campo — é a mesma peça em dois tamanhos ou normaliza no caption do Field?

### [Campo de texto — a moldura que 21 telas remontam à mão](design-system/campo-de-texto-sem-primitivo.md)

- Contador de caracteres: sempre visível (12/120), só perto do limite, ou nunca — e em quais dos três campos com limite?
- Ação de limpar dentro do campo de busca: 'x' permanente enquanto há texto, ou o botão 'Limpar busca' segue existindo só no estado sem resultado?
- Qual é a forma canônica da busca — rótulo visível (Orçamentos) ou lupa + placeholder com rótulo só para leitor de tela (Catálogo)? As duas estão em produção.
- A nota da simulação (500 caracteres) cresce sozinha conforme se digita, ou tem altura fixa de três linhas com rolagem interna?
- 'Nota (opcional)' dentro do texto do rótulo vs. a tag 'opcional' da própria moldura — qual das duas gramáticas fica valendo no app?

### [Cartão — clicável, selecionado, e as três variantes que nunca foram vistas](design-system/cartao-clicavel-e-selecionado.md)

- O selecionado do Catálogo pinta o fundo? O desenho de 2026-07-02 (l.601) marca só a borda --accent; o código (catalog-master-detail.css:66) também pinta --accent-soft, igual ao de Orçamentos. As duas telas devem dizer "escolhido" da mesma forma, ou o Catálogo é discreto de propósito?
- O cartão de Orçamentos levanta no hover? O desenho (l.280) usa tf-card--interactive; o código usa um <Card> comum dentro de um <Link>, sem hover-lift nem anel de cartão. Hoje as duas listas clicáveis do desktop se comportam diferente.
- As variantes inverse, accent e ghost ficam ou são aposentadas? Nenhum dos 36 usos de <Card> no app passa variant — as três nunca foram usadas nem desenhadas em contexto.
- O selo (tf-badge) no canto superior direito do cartão do Catálogo existe no desenho e não no código: que informação ele carrega — o aviso "pode estar desatualizada" / "somente leitura", ou outra coisa?

### [Densidade dos primitivos no desktop (≥1280px)](design-system/densidade-desktop-dos-primitivos.md)

- O piso de toque de 44px cai acima de 1280px (laptop com tela sensível a toque é PWA também) ou se mantém?
- A altura padrão de controle a ≥1280 vira 48, 44 ou 40px? O canvas usa tf-btn--sm (36px) em quase tudo — isso é a resposta pretendida ou só o que coube no encaixe?
- A reserva de DUAS linhas do .tf-field__label (problema de grade 2-col de celular) morre no desktop?
- A folha lateral vai a 560px (medida da ficha do 018) ou fica no teto atual de 26rem/416px? Hoje as duas medidas se contradizem.
- O tf-empty segue centralizado em 28rem/448px dentro de uma coluna de 1720px, ou passa a ocupar a coluna da lista?
- O toaster continua trocando de posição a 768px (única @media de largura existente) ou o corte dele também passa para 1280?

### [A caixa de confirmação central (excluir · sair · cancelar assinatura)](design-system/dialogo-modal-central.md)

- O X vira regra ou some? Hoje 6 caixas prendem a saída e 4 não — toda confirmação destrutiva se fecha só escolhendo, ou toda caixa pode fechar no X com o 'Voltar' como saída segura?
- A inversão de hierarquia de 2026-08-03 (saída segura preenchida, ação destrutiva em danger-ghost) vale para todas as confirmações irreversíveis ou continua exclusiva do cancelamento de assinatura? Muda o desenho de 8 caixas.
- A CAIXA ALTA do título continua caindo sobre nome digitado pelo usuário ('EXCLUIR “PLA VERMELHO 1KG”?') ou o nome mantém a grafia original dentro de um título em caixa alta?
- A caixa de 'Recalcular hoje' deve mostrar o número (ex.: de R$ 24,24 para R$ 27,80) antes de confirmar, ou o novo valor continua aparecendo só depois, no registro criado?

### [Carregando — o anel que substituiu o esqueleto](design-system/estado-de-carregando.md)

- O esqueleto substitui o anel em todas as listas, ou o anel fica como padrão para esperas sem forma conhecida (gate de plano, verificação de sessão, retorno do checkout)?
- As sete esperas mudas ganham rótulo visível? Se sim, qual frase para Catálogo, Orçamentos e Simulações — hoje só o leitor de tela ouve "Carregando…".
- Existe limiar de tempo? Depois de N segundos a espera muda de aparência ou ganha uma frase do tipo "está demorando mais que o normal"? Nenhuma regra desse tipo está escrita.
- No mestre-detalhe (≥1280px), durante a carga o painel da ficha mostra esqueleto também ou fica vazio com uma frase de instrução?
- Recarregamento de dados já em tela (revalidação/pull-to-refresh): sinal discreto no topo ou nada? Hoje o estado de carregando cobre só a primeira carga.

### [Estado vazio (`tf-empty`) — a arte que virou ícone, e o vazio da busca](design-system/estado-vazio.md)

- Arte (Grafismo) ou o quadrado de 56px com ícone — e vale arte só no vazio frio?
- O vazio sem direito ("Salvar faz parte do Premium.") ganha saída/ação, ou continua sem nenhuma?
- Largura a 1920px: continua max-width 28rem centrado na coluna de ~1720px, ancora à esquerda ou ocupa a coluna?
- O mobile ganha busca no Catálogo (e portanto o vazio de busca), ou ela segue só ≥1280px?
- Duas ações (primária + secundária) viram regra da peça, encerrando o hábito de pôr o botão fora do bloco?
- Os vazios de busca de Orçamentos e Simulações ganham a segunda linha que o Catálogo já tem, ou são deliberadamente mais secos?

### [Folha lateral (Sheet) — a superfície que hoje entra pela direita sem ninguém ter escolhido](design-system/folha-lateral-direita.md)

- No celular a folha volta a entrar de BAIXO (como os dois únicos protótipos e o §D.2) ou fica na direita que o código escolheu sozinho? Muda gesto de sair, cantos, altura e a relação com o 'voltar' do Android.
- Fechar com alterações não salvas vira regra do primitivo (confirmar sempre, como a barra de contexto de cenário) ou continua caso a caso?
- Título e × grudam no topo durante a rolagem, ou continuam rolando junto com o conteúdo como hoje?
- `.tf-dialog--sheet-left` é código morto sem nenhum consumidor: some do sistema ou existe um uso previsto que nunca foi escrito?

### [Grupo segmentado — a bandeja com pílulas (tf-segmented)](design-system/grupo-segmentado.md)

- Foco: mantém o outline próprio (2px, --accent, offset 2px) ou volta ao anel --ring que todos os outros primitivos usam? É a única exceção do DS hoje.
- Pista de rolagem no mobile: desvanecimento na borda direita, setas, ou nada?
- Premium pausado: a bandeja deve sinalizar o só-leitura, ou o aviso continua só no painel de baixo?
- Tamanho `md`: ninguém usa hoje — fica desenhado como opção do sistema ou é aposentado?

### [Dica de ajuda ⓘ (InfoTip) — gatilho e cartão aberto](design-system/info-tip-de-ajuda.md)

- O cartão aberto ganha título visível repetindo o label ('Sobre a tarifa de energia'), ou continua um parágrafo sem cabeçalho?
- A mesma peça serve para os dois papéis — explicar a conta e carregar o corpo de um aviso comprido (Shopee) — ou são dois componentes distintos?
- As quatro abas desktop do 018 (Catálogo, Kits, Orçamentos, Conta) passam a ter ⓘ? Hoje têm zero, mas mostram números derivados sem explicação.
- Na variante compacta do aviso Shopee, o ícone decorativo de 20px permanece, duplicando o glifo do gatilho na mesma linha?

### [Interruptor (Switch) — a trilha, o polegar e o alvo que ninguém enxerga](design-system/interruptor-de-tema.md)

- O desabilitado por falta de Premium deve ser visualmente igual a qualquer outro desabilitado (opacidade 0,55) ou merece tratamento próprio (cadeado/cor), já que a frase 'Vender em marketplaces faz parte do Premium.' aparece logo abaixo?
- Clicar no rótulo deve alternar o interruptor nos quatro casos? Hoje alterna só na lista de sobretaxas; na Conta e na folha de exportação o texto é inerte — uniformizar muda o tamanho real do alvo e aproxima o aviso de exposição de custos de um clique acidental.

### [NumberField — o campo de dinheiro e o instante em que ele reescreve o próprio texto](design-system/numberfield-mascara-de-milhar.md)

- A máscara de milhar vale só para campos de dinheiro (comportamento atual) ou também para numéricos grandes sem R$ — 'Vida útil da máquina' 3600 h e 'Gramas usadas' — que hoje aparecem sem ponto ao lado de 4.000,00?
- Ao voltar o foco a um campo já mascarado, o texto deve desagrupar (12345,67, mais fácil de editar) ou permanecer 12.345,67? Hoje permanece e ninguém decidiu.
- A reescrita deve continuar totalmente silenciosa ou merece uma microtransição (~150ms) que sinalize que foi o produto, não o vendedor, que mudou o texto?

### [PriceHero — o preço quando ele não cabe](design-system/price-hero-valor-que-nao-cabe.md)

- Quando o valor rola por dentro (último recurso), deve existir sinal visível de que há dígitos fora da vista (degradê, seta, mudança de aparência), ou o produto prefere que esse caso nunca chegue à tela na faixa realista?
- Na barra fixada do kit, Varejo e Atacado devem repetir os tons de Calcular (roxo/laranja) ou ficam neutros? Hoje ambos herdam o roxo com glow por acidente do valor padrão do componente.
- Existe um rótulo único para o par, ou 'Varejo'/'Atacado' e 'Preço varejo'/'Preço atacado' continuam sendo duas grafias legítimas conforme a largura disponível?
- A procedência do número (calculado agora / último conhecido offline / congelado no histórico) deve caber na legenda do próprio PriceHero, ou continua sendo responsabilidade da tela ao redor?
- Qual é o teto que o produto se compromete a mostrar sem encolher nem quebrar — seis dígitos (R$ 123.456,78) basta, ou existe cliente que precifica acima disso?

### [Seletor (Select) — o cursor ▾ e a lista que a marca não controla](design-system/select-nativo.md)

- Desktop: a lista nativa do SO fica a 1280/1920px, ou o desktop ganha um popup próprio da marca? A escolha nativa foi feita pelo celular e nunca foi decidida para desktop — se for popup próprio, o escopo do desenho dobra.
- A opção de payback gera literalmente "1 anos" (paybackYearsLabel: "{n} anos"): corrigimos para singular ou trocamos a redação inteira?
- O placeholder "Selecione" do perfil do vendedor Shopee faz o cálculo cair no catch-all (a maior alíquota). O seletor deve avisar isso na própria linha, ou isso continua sendo trabalho só do selo de procedência abaixo?
- Com o Premium pausado (ficha congelada), o seletor mostra o valor escolhido apenas sem poder trocar, ou apaga junto com o resto do campo?

### [Selo (Badge) — os quatro tons de status, o selo Premium que falta e o selo de procedência que quebra linha](design-system/selo-badge-e-tons.md)

- O selo Premium apenas MARCA a ação gated (carimbo não clicável) ou É o gatilho que abre a oferta? Muda alvo mínimo, foco e estado pressionado.
- 'Não foi possível confirmar seu plano.' continua dentro de uma pílula, ou vira legenda/alerta com o selo mostrando algo curto como 'Plano não confirmado'?
- O selo de procedência da tarifa continua sendo o mesmo componente do selo de status, ou vira componente próprio (é frase, não rótulo)?
- Onde o laranja --energy do selo Premium concorrer com o roxo --accent do botão principal na mesma linha, quem ganha a atenção — a ação ou o carimbo?

### [Aviso efêmero (Toast) — onde aparece, quanto fica, quantos cabem](design-system/torradeira-de-avisos.md)

- Duração por tom: sucesso curto sai em 3-4s e erro fica até o vendedor fechar? O código já suporta 'sem prazo' (duration <= 0) e nenhuma tela usa.
- Ordem da pilha: o aviso mais novo nasce perto do polegar (embaixo, como hoje) ou no topo?
- Teto de fila: quantos avisos simultâneos no máximo, e o que acontece com o excedente — descarta o mais antigo ou agrupa ('+2 avisos')?
- Tom `neutral` continua existindo como tom próprio ou colapsa em `info`? Hoje são visualmente idênticos e nenhuma tela pede neutro deliberadamente.
- Aviso disparado com folha aberta: aparece POR CIMA da folha ou espera a folha fechar? Muda camada e animação.
- O aviso mostra progresso do tempo restante (linha que encolhe) ou some sem avisar?
