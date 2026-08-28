# O momento em que o orçamento pendente chega à conta

## O que desenhar
O instante `pendente → sincronizado` de um orçamento na aba **Orçamentos**. O vendedor calculou e salvou uma peça sem sinal (ou com o Premium pausado, ou com a sessão expirada); o registro ficou guardado só no aparelho, marcado com o selo "Pendente neste dispositivo". Depois — quando a conexão volta, quando ele traz o app para a frente, quando ele entra de novo — a fila drena em segundo plano e o registro finalmente chega à conta. É esse "chegou" que precisa de desenho: o que aparece, onde aparece, por quanto tempo, e o que muda no card, na lista e no registro aberto. Quem usa é o vendedor que precisa saber se já pode limpar os dados do app ou trocar de aparelho sem perder o orçamento.

## Por que este prompt existe
Hoje **não existe momento nenhum**. O único sinal é negativo: o selo some e o alerta de fila desaparece. Sem toast, sem transição, sem anúncio para leitor de tela. A decisão foi tomada por não ter sido tomada.
Pior: a especificação de UX de 2026-07-02 (`ux-history.md` §1.5) pede **o oposto do que foi construído** — "o selo some, um toast de sucesso **de verdade** dispara, o card fica no lugar (sem reordenar)… anunciar com `aria-live=polite` → *Registro sincronizado.*". A frase pt-BR chegou a ser escrita (`messages.pt-br.ts:1008`) e **nunca foi ligada a nenhum componente** — existe uma única ocorrência dela em todo o código, a própria definição.
Nenhuma autoridade desenhada cobre a peça: o protótipo antigo não tem fila, e o desenho de desktop `Abas-Desktop.dc.html` desenha o alerta de fila **estático**, sem nenhum "depois".

## O que já existe hoje (não invente do zero — corrija)

O **antes** (o registro pendente) está todo desenhado e homologado. É o **depois** que falta.

| Onde | O que existe hoje (texto literal) | O que acontece no momento da sincronização |
|---|---|---|
| Card da lista | Selo `tf-badge--info` "Pendente neste dispositivo" | → o selo **some**, sem nenhum outro sinal |
| Alerta de fila (topo da lista) | `tf-alert--info`: "1 registro(s) pendente(s) neste dispositivo." + botão "Sincronizar agora" | → o alerta **some** quando a fila zera; com N pendentes, só o número muda |
| Registro aberto (detalhe) | `tf-alert` "Ainda não sincronizado" + "Este registro está só neste dispositivo e ainda não chegou à sua conta. Ele sincroniza sozinho quando você voltar a ficar online." + "Enquanto não sincroniza, ele existe só aqui — se os dados do app forem limpos, ele se perde." | → os três blocos **somem de uma vez** |
| Ações do registro | "Editar rótulo" e "Excluir" **não existem** enquanto pendente | → **aparecem do nada**, sem aviso |
| Exportar | O PDF fica desabilitado com a razão embaixo: "Sincronize para exportar." | → o rádio destrava e a razão some |
| Sair da conta | Diálogo "{n} registro(s) ainda não foram sincronizados" | → o diálogo deixa de aparecer |
| Leitor de tela | nada | → nada (a frase "Registro sincronizado." existe e não é usada) |

→ **Problema central**: o único evento positivo da jornada offline é comunicado por subtração. O vendedor descobre que o orçamento chegou reparando que um selo sumiu.
→ **Problema de layout**: a saída do selo e a entrada de "Editar rótulo"/"Excluir" mexem na altura do card e do registro **sem nenhuma continuidade visual** — a página pula.
→ **Problema de lugar**: a fila drena a partir de quatro gatilhos (abrir o app, voltar a ficar online, o app ganhar foco, a aba voltar a ficar visível) mais a volta do Premium a ativo. Ou seja, **o momento pode acontecer com o vendedor em qualquer tela**, inclusive na Calculadora — e não só olhando a lista de Orçamentos.

