# Prompt para o Claude Design — Correções da Calculadora (PR-C do 019): quatro pranchetas

> Cole no **mesmo projeto** do Claude Design (`a90ed7d4` — "Precifica3D · 157 superfícies"). Os
> contextos de plataforma e de regras (`uploads/_CONTEXTO-1-PLATAFORMA.md`,
> `uploads/_CONTEXTO-3-REGRAS.md`) e o design system Truth's Forge já estão anexados lá — não os
> repita. Estas pranchetas **corrigem ou estendem** três lotes já desenhados da Calculadora:
> `Calculadora - A Conta e os Precos` (lote 10), `Calculadora - Aviso de Plausibilidade` (lote 14) e
> `Calculadora - Bloco da Maquina` (lote 15). Tudo aqui foi decidido pelo dono em 2026-08-28, depois
> de o código da PR-C ter sido implementado contra as pranchetas atuais — o que muda está dito item
> a item; o que não está dito **não muda**.

---

## 1 · O preço que acompanha o preenchimento (T212) — prancheta nova, lote 10

### O que desenhar

No celular (390px), o vendedor preenche um formulário longo e o preço só aparece no fim da página. A
decisão do dono:

> **A tela deve conter o preço enquanto o usuário preenche.** Um preço "provisório" fica visível
> durante a rolagem e, **quando o vendedor chega ao fim da página, esse preço provisório se mescla
> com o preço desenhado no fim** (o cartão "Preço varejo" da 10a) — um vira o outro, sem dois
> preços na tela ao mesmo tempo no ponto de encontro.

Desenhe:

- **(a) O estado "rolando"**: onde o preço provisório mora enquanto o formulário está no meio da
  rolagem — a 390px, com o teclado virtual fechado e com ele aberto. Ele mostra pelo menos o preço
  varejo (o protagonista da 10a) e recalcula a cada campo comprometido. Decida a anatomia (rótulo ·
  valor · o que mais cabe) e a altura; diga em px quanto da tela útil ele consome, porque a 14c já
  mediu que três avisos abertos somam 480px e o iPhone SE não perdoa.
- **(b) O encontro**: os quadros da transição em que o provisório e o cartão final se encontram e
  viram um só — o que fica, o que some, se há movimento. Quatro quadros bastam: longe do fim, perto
  do fim, no encontro, no fim.
- **(c) Os estados que o preço tem hoje** (10c) passam pelo provisório também: formulário inválido
  ("Confira os campos destacados para ver o preço." — o provisório não pode mostrar um número que
  não existe), resultado zerado, sem Premium (o provisório mostra só a conta grátis).
- **(d) 1024px e 1280px**: no desktop as duas colunas já deixam o resultado à vista? Se sim, diga que
  o provisório **não existe** lá e desenhe o porquê em uma linha; se não, desenhe onde ele fica.

### Restrições que o código impõe (fatos medidos, não opiniões)

- O rodapé de resultado (`.tf-calc-footer`) é o **último elemento do DOM** — por isso um `position:
  sticky` nele nunca gruda (nada vem depois dele) e um `sticky` no rodapé do viewport cai **no mesmo
  lugar do toaster** (`bottom: calc(var(--tabbar-h) + 12px)`) — os toasts do app (salvo, erro,
  offline) apareceriam por cima do preço. **Não desenhe o provisório na faixa acima da TabBar sem
  dizer o que acontece quando um toast chega.**
- A TabBar mobile tem 64px (`--tabbar-h`); o toaster vive logo acima dela.
- A ordem do rodapé desenhada na 10a (conta → barra → segmented → marketplaces → cartão) foi decidida
  e **não muda** com esta prancheta: o provisório é um elemento a mais, não uma reordenação.
- O preço varejo pode ter seis dígitos (10b: R$ 950.096,00) — o provisório precisa caber com ele.

### O que NÃO desenhar

- Nada de segundo cartão de preço permanente. No fim da página existe UM preço, o da 10a.
- Nada de "fixed" que cubra campos: o vendedor precisa ver o campo em que está digitando com o
  teclado aberto.

---

## 2 · A confirmação de troca de modo vira DIÁLOGO — correção da 15e, lote 15

### O que muda

A 15e desenhou a confirmação ("A estimativa por ritmo vai substituir as suas 2.000 h por 3.600 h")
como um `tf-alert--warning` **inline**, dentro do bloco, "sem cobrir a tela". O dono decidiu o
contrário:

> **É um diálogo mesmo** — a confirmação cobre a tela, como os diálogos de exclusão do Catálogo (29e)
> e do Histórico.

