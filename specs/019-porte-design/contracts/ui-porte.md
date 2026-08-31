# Contrato de composição — 019 O porte do design (Fase 1)

O que este incremento expõe, nas fatias A/B/C/F, não é uma API: é uma **camada de primitivos e uma
composição de interface**. Este arquivo fixa as fronteiras que a implementação não pode atravessar.
Autoridade de design: `docs/design/handoff-019/` + pranchetas remotas (copy verbatim).

---

## C0 — Regras de folha (PR-A, ADR-0032)

```
variante de algo que existe  →  entra no .css daquele primitivo e vira prop do .tsx
primitivo novo               →  shared/ui/<nome>.tsx + shared/ui/<nome>.css (componente dono)
```

| primitivo/variante | vive em | prop | medida que o justifica |
| --- | --- | --- | --- |
| `tf-alert--compact` + `__action` + `__close` + `--warning` | `shared/ui/alert.{tsx,css}` | `compact`, `action`, `onDismiss`, `tone="warning"` | selo denso 12px / ação 18px / alvo 44px por pseudo-elemento sem alterar altura |
| `tf-btn--full` / `--half` | `shared/ui/button.{tsx,css}` | `width="full"\|"half"` | rótulo >50% quebra em 2 linhas centradas |
| `tf-segmented--split` | `shared/ui/segmented.{tsx,css}` | `split` | só onde largura é escassa |
| `tf-badge--warning` | `shared/ui/badge.{tsx,css}` | `tone="warning"` | (`--success/--danger` JÁ existem) |
| `tf-aviso` | `shared/ui/aviso.{tsx,css}` (NOVO) | — | 3ª categoria: válido-mas-provavelmente-não |
| `tf-plist` | `shared/ui/plist.{tsx,css}` (NOVO) | — | ≥9 itens a 390px (hoje 4) |
| `tf-table` | `shared/ui/table.{tsx,css}` (NOVO) | — | Catálogo ≥1024px, leitura de coluna |
| `tf-frozen` | `shared/ui/frozen.{tsx,css}` (NOVO) | **É** `<fieldset disabled>` — sem prop para desligar | esmaecimento nos CONTROLES; `background: var(--border-subtle)` (a folha manda — `--bg-muted` empatava com o cartão no escuro; entregue na PR-A, `frozen.css:3-10`); contraste AA 4,5:1 MEDIDO nos 2 temas (T016) — os 5,67/18,23 eram medidas de um tema da prancheta |

**Guardas (provadas por mutação)**: (1) uma classe `tf-*`, um arquivo — varre `apps/web/src/**/*.css`;
vermelha antes de promover `--compact` (hoje duplicada em `shopee-warnings.css`), verde depois; (2)
zero `tf-phone-scroll` / `tf-price--rola` no código e no bundle.

**Desfazer as 8 adaptações** do handoff §3 (nome do token, `absolute`→`fixed`, URL de ícone,
classe→componente, `text-decoration`, `11cqw`→`12vw`, `flex 0 0 auto`→`min-width:0`, sem `--rola`);
**não reverter** 015/A6 (tamanho no `__amount`) nem 016/T018-A1 (`line-height: 1.2`).

**Token**: `--warning-text` = `--tf-amber-deep` (`#bd6c0e`; **não existe** `--tf-warning-deep`) — entra
com **gate de contraste medido** (cálculo prévio: ~3,9:1 branco, ~3,5:1 sobre `--tf-warning-soft` —
abaixo de 4,5:1). Reprovando: escurecer o tom claro é **decisão do dono** (cor de marca). Ícone isolado
pode ficar no tom (não-texto = 3:1); texto não.

## C1 — Foco (decisão do dono 25/08, reafirmada 27/08)

**Nenhum controle mostra indicador de foco.** `:focus-visible { outline: none; box-shadow: none }` em
botão, cartão interativo, item de menu, aba, interruptor, linha de lista, ação/dispensa de alerta;
campos mantêm **só a borda de acento**. Exceção explícita ao WCAG 2.4.7, registrada no spec. A guarda
geométrica de foco do 018 é substituída pela guarda do **inverso** (zero anel renderizado), provada por
mutação.

## C2 — Premium sem parede (PR-B)

```
premiumGate({status}, session) → "active" | "lapsed" | "free-nunca-teve" | "signed-out" | "unknown"   // 5 estados (27/08); "-com-itens" é composição da tela
   (função PURA em shared/billing; decidida pelo LEDGER via GET /api/v1/entitlement; unknown nunca presume)
```

> **Esclarecimento datado (2026-08-31, chore de legibilidade):** o literal `free-nunca-teve` foi
> renomeado no código para `never-subscribed` (a união era o único identificador bilíngue do
> repositório). Semântica, estados e comportamento inalterados; este contrato permanece o registro
> do desenho de 27/08 com o nome da época.

