# Renomear rótulo e excluir registro — os dois gatilhos e os dois diálogos

## O que desenhar
A superfície de gerência de UM orçamento congelado, dentro do detalhe de `/historico/{id}` ("Orçamentos"):
os dois gatilhos ("Editar rótulo" e "Excluir") e os dois diálogos modais que eles abrem. Quem usa é o
vendedor que abriu um orçamento já salvo — em geral para corrigir o rótulo depois que o cliente virou um
nome de verdade ("Cliente João · pedido 412"), ou para apagar um registro de teste. O rótulo é o ÚNICO
campo mutável do documento (ADR-0019); todo o resto é imutável. Excluir é a única operação irreversível
do app sobre esse documento. Os gatilhos só aparecem quando o Premium está **ativo** E o registro já
**sincronizou** — um registro pendente não tem id no servidor e é descartado pela fila, não por aqui.

## Por que este prompt existe
Metade desta superfície tem desenho, a outra metade nenhuma — e a metade desenhada **contradiz o código**.
O canvas `Abas-Desktop.dc.html` (018) coloca "Editar rótulo" como botão fantasma pequeno com ícone de
lápis colado ao `<h2>` do rótulo, dentro do bloco da alegação, e "Excluir" como `tf-btn--danger-ghost`
empurrado para o fim da fileira de ações (`margin-left:auto`), separado de Exportar/Recalcular/Comparar
por toda a largura da linha. O código faz outra coisa: junta os dois como `secondary` neutros, do mesmo
tamanho, colados por 8px, numa barra própria DEPOIS do card da alegação. Nem a posição, nem o peso, nem o
tom batem. E **nenhum dos dois diálogos existe em autoridade nenhuma** — o canvas não tem um único
diálogo, o protótipo de 2026-07-02 não tinha renomear nem excluir (§E6 não os cita), e `ux-history.md` §3
só traz um ASCII com ✎ e 🗑. Os dois modais que estão no ar hoje foram inferidos por IA a partir de
texto.

## O que já existe hoje (não invente do zero — corrija)

**A barra** (`features/history/snapshot-manage.tsx`), renderizada entre o card "Valor cotado" e o alerta
de sincronização:

| elemento | como está hoje | observação |
|---|---|---|
| "Editar rótulo" | `Button size="sm" variant="secondary"` | sem ícone |
| "Excluir" | `Button size="sm" variant="secondary"` | → **mesmo peso visual do renomear, sendo irreversível** |
| container | `flex gap-2` | → no 390px os dois ficam colados a 8px, ambos alcançáveis pelo polegar |

→ O desenho do 018 já resolveu isto no desktop e o código não seguiu. Desenhe a versão certa para **os
dois** viewports, e não repita o empate de peso.

**Diálogo 1 — renomear.** Título "Editar rótulo" (o mesmo texto do gatilho). Um único campo de texto,
rótulo "Rótulo (opcional)", pré-preenchido com o rótulo atual, `maxLength` 120, sem dica, sem contador,
sem placeholder. Rodapé alinhado à direita: [Voltar] `secondary` + [Salvar rótulo] primário.
→ A folha de salvar (`record-snapshot-sheet.tsx`) mostra o MESMO campo **com** a dica "Cliente, pedido…";
aqui ela sumiu — a mesma pergunta, feita duas vezes, com ajudas diferentes.
→ Salvar com o campo **vazio apaga o rótulo** (grava `null`), e nada na tela diz isso.
→ Sucesso é só o toast "Rótulo atualizado." (tom `success`) e o diálogo fecha; falha é o toast
"Não foi possível atualizar o rótulo." (tom `danger`) com o diálogo ABERTO e o texto digitado intacto.
Nenhum estado de erro dentro do campo.

**Diálogo 2 — excluir.** Título "Excluir este registro?", descrição "Esta ação não pode ser desfeita.",
rodapé [Voltar] `secondary` + [Excluir] `danger`.
→ **O diálogo não diz QUAL registro vai sumir.** O mesmo app já faz isso certo em dois outros lugares: o
catálogo pergunta "Excluir “PLA Azul”?" e as simulações também ecoam o nome. Aqui, não.
→ Sucesso: toast "Registro excluído." e a tela volta para a lista `/historico`.
→ Falha: toast "Não foi possível excluir o registro." e o diálogo permanece aberto.