Redesenhe a 15e como **diálogo centrado** (`tf-dialog`, o mesmo primitivo dos diálogos de exclusão),
a 390px e a 1280px, com:

- o título e o corpo **iguais aos da 15e** (a copy já foi transcrita e aprovada: "A estimativa por
  ritmo vai substituir as suas {atual} h por {novo} h" · "{ritmo} h/ano × {anos}. Seu número volta se
  você tocar "Ajustar" de novo.");
- os dois botões com os dois números ("Usar 3.600 h" primário · "Manter 2.000 h" secundário) — e
  diga qual é a ação do X/Escape/toque fora (a leitura mais segura: **equivale a "Manter"** — recusar
  a troca não pode deixar o segmented mostrando um modo que não está valendo);
- o foco inicial (o diálogo de exclusão foca "Voltar"; aqui, qual?);
- o estado do segmented por baixo do diálogo (ele ainda mostra "Ajustar" selecionado enquanto o
  diálogo está aberto — a 15e já decidiu isso e continua valendo).

O que **não muda** no lote 15: o readout nos dois modos (15a/15b), a ressalva sem valor (15d), a
tira de estados (15g), o segmented na linha do título a 1280px (15f — já implementado com um limiar
de 1024px).

---

## 3 · A marca da seção "{n} avisos" — detalhar a 14c, lote 14

### O que existe e o que falta

A 14c desenhou, ao lado do título da seção ("Energia · ⓘ 2 avisos"), uma legenda discreta que conta
os avisos **ativos** (não os dispensados) para quem rolou rápido e não viu o azul lá embaixo. O dono
quer que ela entre — e para virar código ela precisa de estados que a 14c não desenhou:

- **1 aviso · 2 avisos · 3 avisos** (a flexão) e **zero** (a marca some — não fica "0 avisos");
- o instante em que o vendedor toca "Entendi" num dos avisos: a marca **baixa** (de 2 para 1) — um
  quadro antes e um depois;
- a seção com a marca **e** a marca de erro ao mesmo tempo (um campo recusado e outro avisando):
  qual vem primeiro, ou a marca de aviso não aparece quando há recusa?;
- a 1280px, onde o título da seção divide a linha com outros controles (a 15f pôs o segmented na
  linha do título de "A máquina"): a marca e o segmented cabem juntos? Desenhe "A máquina · ⓘ 1
  aviso · [Estimar | Ajustar]" a 1280px;
- a marca é clicável? Se sim, para onde leva (rolar até o primeiro aviso ativo?); se não, diga.

Copy: "1 aviso" / "{n} avisos" é a única frase; se quiser outra forma, marque como proposta.

---

## 4 · A linha de peça de kit com `tf-aviso` — detalhar a 14e, lote 14

### O que existe e o que falta

A 14e desenhou o aviso de quantidade da peça de kit ("Confira a quantidade: 3.000.000.000. O máximo
por peça é 2.147.483.647…") com o mesmo `tf-aviso` dos campos da Calculadora, dentro do cartão menor
da peça. No produto ele ainda é um parágrafo solto (a "terceira forma" que a 14 aposentou). O dono
quer que entre — e o cartão da peça tem estados que a 14e não cobre:

- a peça **recolhida** (só o cabeçalho "Peça 2 · Suporte de fone · R$ 9,40" visível) com um aviso
  ativo dentro: o cabeçalho sinaliza? (a mesma marca discreta do item 3, ou nada?);
- a peça **do catálogo** (referência a um produto salvo) versus a peça **avulsa** — o campo de
  quantidade existe nas duas; o aviso é igual nas duas;
- o aviso **dispensado** ("Entendi") e o kit reaberto depois: a dispensa vale "nesta sessão", como na
  Calculadora — desenhe o reaparecimento ao reabrir o kit numa sessão nova, em uma linha;
- a 360px, com o número de dez dígitos: a 14g já provou que o número não quebra — confirme no
  cartão menor.

---

## Regras de entrega (as mesmas dos lotes anteriores)

- Duas versões de cada prancheta: **Tema Escuro** e **Tema Claro**, com os nomes no padrão
  (`Calculadora - <nome> - Tema Escuro.dc.html`).
- Copy: tudo o que for frase visível nova vem **marcado como proposta** — o dono aprova antes de
  virar código. As frases já aprovadas (itens 2 e 5 da PR-C) não mudam.
- Cada prancheta diz, no rodapé, **o que muda no código** em uma frase por item — é o que a fatia
  transcreve.
- Medidas em px onde houver decisão de espaço (altura do provisório, a marca na linha do título).