| estado | lista | formulário | ação primária | mensagem (verbatim da prancheta) |
| --- | --- | --- | --- | --- |
| `free-nunca-teve` | vazio didático (6 frases, D4) — ocupa também o ramo `ENTITLEMENT_REQUIRED` | `<Frozen>`, campos VAZIOS c/ placeholder, **sem `onSubmit`** | "Assinar Premium" secundário; "Salvar" desabilitado e visível | "Salvar faz parte do Premium." acima da linha de botões |
| `lapsed` (+ itens, composto pela tela) | os itens do vendedor | `<Frozen>`, campos PREENCHIDOS | "Reativar Premium" secundário | "Reative o Premium… Seus itens estão salvos." (32e); a faixa de topo SAI |
| `active` | como hoje | vivo | — | — |
| `signed-out` | o MESMO vazio didático (E-5) | `<Frozen>`, campos VAZIOS | "Assinar Premium" → `/sign-in?redirect=/conta?assinar=1` (intenção preservada) | "Salvar faz parte do Premium." |
| `unknown` | como hoje (verificando / não foi possível) | — | — | nunca presume grátis nem premium |

**Invariantes**: diff **vazio** em `app/entitlement/` · **zero** chamada de rede de escrita no estado
grátis (teste prova por ausência) · **zero** item no outbox (o outbox é do Histórico; catálogo é
online-only) · **um teaser, nunca dois** (016/US1) · vazios de Orçamentos/Simulações levam à
**calculadora** ("Fazer um cálculo"). **Decidido 2026-08-27 (E-5)**: o visitante DESLOGADO vê o MESMO caminho sem parede; "Assinar Premium"
visível; no clique é convidado a entrar/criar conta e volta à oferta. **Um convite por ESTADO renderizado**: com
o formulário inerte aberto, o `TeaserUpgrade` do vazio não é renderizado e o rodapé é o único.

## C3 — Calculadora (PR-C)

- **Plausibilidade**: gatilho `blur`; anunciado (`aria-live`) ao aparecer; "Entendi" chaveado por
  `campo:valor` em memória de sessão; erro de validação **não** apaga o aviso; dinheiro no formato do
  produto; **nunca** bloqueia nem altera número.
- **Máquina**: custo/hora é **readout** com a divisão escrita ("de R$ 4.000,00 ÷ 3.600 h"), presente nos
  DOIS modos; zero ⇒ ressalva verbatim; confirmação (3 frases verbatim) SÓ em "Usar estimativa por ritmo" quando
  `detectRitmoMode(currentHours) === null` (é o único clique que descarta dado — `calculator-form.tsx:482-485`);
  "Ajustar" nunca pergunta; "Estimar"/"Ajustar". **`PriceInput` inalterado; sem bump.**
- **Selo de procedência**: `<Alert compact action onDismiss tone>`; dispensa persiste por chave
  `(marketplace, source, effectiveDate)` em `localStorage` sem uid; fonte mudou ⇒ chave nova ⇒ reaparece.
- **T212**: `position: sticky` no topo da coluna, 390px; guarda de geometria **nos dois eixos** durante
  a rolagem (caixa, não `toBeVisible`); única mudança estrutural autorizada no mobile.
- Máscara ao vivo **não** trunca `R$/kWh` a 2 casas (igualdade numérica com o motor); `"0"` reabre `"0,00"`.

## C4 — Geometria e homologação (todas as fatias)

- Zero transbordo nos **dois eixos** (Y por `scrollHeight` — headless não vê barra clássica) em 360 ·
  390 · 1279 · 1280 · 1440 · 1920px em toda tela tocada (a guarda `overflow-geometria.spec.ts` já cobre
  as 10 larguras; telas novas entram nela).
- Screenshots **1:1** nos dois temas; contraste **medido contra o fundo real** (soft sobre card).
- Mobile: a suíte existente continua exercitando o ramo sem `matchMedia` (018) — fora T212, nada muda.
- Cada fatia entra em **CORREÇÃO DECLARADA** com evidência completa; **nenhuma fecha** antes de a
  Rodada 1 fechar (D5).

## C5 — Vocabulário (PR-A, D2)

"canal" → "marketplace" **nos valores** de `messages.pt-br.ts` e no texto embutido que virar chave;
**nunca** em símbolos (`channel*`), chaves, rotas, nomes de arquivo (`cf-010-canais.spec.ts` mantém o
nome) ou **payload congelado** (orçamento antigo com "canal" abre idêntico). O diff de teste é lido
**separado** do diff de produto (R3).

## C6 — Simulações desktop (PR-F, emenda 0031)

Mesmo limiar (1280px), mesmo hook (`useIsWide`), mesma regra de seleção (estado, nunca URL); hospedeiro = a coluna
larga de `/calcular` (decisão 2, 27/08 — convive com o corte 1024 de layout da Calculadora, ambos nomeados na
emenda 2 do ADR-0031); a gaveta
de simulações **muda de hospedeiro, não de identidade** (o mesmo componente montado na composição
larga — nunca uma segunda cópia). Layout ≥1280px = prancheta 20g, transcrita. Largura útil **medida**
antes/depois a 1280/1440/1920. D1: teste que falha se **uma só** das SETE chaves com "Premium pausado" mudar (T090 as nomeia;
corrigido 27/08). D2: as duas folhas de renomear leem a **mesma chave**. Q1/Q2 (gosto) ao dono no gate.