**A moldura dos dois** (`tf-dialog`): caixa centrada de `min(92vw, 32rem)`, `max-height: 85vh`, padding
`--space-6`, cantos `--radius-xl`, sobre o scrim `--surface-overlay`. **O título do diálogo é renderizado
em CAIXA ALTA com tracking largo** — "EDITAR RÓTULO" e "EXCLUIR ESTE REGISTRO?". Nenhum dos dois tem o X
de fechar (`showClose={false}`), mas o título ainda reserva `--space-10` de padding à direita para um X
que não existe → o texto fica visivelmente descentrado. Corrija no desenho.

## Conteúdo e dados reais
- Identidade do registro: o rótulo quando existe; senão o nome da origem gravada; senão o literal
  "Cálculo avulso". Exemplo real para as pranchetas: rótulo "Cliente João · pedido 412", "Cotado em
  06/08/2026 às 14:32", "Valor cotado **R$ 24,24**", legenda "preço de varejo", "Validade da proposta:
  7 dias".
- Campo rótulo: texto livre, **opcional**, até 120 caracteres, sem validação — qualquer texto salva.
  Desenhe também um rótulo longo de verdade (120 caracteres) e prove que ele não estoura o campo nem
  empurra o rodapé para fora dos 85vh.
- Nada mais do documento é editável: valores, data, canais, ficha técnica e detalhamento são congelados.

## Estados obrigatórios
1. **Barra em repouso** — os dois gatilhos com hierarquia diferente (renomear discreto, excluir em tom de
   perigo e afastado). Foco visível com o anel do DS; hover e pressionado nos dois.
2. **Barra ausente** — Premium `lapsed`: os gatilhos simplesmente não existem, e logo acima aparece o
   alerta `info` "Premium pausado — seus registros continuam aqui e podem ser abertos. Para salvar,
   renomear, excluir ou exportar, reative o Premium." Desenhe esse recorte: a ausência precisa ficar
   explicada, não misteriosa.
3. **Barra ausente por registro pendente** — o registro ainda não chegou à conta; no lugar aparece o
   alerta "Ainda não sincronizado" com o corpo dele. Uma prancheta bastando o recorte.
4. **Renomear — repouso**, com o campo pré-preenchido e o cursor no fim do texto.
5. **Renomear — foco no campo** (anel) e **campo vazio** (o estado que apaga o rótulo).
6. **Renomear — salvando**: o botão [Salvar rótulo] com spinner inline, rótulo mantido, interação
   bloqueada; [Voltar] no mesmo instante.
7. **Renomear — falhou**: diálogo aberto, texto preservado, toast `danger` "Não foi possível atualizar o
   rótulo.".
8. **Excluir — repouso**, com o registro identificado.
9. **Excluir — excluindo**: [Excluir] `danger` com spinner, bloqueado.
10. **Excluir — falhou**: toast `danger` "Não foi possível excluir o registro.", diálogo aberto.
11. **Toasts de sucesso**: "Rótulo atualizado." e "Registro excluído." (tom `success`), sobre a tela de
    destino certa — o segundo já na lista de Orçamentos.

## Viewports
- **Mobile 390px** — obrigatório: é onde os dois gatilhos hoje ficam colados e onde o diálogo ocupa 92vw
  (≈359px). Mostre o rodapé de dois botões com alvo ≥44px e sem estouro horizontal.
- **Desktop 1280px** — obrigatório: é o corte do 018, onde o detalhe vive na coluna direita do
  mestre-detalhe (~560px) e os gatilhos precisam conviver com "Exportar" (primário), "Recalcular hoje" e
  "Comparar com hoje" na mesma fileira. O diálogo aqui é a caixa centrada de 512px.
- **1920px** opcional: o diálogo não muda de tamanho; só desenhe se quiser mostrar o scrim numa tela larga.

