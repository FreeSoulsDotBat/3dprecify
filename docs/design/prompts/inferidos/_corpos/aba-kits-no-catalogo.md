# Aba Kits do Catálogo — lista de kits salvos e a ficha do kit

## O que desenhar
A quarta aba do Catálogo (Filamentos · Impressoras · Produtos · **Kits**): a lista dos kits que o vendedor já
montou e salvou, mais o que aparece quando ele seleciona um deles. É a tela de *reencontro* — o vendedor não
monta kit aqui (montar acontece na tela Kits, `/kits`), ele vem aqui para achar um kit salvo, duplicar,
excluir ou reabrir para editar/recalcular. No desktop (≥1280px) a aba é um mestre-detalhe: lista à esquerda,
ficha do kit selecionado numa coluna fixa de 560px à direita. No mobile é uma lista de cartões, e tocar num
cartão sai da tela rumo ao editor do kit. Desenhe **as duas**.

## Por que este prompt existe
A peça foi montada reaproveitando o painel genérico do Catálogo em "modo navegação": ninguém desenhou o que a
ficha do kit deveria mostrar. O canvas de 2026-07-02 (`Abas-Desktop.dc.html`) COBRIA uma ficha de kit — quatro
campos editáveis (Nome do kit · Peças · Custo total · Markup varejo), com "Salvar alterações" + "Usar no
cálculo" — e o código foi na direção oposta por decisão posterior do dono (FR-016: para Produtos e Kits a ficha
RESUME e manda para o editor de página cheia). O resultado é uma divergência declarada, mas o que sobrou não foi
desenhado: hoje a ficha de 560px mostra o nome, dois ícones e **a mesma frase que já estava no cartão da lista**,
mais um botão. E o canvas, do outro lado, desenhou dinheiro que o modelo **não tem**: nenhum preço de kit é
armazenado (FR-407) — o preço só existe quando o editor recalcula. Nunca foram desenhados: o vazio da aba, como
um kit se distingue de um produto na mesma casa, e nada do mobile.

## O que já existe hoje (não invente do zero — corrija)
Origem: `features/catalog/kits-panel.tsx` + `features/catalog/catalog-panel.tsx` + `catalog-master-detail.css`.

**Cabeçalho da tela** (comum às quatro abas): título "Catálogo" e, à direita no desktop, as pílulas
"Filamentos · Impressoras · Produtos · Kits" (grupo com rótulo "Seções do catálogo"). Abaixo do corte as
pílulas quebram para a segunda linha.

**Barra da lista (desktop)**: campo de busca (placeholder "Buscar no catálogo…", ícone de lupa, largura máx.
420px) · contagem "3 kit(s)" empurrada para a direita · botão primário "Montar kit" com ícone de +.

| Elemento | Texto/dado literal de hoje | Observação |
|---|---|---|
| Nome do cartão | o nome que o vendedor digitou, ex. "Kit suporte + base" | pode vir sem espaços e muito longo |
| Resumo do cartão | "3 peça(s)" | → **é tudo**: nem data, nem quantas peças vêm do catálogo, nem dinheiro |
| Ações no cartão (mobile) | ícones lápis / cópia / lixeira, rótulos assistivos "Editar {nome}", "Duplicar {nome}", "Excluir {nome}" | três alvos disputando a mesma linha do nome |
| Rótulo da ficha (kicker) | "KIT SALVO" em versalete | |
| Ações da ficha | os MESMOS dois ícones (duplicar, excluir), sem texto | → um ícone-cópia sozinho num painel de 560px é adivinhação |
| Corpo da ficha | repete "3 peça(s)" e o botão secundário "Abrir para editar" (ícone de lápis) | → **o problema central**: meia tela para repetir a linha do cartão |
| Confirmação de excluir | título `Excluir "Kit suporte + base"?` (com aspas curvas), corpo "Esta ação não pode ser desfeita.", botões "Voltar" e "Excluir" (perigo) | mantenha literal |

Comportamento que o desenho precisa respeitar: selecionar um cartão **não navega** (troca só a ficha, com o
cartão marcado); "Montar kit" e "Abrir para editar" **saem** para a tela Kits; "Duplicar" abre uma cópia
**não salva** no editor, para o vendedor revisar e salvar (nada é gravado às escondidas).

