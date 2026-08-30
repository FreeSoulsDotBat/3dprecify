# Formulário de filamento (Catálogo → aba Filamentos)

## O que desenhar
O formulário com que o vendedor cadastra e edita um filamento no Catálogo — quatro campos hoje: **Nome**, **Material**, **Custo do rolo** e **Peso do rolo**. É a peça que alimenta TODO o cálculo de material do produto: o custo por grama sai de `custo do rolo ÷ peso do rolo`, então um erro de unidade aqui contamina cada preço sugerido do app. Ele aparece em dois lugares diferentes, com o MESMO conteúdo: no mobile, dentro de uma gaveta (Sheet) com título "Novo filamento" / "Editar filamento"; no desktop ≥1280px, embutido na ficha da direita do mestre-detalhe (a ficha É o editor — o item selecionado na lista da esquerda abre já editável, com kicker "Filamento salvo" e o nome do item como cabeçalho). Origem no código: `apps/web/src/features/catalog/filament-form.tsx`, `catalog-controls.tsx`, `catalog-schema.ts`.

## Por que este prompt existe
Autoridade de desenho **PARCIAL**: o canvas antigo desenhou os quatro rótulos, mas nunca desenhou este formulário inteiro. O que se decidiu sem desenho: (a) a **coluna única** em que os campos são empilhados, contra o canvas, que os põe numa grade que reflui (`repeat(auto-fit, minmax(170px, 1fr))`); (b) o campo **"Cor"** — pedido por §E5 do protótipo ("Filamento: nome, cor, custo do rolo (R$), peso (kg)") e pela correção nº 34, marcada PARTIAL — **nunca foi construído**; (c) a **unidade do peso**: o canvas escreve "Peso do rolo" com sufixo **g** (valor 1000), o código usa **kg**; (d) a marcação de obrigatoriedade — Nome/Custo/Peso levam asterisco, **Material não leva nem asterisco nem a tag "opcional"**, um terceiro estado que nenhuma autoridade definiu; (e) o botão **Salvar segue habilitado com o formulário inválido**, contra o pedido explícito da correção nº 17, marcada NOT FIXED por duas rodadas seguidas. O rótulo "Material" NÃO é inferido (está no canvas) — o mapeamento original errava nesse ponto.

## O que já existe hoje (não invente do zero — corrija)

| Campo | Rótulo literal | Controle | Marcação | Placeholder |
|---|---|---|---|---|
| 1 | "Nome" | texto livre | asterisco `*` | "Ex.: PLA Azul" |
| 2 | "Material" | texto livre | → **nada**: nem `*` nem "opcional" | "Ex.: PLA" |
| 3 | "Custo do rolo" | numérico, prefixo forte **R$** | asterisco `*` | "0,00" |
| 4 | "Peso do rolo" | numérico, sufixo **kg** | asterisco `*` | "0,00" |

- Ordem atual: exatamente essa, empilhada em **coluna única** com espaçamento uniforme. → o canvas pedia grade; o desenho precisa decidir e mostrar o agrupamento (Nome/Material como identidade, Custo/Peso como o par que vira R$/g).
- Rodapé: dois botões alinhados à **direita** — "Voltar" (fantasma) e "Salvar" (primário) ou "Salvar alterações" quando é edição. → "Voltar" existe porque a palavra "cancelar" é proibida na copy do produto (colide com cancelamento de assinatura); mantenha o rótulo.
- → **"Salvar" nunca desabilita.** Com campos vazios ou inválidos ele está clicável e só falha depois. Duas rodadas de correção pediram o contrário.
- → O campo "Nome" não tem tratamento visual próprio nenhum além do frame padrão (correção nº 16, também NOT FIXED).
- → O MESMO campo de peso, no formulário da Calculadora, mostra um aviso de plausibilidade quando o número parece gramas; **no Catálogo esse aviso não existe** — aqui, onde o valor fica salvo e se propaga, o vendedor não é avisado.