## Conteúdo e dados reais
- Um card de orçamento tem, nesta ordem: rótulo ("Cliente Ana — vasos") ou o nome capturado da origem ou "Cálculo avulso"; o selo de sincronização (só se não sincronizado); "Cotado em 12/08/2026 · Kit · 3 peças"; "Valor cotado" com **R$ 1.234,56** em destaque; e a legenda da base: "preço de varejo" ou "preço de atacado". Valores reais do produto vão de **R$ 16,16** a alguns milhares — desenhe com um valor curto e um longo.
- A **data vem estruturalmente antes do dinheiro** e o card **nunca reordena** ao sincronizar: a chave de ordenação é a data da cotação, que não muda.
- A frase de sucesso já escrita e a usar literalmente: **"Registro sincronizado."**
- Existe um toast pronto no DS com quatro tons (`neutral`, `info`, `success`, `danger`), ícone à esquerda (círculo com check no `success`), mensagem, botão de fechar, e auto-dispensa em 5 s. A região do toast já é `aria-live="polite"`.
- Quando o vendedor pede a drenagem à mão, o botão "Sincronizar agora" entra em estado de carregamento — esse é o único "durante" que existe hoje.

## Estados obrigatórios
1. **Antes (repouso, pendente)** — card com o selo "Pendente neste dispositivo" e o alerta de fila no topo. Ponto de partida do par antes/depois.
2. **Durante (drenando)** — a fila está sendo enviada. Manual: "Sincronizar agora" em carregamento. Automático: hoje não há sinal nenhum; decida se há e qual (discreto, nunca alarmante — não é um erro).
3. **O momento (sincronizado)** — o selo sai, o toast de sucesso "Registro sincronizado." entra, o card **fica no lugar**, o anúncio educado dispara.
4. **Depois (repouso, sincronizado)** — card limpo, sem selo, sem alerta de fila; "Editar rótulo"/"Excluir" disponíveis, exportar destravado.
5. **N registros de uma vez** — a fila drena inteira; **nunca N toasts**. Um único sinal agregado (a copy do plural não existe — ver Perguntas).
6. **Aconteceu fora da tela** — sincronizou enquanto o vendedor estava na Calculadora ou com o app em segundo plano. O momento passou; o que ele vê ao voltar?
7. **Transição que NÃO é sucesso — Premium pausado**: o selo **troca no lugar** para "Envio pausado · precisa de Premium"; o alerta vira "1 registro(s) não foram enviados: o Premium não está ativo."
8. **Transição que NÃO é sucesso — sessão expirada**: selo "Envio pausado · sessão expirada"; alerta "1 registro(s) não foram enviados: sua sessão expirou." + botão "Entrar de novo".
9. **Transição que NÃO é sucesso — recusa do servidor**: selo em tom de perigo "Não foi possível registrar"; alerta "1 registro(s) não puderam ser registrados." + botão "Ver".
10. **Offline** — a fila não drena; o alerta diz "Sem conexão. 1 registro(s) pendente(s) neste dispositivo — sincronizam sozinhos quando você voltar a ficar online." e o botão "Sincronizar agora" **não existe** (nunca um botão que não pode funcionar).
11. **Movimento reduzido** — a mesma leitura sem animação.
12. **Foco e teclado** — o toast tem botão de fechar alcançável; a entrada do toast não rouba o foco de quem está digitando.

## Viewports
- **Mobile 390px** — é onde a jornada offline realmente acontece (o vendedor grava o orçamento na feira, sem sinal). Obrigatório. Atenção: o toast não pode cobrir a navegação inferior nem o botão "Sincronizar agora".
- **Desktop 1280px** — acima desse corte a aba vira mestre-detalhe: filtros + lista numa coluna de 520px à esquerda, o registro congelado à direita. O momento acontece **nas duas colunas ao mesmo tempo** (o selo sai do card selecionado e o bloco "Ainda não sincronizado" sai do detalhe) — é o caso mais difícil e precisa de prancheta própria.
- 1920px opcional: só se o posicionamento do toast mudar em relação a 1280.