## Conteúdo e dados reais
O que existe de verdade em um kit salvo: `nome` (texto livre do vendedor), `peças` (lista — de 1 a dezenas,
cada uma com quantidade e, opcionalmente, um produto do catálogo por trás), `criado em` e `atualizado em`
(datas que hoje **existem no dado e não são mostradas**) e o registro de quais produtos aquele kit criou ou
referenciou no catálogo quando foi salvo.

- **Não há preço guardado.** "custo R$ 52,34 · varejo R$ 157,02" é ficção do canvas antigo. Se o desenho
  quiser dinheiro na ficha, ele só pode aparecer depois de um recálculo real e precisa dizer isso ("Ao vivo",
  ou a data do cálculo) — veja "Perguntas em aberto".
- Números verdadeiros que o produto usa hoje na tela Kits, se você precisar de exemplo: peça de 42 g,
  3 h 30 min, custo unitário R$ 21,84; total de varejo de um kit de 3 peças na casa de R$ 157,02.
  Dinheiro sempre em `R$ 1.234,56`, com máscara de milhar.
- Contagens em português com plural entre parênteses: "3 peça(s)", "2 kit(s)" — copy já homologada.
- Vocabulário fixo: uma peça sem produto salvo por trás é "(avulsa)"; um kit é sempre "kit", nunca "produto".

## Estados obrigatórios
1. **Repouso** — lista com 2 a 6 kits; um cartão selecionado (borda de acento + fundo suave) e os demais neutros.
2. **Foco de teclado** — anel visível no cartão, na busca, nas pílulas e nos ícones de ação (o cartão inteiro é
   um botão).
3. **Hover / pressionado** no cartão e nos ícones.
4. **Carregando** — indicador centralizado, sem esqueleto que finja conteúdo.
5. **Vazio da aba** — ícone, "Nenhum kit salvo ainda", "Monte um kit com várias peças e reabra com o preço
   sempre recalculado." e o botão "Montar kit". Ocupa a largura toda: **sem ficha órfã ao lado**.
6. **Vazio da busca** (≠ vazio da aba) — "Nada encontrado para essa busca", "Tente outro termo, ou limpe a
   busca para ver tudo de novo." e o botão "Limpar busca".
7. **Erro de leitura** — alerta de perigo "Não foi possível carregar seu catálogo." com "Tentar novamente".
8. **Offline (leitura pelo cache)** — faixa informativa (nunca perigo) "Modo leitura offline" / "Seus itens
   salvos continuam aqui para usar no cálculo. Criar e editar precisam de conexão." e, em cada cartão, a
   legenda "pode estar desatualizada".
9. **Premium pausado** — faixa informativa "Premium pausado" / "Seus itens continuam aqui e podem ser usados
   no cálculo. Para criar ou editar, reative o Premium.", legenda "somente leitura" no cartão, e as ações de
   escrita **interceptadas honestamente na hora do toque** (nunca um "Excluir" que parece funcionar e falha
   depois). → Nota de auditoria: **esta aba não repassa o estado pausado hoje** (Produtos repassa, Kits não),
   então o desenho precisa deixá-lo explícito para que a correção tenha alvo.
10. **Sem direito de leitura (o servidor recusou)** — estado calmo com coroa e a frase "Salvar faz parte do
    Premium.", sem preço e sem data.
11. **Conta grátis / deslogada** — a tela inteira do Catálogo vira o convite "Salve e reutilize seu catálogo"
    / "Guarde filamentos, impressoras e produtos uma vez e preencha o cálculo com um toque." / "A calculadora
    continua grátis." → o vendedor grátis **nunca chega nesta aba**, e essa frase não fala de kits (ver
    "Perguntas em aberto").
12. **Excluindo** — botão de perigo em espera dentro do diálogo; falha mostra o motivo ali mesmo, sem fechar.

## Viewports
- **Mobile 390px** — obrigatório: a aba existe no mobile e é lá que os três ícones de ação brigam com o nome.
  Desenhe o cartão com nome longo (2 linhas) e as ações ainda alcançáveis.
- **Desktop 1280px** — o primeiro pixel do mestre-detalhe: lista em **uma** coluna + ficha de 560px.
- **Desktop 1920px** — a lista vira **duas** colunas (regra atual: duas colunas só a partir de 1600px) com a
  mesma ficha de 560px, grudada no topo enquanto a lista rola.

## Regras que o desenho não pode quebrar
- **Nenhum dinheiro que não foi recalculado.** Um número de preço na lista ou na ficha é uma afirmação sobre
  hoje; como nada é guardado, ou ele vem de um recálculo visível ou não aparece.
