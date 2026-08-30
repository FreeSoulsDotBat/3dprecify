# Prompt para o Claude Design — Lote 32h: "O caminho sem parede" para quem NÃO tem conta

> Cole no **mesmo projeto** do Claude Design (`a90ed7d4` — "Precifica3D · 157 superfícies"). Os
> contextos de plataforma e de regras (`uploads/_CONTEXTO-1-PLATAFORMA.md`,
> `uploads/_CONTEXTO-3-REGRAS.md`) e o design system Truth's Forge já estão anexados lá — não os
> repita. Esta prancheta **estende o lote 32** (`Premium - O Caminho Sem Parede`): mesma tese, um
> visitante a mais.

---

## O que desenhar

A prancheta **32h — sem conta**: o mesmo caminho sem parede do lote 32, visto por quem abre o app
**sem ter conta nenhuma** — e o momento em que essa pessoa toca **"Assinar Premium"**.

Hoje o produto é público na Calculadora: qualquer um chega em `/calcular` sem login, calcula, e toca
em **Catálogo**, **Kits** ou **Orçamentos**. O lote 32 desenhou o que o usuário **logado sem Premium**
vê ali (vazio didático → "Adicionar filamento" → formulário inerte → "Salvar faz parte do Premium." +
"Assinar Premium"). O visitante **sem conta** não foi desenhado — e a decisão do dono (2026-08-27) é:

> **Ele vê exatamente o mesmo caminho.** "Assinar Premium" aparece para todo mundo, logado ou não. A
> diferença está no **clique**: quem já tem conta vai direto pagar; quem não tem é **convidado a criar
> uma conta ou entrar** — e, depois de entrar, cai onde queria (a oferta do Premium), sem perder o
> caminho.

## Por que este prompt existe

O lote 32 pressupõe uma conta (o servidor sabe que ela nunca teve Premium). Sem conta não há ledger,
não há "Assinar" que leve ao checkout, e o app hoje resolve isso mandando o visitante para a tela de
entrada com um `redirect` escondido na URL — a tela de entrada não diz **por que** ele está ali. Falta
desenhar: (1) a confirmação de que o vazio didático + formulário inerte são idênticos para o sem-conta
(nada de "crie uma conta" no lugar da feature — a tese é *mostrar em vez de contar*); e (2) **o
momento do clique**: a tela ou o painel que pede para criar conta ou entrar **dizendo o motivo**
("para assinar o Premium") e que, concluído, segue para pagar.

## O que já existe hoje (não invente do zero — corrija)

- Tela de entrada (`Entrada e Bordas`, 24a/24b): "Entrar com Google", os 4 estados (repouso,
  carregando, erro, offline), rodapé "Como tratamos seus dados". Ela **não** tem variante "com
  intenção" — chega igual para quem quer só entrar e para quem clicou em "Assinar Premium".
- O teaser de hoje para o sem-conta (`21e`, "teaser único"): título + subtítulo + preço + "Assinar
  Premium" que leva a `/sign-in?redirect=/conta?assinar=1`. **Sai**: no lugar dele entra o caminho
  sem parede do lote 32.
- O botão "Assinar Premium" já é um link para a entrada quando não há sessão. A copy da linha de
  preço ("Premium: R$ 15,99/mês · no plano anual, equivalente a R$ 12,99/mês") é a mesma do 32.

→ Problemas a resolver no desenho: a entrada-com-intenção não existe; e "Salvar faz parte do
Premium." + "Assinar Premium" precisam ler bem também para quem **nem conta tem** (o "Salvar"
desabilitado continua visível e inerte — é a regra do 32b).

## Conteúdo e dados reais

- Preço: R$ 15,99/mês · anual R$ 155,88 (= R$ 12,99/mês). Mercado Pago (Pix ou cartão); o cartão
  nunca passa pelo app.
- As 6 frases dos vazios didáticos do 32c **não mudam** (aprovadas). Nenhuma delas cita plano.
- A intenção preservada: depois de entrar, o destino é a **oferta** (`/conta?assinar=1`), não a
  home. Isto é comportamento já existente — a prancheta só precisa mostrá-lo.

## Estados obrigatórios

1. **Vazio didático — sem conta** (Catálogo/Filamentos, 390px): idêntico ao 32a; "Adicionar
   filamento" primário.
2. **Formulário inerte — sem conta** (390px): idêntico ao 32b — campos vazios em `tf-frozen`,
   "Salvar faz parte do Premium." acima da linha, "Assinar Premium" secundário, "Salvar" desabilitado
   visível. Se o desenho quiser diferenciar do logado, **só** na frase acima dos botões (proposta a
   aprovar pelo dono, marcada como tal).
3. **O clique sem conta → entrada com intenção** (390px): a tela de entrada dizendo o motivo
   ("Entre para assinar o Premium" ou a frase que o desenho propuser, **marcada como proposta**),
   "Entrar com Google", e a garantia de que o cálculo continua grátis. Estados: repouso, carregando,
   erro, offline (os mesmos 4 do 24a).
4. **Depois de entrar**: cai na oferta (`Billing - O Plano e a Oferta`, 21b) — só um ponteiro,
   não redesenhar.
5. **O mesmo clique, logado**: vai direto à oferta (21b) — ponteiro.
6. **1280px**: o vazio + formulário inerte lado a lado (32g) com o CTA levando à entrada-com-intenção
   — a entrada em desktop conforme 24g.

## Viewports

390px (obrigatório, todos os estados) · 1280px (estados 1–3) · 360px do estado 3 (a frase de motivo
não pode quebrar feio).

## Regras que o desenho não pode quebrar

- **Um convite por tela** (016/US1): "Assinar Premium" aparece uma vez na superfície; a linha de
  preço acompanha o botão.
- **Nada de parede, nada de coroa, nada de preço no vazio** — o convite vem depois do formulário.
- **Falha de rede não é upsell**; offline na entrada é o estado 24a-offline, não "assine".
- **O servidor continua recusando toda escrita** — a tela mostra um formulário que não salva; nada
  é "quase salvo".
- **Copy nova é proposta, marcada** — o dono aprova palavra por palavra (como no 32c).

## Armadilhas já pagas neste projeto

- Retorno frio depois do login (perder o `redirect` e cair na home) — já consertado uma vez
  (`951d714`); a prancheta precisa mostrar o destino certo.
- Placeholder que corta frase (016/PR-F): a frase de motivo vive em elemento de largura total.
- Dois CTAs na mesma tela (E6/T038-D4): contar, não presumir.

## Entregável

Prancheta `Premium - O Caminho Sem Parede` ganha a seção **32h** (ou prancheta irmã "32h — Sem
conta"), nos dois temas, com os 6 estados acima; primitivos existentes (`tf-empty`, `tf-frozen`,
`tf-btn --primary/--secondary`, `tf-card`, a tela de entrada do 24a); e a lista das frases novas
propostas, separadas das aprovadas, para o dono decidir.

## Perguntas em aberto para o dono

1. A frase acima dos botões para o sem-conta continua "Salvar faz parte do Premium." ou ganha
   variante ("Crie sua conta e assine o Premium para salvar")?
2. A entrada-com-intenção é a **mesma tela** de entrada com uma linha de motivo, ou um **painel**
   sobre a tela em que a pessoa estava (ela vê o formulário inerte atrás)?
