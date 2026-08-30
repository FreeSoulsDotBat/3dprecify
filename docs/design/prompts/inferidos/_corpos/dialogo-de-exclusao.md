# Confirmar exclusão de um item do catálogo

## O que desenhar
O diálogo modal centrado que aparece quando o vendedor toca a lixeira de um **filamento** ou de uma
**impressora** salvos no Catálogo (aba Catálogo → Filamentos / Impressoras). É a única ação destrutiva do
Catálogo: quem chega aqui já decidiu tocar a lixeira, e este é o último ponto em que ele descobre a
consequência real — se o item estiver referenciado por produtos, esses produtos **perdem o vínculo** e passam
a viver com os últimos valores copiados. O diálogo precisa ser desenhado nas duas topologias: sobre a lista
de cartões do mobile (390px) e sobre o mestre-detalhe do desktop (≥1280px), onde a lixeira mora na cabeça da
ficha do item selecionado e o diálogo cobre lista **e** ficha ao mesmo tempo.

## Por que este prompt existe
Este diálogo inteiro foi construído por inferência: nenhum protótipo, nenhuma rodada de auditoria e nenhuma
prancheta cobre exclusão no Catálogo (o `ListItem` do protótipo tem um único trailing, o lápis). Nunca foi
desenhado: a hierarquia entre corpo, aviso de referências e erro; como o modal se comporta sobre o
mestre-detalhe; e o que acontece **enquanto a exclusão está em voo**. Há ainda uma contradição explícita: o
canvas 018 desenha, na cabeça da ficha, um botão **de texto** "Excluir" (`tf-btn--danger-ghost`), enquanto o
código usa um ícone-lixeira ghost nos dois ramos — mobile e desktop. Uma das duas está errada e o desenho
tem de decidir qual.

## O que já existe hoje (não invente do zero — corrija)
Estrutura atual do diálogo, de cima para baixo (`catalog-panel.tsx`, `Dialog variant="center"`,
`width: min(92vw, 32rem)`, `max-height: 85vh`, `padding: --space-6`, gap `--space-3`):

| Ordem | Peça | Texto literal hoje | Observação |
|---|---|---|---|
| 1 | `DialogTitle` | `Excluir “PLA Azul”?` (template: `Excluir “{nome}”?`) | aspas tipográficas curvas; o nome vem do item e pode ser longo → **problema de layout** |
| 2 | `DialogDescription` | `Esta ação não pode ser desfeita.` | genérico; não diz **o que** se perde |
| 3 | `Alert tone="info"` (condicional) | `Este filamento é usado em 3 produto(s). Eles manterão os últimos valores, editáveis.` / `Esta impressora é usada em 3 produto(s). Eles manterão os últimos valores, editáveis.` | só aparece quando n > 0 |
| 4 | `Alert tone="danger"` (só após falha) | ex.: `Criar e editar precisam de conexão.` · `Salvar faz parte do Premium.` · `Algo deu errado. Tente novamente.` | nasce **dentro** do diálogo, depois do clique |
| 5 | Par de botões, alinhado à direita | `Voltar` (ghost) + `Excluir` (danger, com `loading`) | "Voltar", não "Cancelar" — a palavra "cancelar" é proibida no módulo de copy (FR-014) |

→ **Problema 1**: a informação mais importante (item usado em N produtos) está em terceiro lugar, num
`tone="info"` — o mesmo tom do banner de offline —, abaixo de uma frase genérica que não informa nada.
→ **Problema 2**: `{n} produto(s)` com parênteses é copy de programador. Com n = 1 lê-se "1 produto(s)".
→ **Problema 3**: a mensagem de falha offline diz **"Criar e editar precisam de conexão."** dentro de um
diálogo cuja ação é *excluir*. É honesta quanto à causa e mentirosa quanto ao verbo.
→ **Problema 4**: nada distingue visualmente "este item não é usado por ninguém" de "este item é usado por
9 produtos" antes de o vendedor ler o texto.
→ **Problema 5**: nome muito longo no título (o campo Nome não tem limite curto) e um contador de 3 dígitos
no aviso são os dois pontos onde o modal de 32rem estoura.