- **Freemium binário**: ou o convite honesto, ou a coisa funcionando. Nunca uma lista falsa/borrada.
- **Falha de rede nunca é "não é premium"**: offline e erro têm palavras próprias, já escritas acima.
- **Degradação dita, não escondida**: "pode estar desatualizada" e "somente leitura" são legendas visíveis no
  cartão, em texto de verdade — nunca dentro de placeholder e nunca só na cor.
- **Interceptar no toque, não no envio**: com Premium pausado, a ação de escrita leva à reativação; não abre
  um fluxo que morre no fim.
- Alvos de toque ≥44px em todos os ícones de ação, inclusive os três empilhados na linha do mobile.
- Contraste medido contra o fundo real do cartão selecionado (fundo de acento suave), não contra o fundo da página.

## Armadilhas já pagas neste projeto
- **Nome sem espaço estoura a página**: um nome de 500 caracteres colado pelo vendedor já produziu ~4.948px de
  rolagem horizontal a 1440px, porque só a ficha quebrava a palavra e o cartão não. Desenhe o cartão e o título
  da ficha **já com a quebra dentro da palavra**, e mostre o caso no quadro.
- **Rolagem no eixo vertical que o teste não vê**: a ficha rola por dentro quando é mais alta que a janela; a
  página não pode ganhar uma segunda barra.
- **Ícone sem rótulo passa em qualquer teste e não é entendido por ninguém** — o ícone-cópia sozinho na ficha é
  exatamente esse caso; considere rótulo textual "Duplicar"/"Excluir" na ficha (há largura de sobra em 560px).
- **Frase honesta nunca dentro de placeholder** — placeholder carrega exemplo, não política.
- **Repetir a linha do cartão dentro de um painel de 560px** é o defeito que originou este prompt: a ficha
  precisa entregar algo que o cartão não entregava.

## Entregável
Pranchetas, tema escuro (padrão) **e** tema claro, ambos completos:
1. Desktop 1920 — repouso, com um kit selecionado e a lista em duas colunas.
2. Desktop 1280 — mesma tela em uma coluna de lista.
3. Desktop — a **ficha proposta** em detalhe (é o miolo do trabalho): o que ela mostra além do nome.
4. Desktop — vazio da aba · vazio da busca · offline · Premium pausado · erro de leitura.
5. Mobile 390 — lista em repouso · cartão com nome longo · vazio da aba · confirmação de excluir.

Reutilize os primitivos existentes, sem criar novos: `tf-card` + `tf-card--interactive` no cartão (com a
variante selecionada), `tf-card` na ficha, `tf-badge` para qualquer marcador de estado, `tf-inputwrap` +
`tf-input` na busca, botão primário para "Montar kit", secundário para "Abrir para editar", fantasma para os
ícones de linha, perigo para "Excluir" no diálogo, `tf-alert--info` para offline/pausado e `tf-alert--danger`
para o erro, o estado vazio padrão para os dois vazios, o diálogo centralizado para a confirmação e o kicker
em versalete para "KIT SALVO". Se algo faltar, diga qual primitivo falta — não desenhe um novo por conta.

## Perguntas em aberto para o dono
1. **O que a ficha do kit deve mostrar**, já que não pode repetir "3 peça(s)"? Opções que o dado permite hoje
   sem inventar: a lista das peças com quantidade e a origem de cada uma ("do catálogo: Vaso G" / "(avulsa)"),
   e/ou "atualizado em 08/08/2026". Total de custo/varejo só entra se o kit for recalculado ao selecionar —
   isso é decisão de produto, não de desenho.
2. Se o total entrar: ele é **recalculado ao vivo** ao selecionar o kit (e como se anuncia isso), ou a ficha
   segue sem dinheiro e o preço só existe dentro do editor?
3. **Distinguir kit de produto**: hoje as duas listas moram em abas separadas e nada mais os diferencia
   visualmente. Precisa de marca própria (ícone/badge) para quando um kit aparecer fora da sua aba
   (Orçamentos já mostra "Kit · 3 peças")?
4. O convite do Catálogo para conta grátis fala de "filamentos, impressoras e produtos" e **não menciona
   kits**, embora a aba Kits viva dentro dele. A frase muda, ou a aba Kits ganha o convite próprio que já
   existe ("Monte e precifique kits com várias peças")?
5. A ficha deve oferecer **"Usar no cálculo"** (o canvas de 2026-07-02 previa), ou "Abrir para editar" continua
   sendo a única saída?