## Conteúdo e dados reais
- **Custo do rolo**: dinheiro em pt-BR, agrupamento de milhar aplicado **ao sair do campo** (digitou `120`, ao desfocar vira `R$ 120,00`; `12345,67` vira `12.345,67`). Exemplo realista de rolo: **R$ 129,90**; exemplo grande que precisa caber sem estourar a coluna: **R$ 1.234,56** e o extremo **R$ 9.999.999.999,99** (o teto é excludente em 10.000.000.000).
- **Peso do rolo**: quantidade com sufixo "kg", vírgula decimal. Valor comum: **1** (um rolo de 1 kg); também plausível **0,75** e **5**. Teto excludente em 1.000.000 kg. Precisa ser **estritamente maior que zero** — é denominador.
- **Material**: texto livre, opcional de fato (vai `null` quando vazio) — mas não declarado como opcional na tela.
- **Derivado, hoje invisível no formulário**: a linha-resumo do item na lista mostra `PLA · R$ 129,90 / 1 kg`. O custo por grama, que é o que o app realmente usa, nunca aparece.
- Mensagens de erro literais, por campo: "Campo obrigatório." · "Informe um número válido." · "Não pode ser negativo." · "Valor muito alto." · e, só no peso, **"O peso do rolo deve ser maior que zero."**
- Sucesso: toast "Filamento salvo." — dispara **só depois de um 2xx real**, nunca em offline nem em conta pausada.

## Estados obrigatórios
- **Repouso** (criar): quatro campos vazios com os placeholders acima; nenhum erro visível.
- **Repouso** (editar): campos preenchidos com o item salvo; no desktop, dentro da ficha com kicker "Filamento salvo" + nome do item + ações de ícone (lápis/lixeira) no topo direito.
- **Foco / hover / pressionado**: anel de foco visível em campo e em botão, inclusive sobre o campo com erro (o anel não pode desaparecer dentro da borda vermelha).
- **Erro por campo**: a borda do campo muda e a mensagem aparece ABAIXO do controle, substituindo qualquer dica. Desenhe pelo menos um campo em erro e um caso com **dois campos em erro ao mesmo tempo** (é o caso real de um formulário vazio submetido).
- **Salvando**: o botão primário mostra carregamento; os campos continuam legíveis.
- **Erro de escrita (rede)**: faixa de alerta em tom de perigo ACIMA dos botões, com a frase literal **"Criar e editar precisam de conexão."** — a gaveta/ficha permanece aberta com os valores digitados intactos. Nunca vender falha de rede como limite de plano.
- **Premium pausado (somente leitura)**: TODOS os campos inertes, "Salvar" **some** (fica só "Voltar") e entra um alerta informativo com título **"Reative o Premium"** e corpo **"Reative o Premium para voltar a criar e editar. Seus itens estão salvos."** Tom calmo, sem preço, sem data.
- **Estado que falta e o desenho precisa resolver**: **Salvar desabilitado** enquanto o formulário estiver inválido — com a razão dita em texto, não só um botão apagado (um botão cinza sem explicação é um beco).

## Viewports
- **390px (mobile)** — obrigatório: aqui o formulário vive dentro da gaveta, com o teclado ocupando metade da tela. Mostre a gaveta com o cabeçalho "Novo filamento", os quatro campos e o rodapé de ações; e um segundo quadro com um campo em erro para provar que a mensagem não empurra o rodapé para fora.
- **1280px (desktop, o corte real)** — obrigatório: o formulário dentro da ficha da direita, cuja largura é de ~560px ao lado da lista. É o pior caso da grade: dois campos lado a lado precisam caber em 560px sem que "Custo do rolo" ou o valor `R$ 1.234.567,89` sejam cortados.
- **1920px** — opcional, só se a grade mudar de forma; se não mudar, diga que é a mesma da de 1280px.