## Regras que o desenho não pode quebrar
- **O irreversível não pode ter o peso do reversível.** Excluir e renomear jamais lado a lado, mesmo
  tamanho, mesmo tom.
- **Confirmação nomeia o objeto.** Quem confirma precisa ler qual registro morre — é a regra que o
  catálogo e as simulações já seguem neste app.
- **Freemium binário e honesto**: sem Premium ativo os gatilhos NÃO aparecem em versão desabilitada com
  cadeado; eles somem, e o banner de pausa explica. Não invente um estado "meio ativo".
- **Falha de rede nunca vira outra coisa.** As duas operações só funcionam online; se o desenho propuser
  uma mensagem para o caso sem conexão, ela precisa dizer "conexão", e nunca sugerir que o problema é o
  plano ou que o registro foi perdido.
- **Nada aqui promete alterar o documento.** Renomear muda só o rótulo; o desenho não pode insinuar que
  valores possam ser corrigidos.
- Alvos ≥44×44px em ambos os viewports, inclusive [Voltar]. Contraste medido contra `--surface-card` sobre
  o scrim, nos dois temas.

## Armadilhas já pagas neste projeto
- **Frase honesta em placeholder é frase perdida** (016/PR-F): a explicação de que o campo vazio apaga o
  rótulo, se existir, vai em elemento próprio — nunca dentro do input.
- **Texto ocluso passa em teste** (014): o rodapé do diálogo com dois botões e um rótulo longo já é o
  cenário clássico de estouro; desenhe medindo caixas, não confiando na frase.
- **Valor grande estoura a coluna** (E4/T034): se o diálogo de exclusão passar a ecoar o registro,
  ele carrega um rótulo de até 120 caracteres — desenhe com um de verdade, truncando com elegância.
- **Ausência sem explicação lê como bug** (E6/PR-B): a barra que some no `lapsed` só é honesta porque o
  banner está logo acima; mantenha os dois no mesmo recorte.

## Entregável
Pranchetas nos **dois temas** (escuro é o padrão, claro é first-class), agrupadas em três blocos:
(A) os gatilhos em contexto — 390px e 1280px, incluindo os recortes de `lapsed` e de registro pendente;
(B) o diálogo de renomear em seus cinco estados; (C) o diálogo de excluir em seus três.
Reutilize os primitivos existentes, sem criar novos: a moldura é `tf-dialog` (título `tf-dialog__title`,
descrição `tf-dialog__desc`); o campo é `tf-field` + `tf-input` dentro de `tf-inputwrap`; os botões são
`tf-btn` nas variantes `--ghost`/`--sm` (renomear), `--danger-ghost` (gatilho de excluir),
`--secondary` (Voltar), `--primary` (Salvar rótulo) e `--danger` (Excluir do modal); o retorno é
`tf-toast--success` / `tf-toast--danger`; a explicação de pausa é o alerta em tom `info`.

## Perguntas em aberto para o dono
1. Adotamos a posição do canvas 018 — "Editar rótulo" fantasma com lápis colado ao rótulo, "Excluir"
   `danger-ghost` no fim da fileira de ações — e **matamos a barra separada**, inclusive no mobile? Ou o
   mobile mantém uma barra própria com hierarquia corrigida?
2. O diálogo de exclusão passa a ecoar o registro. Quando o registro **não tem rótulo**, o que ele deve
   citar: o nome da origem gravada, o literal "Cálculo avulso", ou o valor e a data ("R$ 24,24, cotado em
   06/08/2026")? Ecoar um nome de origem pode afirmar uma procedência que o vendedor nunca escreveu.
3. Apagar o rótulo (salvar o campo vazio) é um caminho intencional? Se for, ele merece dizer-se — texto
   de ajuda, ou uma ação explícita "Remover rótulo" — e isso muda o rodapé do diálogo.
4. Sem conexão, renomear e excluir devem ficar **bloqueados com motivo dito** (a família já tem "Criar e
   editar precisam de conexão.") ou continuar clicáveis e falhar com toast? Hoje falham com um toast que
   não nomeia a causa.