## Conteúdo e dados reais
- **Nome do item**: string livre, obrigatória, do vendedor. Exemplos reais de semente: `PLA Azul`,
  `Ender 3`. Desenhe também com um nome de estouro: `PETG Translúcido Premium — bobina 1kg Voolt`.
- **Contagem de referências**: inteiro derivado no cliente (produtos cujo `filamentId`/`printerId` é o
  item). Faixa plausível 0–999; 0 = o aviso simplesmente não existe. Desenhe com **3** e com **1**.
- **Tipo do item**: filamento ou impressora — muda só a palavra inicial do aviso.
- **Nenhum valor em dinheiro aparece neste diálogo.** O que se perde é o vínculo, não um preço. Se o
  desenho quiser mostrar contexto do item (ex.: `R$ 89,90 / kg`), isso é conteúdo novo — ver Perguntas.
- Não há campo de digitação de confirmação hoje (nada de "digite o nome para confirmar").

## Estados obrigatórios
1. **Repouso, item sem referências** — título, frase de irreversibilidade, Voltar + Excluir. Sem aviso.
2. **Repouso, item referenciado** — o mesmo, com o aviso `Este filamento é usado em 3 produto(s). Eles
   manterão os últimos valores, editáveis.` em destaque **acima** ou fundido ao corpo.
3. **Foco de teclado** — o foco entra no diálogo; mostre o anel em `Voltar` e em `Excluir` (o destrutivo
   nunca deve ser o foco inicial).
4. **Hover / pressionado** em `Excluir` (danger) e em `Voltar` (ghost).
5. **Em voo (`loading`)** — `Excluir` com spinner; desenhe explicitamente se `Voltar` fica desabilitado e
   se o overlay ainda aceita clique fora. Hoje isso nunca foi desenhado e é o estado mais frágil.
6. **Falha após tentativa** — o `Alert tone="danger"` aparece dentro do diálogo, o diálogo **permanece
   aberto** e os botões voltam a repouso: o vendedor pode tentar de novo ou voltar. Frases reais:
   `Criar e editar precisam de conexão.` (falha de transporte, status 0), `Salvar faz parte do Premium.`
   (403 de direito), `Não encontramos o que você procura.`, `Algo deu errado. Tente novamente.`
7. **Sucesso** — não há toast de exclusão: o diálogo fecha e a linha some da lista. No desktop a ficha da
   direita cai automaticamente para o próximo item válido. Desenhe o "depois" do desktop.
8. **Offline (leitura)** — a lista mostra `Modo leitura offline` acima; a lixeira **continua clicável** e
   o diálogo abre normalmente; a recusa só chega no estado 6.
9. **Premium pausado** — este diálogo **nunca abre**: a lixeira, com `lapsed`, redireciona para a superfície
   de reativação (`Reative o Premium` / `Reative o Premium para voltar a criar e editar. Seus itens estão
   salvos.`). Desenhe isso como nota, não como variante do modal — a regra é "não mostre destrutivo que vai
   falhar".

## Viewports
- **390px (mobile)** — obrigatório: é onde o vendedor age. O modal ocupa 92vw; o par de botões e o aviso
  precisam caber sem rolagem interna com nome longo + aviso + erro simultâneos.
- **1280px (desktop)** — obrigatório: é a topologia nova (mestre-detalhe 018). Mostre o modal sobre lista +
  ficha, com o overlay cobrindo as duas colunas, e mostre a origem do clique (lixeira na cabeça da ficha).
- 1920px é opcional: o modal tem largura fixa de 32rem e não muda; se desenhar, é só para provar o
  centramento sobre um mestre-detalhe largo.

## Regras que o desenho não pode quebrar
- **Freemium binário e falha de rede nunca vendida como Premium**: a falha offline não pode virar convite a
  assinar, e o 403 de Premium pausado não pode parecer erro de rede.