## Regras que o desenho não pode quebrar
- A unidade mostrada tem de ser **a mesma que o número significa**. Se o desenho escolher gramas, o rótulo, o afixo e o exemplo precisam concordar entre si — a divergência kg/g é exatamente o defeito que este prompt existe para fechar.
- Frase honesta **nunca dentro de placeholder**: placeholder carrega só exemplo de número/texto; explicação vai em elemento de largura cheia (já custou caro neste projeto — o sufixo do placeholder foi cortado na tela).
- Conta pausada e falha de rede são coisas **diferentes** e não podem usar o mesmo tom: rede = perigo; plano pausado = informativo.
- Nada de sucesso otimista: o "salvo" só existe depois da confirmação do servidor.
- Alvo de toque ≥ 44px em todo botão e ícone de ação; contraste medido contra o fundo real do cartão da ficha (que não é o fundo da página).
- Obrigatoriedade tem de ser **binária e consistente**: ou o campo é obrigatório (asterisco) ou é opcional (tag "opcional"). Não pode sobrar um campo sem nenhuma das duas marcas.

## Armadilhas já pagas neste projeto
- **Estouro horizontal medido**: valores longos de dinheiro já estouraram coluna em PDF e em cartão. Desenhe com `R$ 1.234.567,89` no campo, não com `R$ 0,00`.
- **Placeholder que corta a frase**: um sufixo explicativo posto em placeholder ficou clipado no dispositivo real.
- **Texto ocluso passa em teste**: um elemento sobreposto ainda "existe" para o teste. Se dois campos ficarem lado a lado a 560px, prove no desenho que o afixo "R$"/"kg" não invade o valor.
- **Rótulo de duas linhas desalinha a grade**: "Custo do rolo" e "Peso do rolo" cabem em uma linha a 1280px, mas o desenho precisa dizer o que acontece quando não cabem (linha de base alinhada ou não).

## Entregável
Pranchetas, em **tema escuro (padrão) e tema claro (first-class, não um remendo)**:
1. Gaveta mobile 390px — criar, repouso.
2. Gaveta mobile 390px — dois campos em erro + "Salvar" no estado desabilitado proposto.
3. Ficha desktop 1280px — editar, repouso, com valores grandes reais.
4. Ficha desktop 1280px — erro de escrita ("Criar e editar precisam de conexão.") e, ao lado, o estado **Premium pausado** com o bloco "Reative o Premium".
5. Um recorte da grade proposta (Nome/Material · Custo/Peso) com a decisão de agrupamento explicada em legenda.

Reutilize os primitivos existentes, **sem criar novos**: o frame de campo com rótulo/marcação/erro (`tf-field`, com `tf-field__req` para o asterisco e `tf-field__optional` para a tag), a moldura de entrada (`tf-inputwrap`, variante de erro `tf-inputwrap--error`, afixos `tf-inputwrap__affix` para "R$" e "kg"), o campo numérico pt-BR, os botões (`tf-btn` primário para Salvar, fantasma para Voltar), o alerta (`tf-alert` em tons perigo e informativo), o cartão da ficha (`tf-card`) e a grade que reflui (`tf-costs-grid`). Nomeie na entrega qual primitivo cobre cada parte.

## Perguntas em aberto para o dono
1. **A unidade do peso é kg ou g?** O canvas diz g, o produto diz kg, e o rolo real é vendido em 1 kg / 1.000 g. Mudar a unidade muda o dado salvo de todo mundo — é decisão de produto, não de desenho.
2. **O campo "Cor" entra?** Foi pedido duas vezes pelo protótipo e nunca construído. Se entrar, é um quinto campo (opcional?) ou substitui/acompanha "Material"?
3. **"Material" é opcional declarado** (ganha a tag "opcional") **ou passa a obrigatório?** Hoje não é nem uma coisa nem outra.
4. **O formulário deve mostrar o custo por grama derivado** (ex.: "R$ 0,13 por grama") enquanto o vendedor digita? É o número que o app realmente usa e hoje nunca é mostrado.
5. **O aviso de plausibilidade de peso** que existe na Calculadora ("Confira o peso do rolo: {v} kg. O rolo comum tem 1 kg — se você informou gramas, 1.000 g são 1 kg. Nada foi recusado.") deve aparecer também aqui, onde o valor fica salvo?