## Regras que o desenho não pode quebrar
- **Confirmação não é preço.** O momento confirma uma entrega, não anuncia um valor. Nada de tratamento de preço em destaque, nada de número novo, nada que sugira que o valor congelado mudou — ele é imutável por definição.
- **O card não reordena e não muda de conteúdo.** Só o selo sai.
- **Falha de rede nunca vira "não é premium"** e sessão expirada nunca vira "sem conexão" — as palavras "conexão"/"online" são proibidas no caso de sessão expirada, de propósito.
- **Nada de sucesso inventado.** Só é "sincronizado" o que o servidor confirmou; uma resposta perdida continua pendente. O desenho não pode ter um estado "provavelmente enviado".
- **Frase honesta nunca dentro de placeholder** nem cortada por largura fixa — o texto de honestidade mora em elemento de largura total.
- **Sem tempestade de toasts**: N registros = um sinal.
- Alvo tocável ≥ 44px (fechar do toast incluído), contraste medido contra o fundo real do toast, e selo/estado sempre **texto + ícone**, nunca só cor.
- Tema escuro é o padrão; o claro é de primeira classe, não um ajuste.

## Armadilhas já pagas neste projeto
- **O toast que nunca renderizou** (homologação do E6/PR-B): a copy estava no pacote afirmando um reconhecimento que nunca chegou à tela — o componente desmontava antes do retorno. É **exatamente a classe desta peça**: "Registro sincronizado." existe há um ano e nunca apareceu. O desenho tem de deixar explícito **de onde** o sinal nasce e **quanto tempo** ele fica, para que a implementação seja verificável em imagem.
- **Texto ocluso passa em teste**: um selo saindo e dois botões entrando mudam a altura; meça o deslocamento em vez de confiar em "está visível".
- **Overflow horizontal medido**: o alerta de fila tem texto + até três botões na mesma linha ("Ver", "Entrar de novo", "Sincronizar agora"). A 390px isso já estourou antes.
- **Valor grande estoura a coluna**: desenhe pelo menos um card com **R$ 1.234,56** e um kit de 3 peças na coluna de 520px do desktop.

## Entregável
Pranchetas, em escuro e com as duas primeiras repetidas no claro:
1. **Mobile 390 — par antes/depois** da lista: alerta de fila + card pendente → card limpo + toast de sucesso.
2. **Mobile 390 — o momento fora da tela**: o vendedor está na Calculadora quando a fila drena.
3. **Desktop 1280 — mestre-detalhe, par antes/depois**: coluna esquerda (lista com o card selecionado) + coluna direita (registro com "Ainda não sincronizado" → registro limpo, com "Editar rótulo"/"Excluir"/"Exportar" já disponíveis).
4. **As três transições que não são sucesso**, lado a lado (Premium pausado · sessão expirada · recusa do servidor), para provar que a linguagem do sucesso não se confunde com nenhuma delas.
5. **Estado offline + N pendentes**, com o sinal agregado.

Reutilize os primitivos existentes, sem criar nenhum: `tf-toast--success` (com o ícone de check e o botão de fechar) para o momento; `tf-alert--info` / `tf-alert--danger` para a fila; `tf-badge--info` / `tf-badge--danger` para o selo do card; `tf-card` para o registro; `tf-btn--secondary tf-btn--sm` para "Sincronizar agora" / "Ver" / "Entrar de novo"; `tf-spinner` para o "durante". Marque na prancheta a duração e a posição do toast.

## Perguntas em aberto para o dono
1. O sinal de sucesso aparece **em qualquer tela** (a fila drena com o vendedor na Calculadora) ou só quando ele está em Orçamentos? Fora da tela, ele é dispensável ou o vendedor precisa saber?
2. Com **vários registros** sincronizando juntos, qual a frase? Hoje só existe o singular "Registro sincronizado." — um plural ("{n} orçamentos sincronizados.") precisa ser escrito e aprovado.
3. O toast leva uma ação ("Ver registro") ou é só confirmação?
4. Quando a sincronização acontece com o app em segundo plano e o vendedor volta depois, o momento já passou: mostrar um resumo calmo ("tudo sincronizado") ou nada?
5. As ações que **aparecem** no momento ("Editar rótulo", "Excluir", exportar destravado) surgem sob o dedo de quem está lendo o registro. Elas entram imediatamente ou o desenho deve segurar/anunciar essa mudança?