- **A consequência é dita, não escondida**: quando há produtos referenciando o item, a informação tem de ser
  legível antes de o polegar alcançar o botão vermelho — não abaixo dele, não em cinza de legenda.
- **Nenhuma frase honesta dentro de placeholder** e nenhuma frase honesta truncada: o aviso de referências
  vive em elemento de largura cheia, com quebra de linha.
- **Alvo ≥44px** em `Voltar` e `Excluir` inclusive a 390px; e a lixeira que abre o diálogo idem.
- **Contraste medido contra o fundo real** — o card do diálogo fica sobre o overlay, não sobre o fundo da
  página; o vermelho de `Excluir` e o texto sobre ele precisam do contraste medido nessa superfície, nos
  dois temas.
- **Um botão destrutivo nunca é o alvo mais fácil por acidente**: peso visual e posição devem tornar
  "Voltar" o caminho barato.

## Armadilhas já pagas neste projeto
- **Overflow horizontal medido, não presumido**: título com nome longo dentro de `min(92vw, 32rem)` já é a
  forma clássica do estouro que passou em teste de texto (`toContainText` não vê colisão).
- **Texto ocluso passa em teste**: com aviso + erro + botões, o modal pode passar de `85vh` a 390px e criar
  rolagem interna — desenhe esse caso cheio, não só o vazio.
- **Placeholder que corta a frase** (016): nada de espremer "Eles manterão os últimos valores, editáveis."
  numa linha secundária de uma linha só.
- **Aviso de tom errado**: `tone="info"` para a consequência real e `tone="info"` para offline usam a mesma
  cor; quem lê rápido não separa "seu catálogo está velho" de "3 produtos vão perder o vínculo".

## Entregável
Pranchetas, em **tema escuro (padrão)** e **tema claro (first-class)**:
1. 390px — repouso sem referências.
2. 390px — repouso com referências (n = 3) e nome longo.
3. 390px — em voo + falha (duas pranchetas ou uma dividida), com a frase de erro real.
4. 1280px — o modal sobre o mestre-detalhe, com a ficha visível atrás do overlay.
5. 1280px — o "depois" do sucesso: item fora da lista, ficha caindo para o próximo item.
6. Um detalhe da cabeça da ficha resolvendo a contradição botão-de-texto × ícone-lixeira.

Reutilize os primitivos existentes, sem criar novos: `tf-dialog` (variante centrada) com
`tf-dialog__overlay`, `tf-dialog__title` para o título, o parágrafo de corpo do diálogo para a frase de
irreversibilidade, `tf-alert` (`info` para referências, `danger` para falha), `tf-btn--ghost` para "Voltar"
e `tf-btn--danger` para "Excluir" com o estado `loading` já previsto no botão. Se o aviso de referências
precisar de mais peso, prefira mudar a **posição e o tom já existentes** a inventar um novo bloco.

## Perguntas em aberto para o dono
1. O aviso de referências deve subir para **antes** de "Esta ação não pode ser desfeita." (virando o corpo
   principal) ou continuar como alerta abaixo? É uma decisão de produto sobre o que o vendedor lê primeiro.
2. `{n} produto(s)` deve virar copy com plural real ("é usado em 1 produto" / "em 3 produtos")? Trocar
   afeta copy já em produção.
3. A frase de falha offline deve ganhar uma variante para exclusão (hoje diz "Criar e editar precisam de
   conexão." dentro de um diálogo de excluir), ou o dono aceita a frase genérica?
4. A cabeça da ficha do desktop fica com **botão de texto "Excluir"** (como o canvas 018 desenhou) ou com
   **ícone de lixeira** (como o código faz)? A resposta muda também o mobile, que hoje espelha o código.
5. Excluir com sucesso deve mostrar um toast de confirmação? Hoje não mostra nenhum — a única evidência é a
   linha sumir.
