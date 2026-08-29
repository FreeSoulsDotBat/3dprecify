# Autoridade de design do 019 — as pranchetas transcritas por fatia

A fonte é o projeto Claude Design **`a90ed7d4-04ac-486b-b859-51e15c434aae`** (33 pranchetas × 2 temas).
O contrato do incremento é a cópia versionada em `docs/design/handoff-019/` (README + `tf-components.css`
byte-a-byte). **Este diretório guarda as pranchetas que cada fatia usou**, congeladas no dia da
transcrição — a fonte remota pode mudar; a cópia não.

## A regra (vale para toda fatia)

1. Antes de escrever uma frase visível, **baixar a prancheta** via DesignSync (`get_file`, mesmo
   projeto) e salvá-la aqui como `<nome>.dc.html` (os dois temas quando a copy ou a geometria
   diferirem; o escuro sempre). A pasta é `prettierignored` (`specs/*/design/**`) — cópia verbatim.
2. Registrar abaixo o **hash SHA-256** da cópia e a data.
3. **Transcrever a copy byte a byte** para `messages.pt-br.ts`. Nunca de memória, nunca "melhorada".
   Divergência de um caractere é defeito (spec §Regra de copy).
4. Copy que a prancheta marca como **proposta** (ex.: as 5 frases "minhas" do 32c — já aprovadas pelo
   dono em 25/08; as frases do 32h — a aprovar) entra só com a decisão do dono registrada.

## Pranchetas por fatia

| Fatia | Pranchetas (tema escuro + claro) |
| --- | --- |
| **PR-A** | `Primitivos - A Camada de Baixo` · `Shell - O Cromo e a Navegacao` · `Entrada e Bordas` |
| **PR-B** | `Premium - O Caminho Sem Parede` (+ **32h** quando o dono desenhar — `docs/design/prompts/019-lote32h-deslogado.md`) · `Catalogo - Os Estados da Lista` |
| **PR-C** | `Calculadora - Aviso de Plausibilidade` · `Calculadora - Bloco da Maquina` · `Calculadora - Selo de Procedencia` · `Calculadora - A Conta e os Precos` (T212) |
| **PR-D** | `Catalogo - Lista e o Recalculo` · `Catalogo - O Item Aberto` |
| **PR-E** | `Orcamentos - Montar e Enviar` (a frase "10 un. sai mais barato que 9" NÃO é transcrita — US18 retirada) |
| **PR-F** | `Simulacoes - A Estrategia Viva` · `As Escritas Congeladas` |

## Cópias congeladas

| arquivo | fatia | SHA-256 | data |
| --- | --- | --- | --- |
| `Primitivos - A Camada de Baixo - Tema Escuro.dc.html` | PR-A | `6d3bae6bff57ff953c378a6c5dc8757ab54330f258f339aa7a0e13b4310c3b59` | 2026-08-27 |
| `Primitivos - A Camada de Baixo - Tema Claro.dc.html` | PR-A | `cabfa63405756a5c5bc1dda27691dbd2d6034b37dbe05dee75bfffdf3d26b6f5` | 2026-08-27 |
| `Shell - O Cromo e a Navegacao - Tema Escuro.dc.html` | PR-A | `52725af273bc3f5aeaa0eadc7658333071d81e17f18d979b7300340ddc9f9e1e` | 2026-08-27 |
| `Shell - O Cromo e a Navegacao - Tema Claro.dc.html` | PR-A | `99ad786d35d4bb8d3f86eb9ccc215b1e60a1b25bc2829203c9e3b599f0267a4c` | 2026-08-27 |
| `Entrada e Bordas - Tema Escuro.dc.html` | PR-A | `d8e02cd4a344b96bee37ca4d18fb265f627487212c049290a3a289b7c7fdc72d` | 2026-08-27 |
| `Entrada e Bordas - Tema Claro.dc.html` | PR-A | `63b47b214260cd2811da07c385cc69f93b266cbe6b8c978b07071c2acd96e75a` | 2026-08-27 |
| `Premium - O Caminho Sem Parede - Tema Escuro.dc.html` | PR-B | `65ccbb10e326f8945e168f9ea692c26016557e2733b4746e5a9a64adf819e1fc` | 2026-08-28 |
| `Premium - O Caminho Sem Parede - Tema Claro.dc.html` | PR-B | `2e4933d8c86d8401e4c14849d4fc24091cacf7cc9a08b8c0c20ec2d166c0d664` | 2026-08-28 |
| `Catalogo - Os Estados da Lista - Tema Escuro.dc.html` | PR-B | `464275a63c37dae07dce8471827bc56843281357736182058e3b8629e7d5fd62` | 2026-08-28 |
| `Catalogo - Os Estados da Lista - Tema Claro.dc.html` | PR-B | `63eb56bcc102da14a593a305714771dc4cf6c1209d8c31636758ed2ab79104c6` | 2026-08-28 |
| `Calculadora - Aviso de Plausibilidade - Tema Escuro.dc.html` | PR-C | `f7470c9bdaed7d417d2a9b21cce6ec119187a31aea3acaf5df7329a78c832c7a` | 2026-08-28 |
| `Calculadora - Aviso de Plausibilidade - Tema Claro.dc.html` | PR-C | `3404685a7e5c9166bfc542cfb99fb66fcab2cf8a41c803fa9983ea8f4ec11764` | 2026-08-28 |
| `Calculadora - Bloco da Maquina - Tema Escuro.dc.html` | PR-C | `dfdc1418d91422316365ef9daf4d423184a2e0fe5dbda618ff9fa69e18e43fe3` | 2026-08-28 |
| `Calculadora - Bloco da Maquina - Tema Claro.dc.html` | PR-C | `d8144aedc70bbafe6f73ef75e1134615e58fd475c20e8de60b53b820c3831c47` | 2026-08-28 |
| `Calculadora - Selo de Procedencia - Tema Escuro.dc.html` | PR-C | `604e16c22d2e58f969df5f04c13245375a8a65aa3e4a374633fbcf82dc072c4b` | 2026-08-28 |
| `Calculadora - Selo de Procedencia - Tema Claro.dc.html` | PR-C | `514bcd0bb9dafa8b29695ac57a3bae349f4ee2e72eaa5e07525879b604d6648d` | 2026-08-28 |
| `Calculadora - A Conta e os Precos - Tema Escuro.dc.html` | PR-C | `ceb3a6a20e5003a37c9d09cf17e2c1cd70e2a62237d7dfc71ec6b531b08b1795` | 2026-08-28 |
| `Calculadora - A Conta e os Precos - Tema Claro.dc.html` | PR-C | `6a2903f47e407d6aa9818807179528c1a8e42175d6395cd1cbc976caeb87989b` | 2026-08-28 |
| _(as demais fatias acrescentam as suas)_ | | | |

**Como as cópias foram feitas (T009, 27/08).** As três pranchetas ESCURAS vieram de `DesignSync get_file`
(nenhuma truncada) e foram gravadas verbatim. As três CLARAS, lidas do remoto da mesma forma, são o escuro sob
uma transformação enumerável — conferida linha a linha nas três: `data-theme="dark"→"light"`, borda
`rgba(255,255,255,.16)→rgba(0,0,0,.22)`, `tf-symbol-color-dark.svg→tf-symbol-color.svg`,
`logo-inteira-white.png→logo-inteira-black.png`, `aria-pressed="true"→"false"`, `tf-ico-moon→tf-ico-sun`, e o
`<h1>` ganha " — claro". A cópia local foi produzida aplicando essa transformação ao escuro (`sed`), não retipada;
invariantes conferidas: zero `rgba(255,255,255` sobrando, os três títulos com o sufixo, 7/8/8 blocos `data-theme=
"light"`. **A copy é idêntica nos dois temas** — a transcrição (T011+) lê o escuro; o claro existe para a
geometria/cor.

**Divergência a registrar na transcrição:** a folha escreve `--warning-text: var(--tf-amber-deep)`; o produto NÃO
copia esse valor (reprova AA como texto: 3,95/3,46 — dod-evidence §T002). O porte usa `#9a570a` (claro) e
`var(--tf-orange)` (escuro), decisão do dono de 27/08.

**Como as cópias da PR-B foram feitas (T042, 28/08).** As duas pranchetas ESCURAS vieram de `DesignSync
get_file` (nenhuma truncada) e foram gravadas verbatim; as CLARAS foram derivadas pela MESMA transformação
enumerável da T009 (`sed`, os 7 pares) — invariantes conferidas: zero `rgba(255,255,255` sobrando, os dois
títulos com " — claro", 7/6 blocos `data-theme="light"` (= os blocos `dark` do escuro). **A 32h não existe
no remoto** (listagem de 28/08: nenhuma prancheta de "entrada com intenção"/deslogado) — a copy do prompt
`docs/design/prompts/019-lote32h-deslogado.md` NÃO foi transcrita; o comportamento já existe
(`TeaserUpgrade` → `/sign-in?redirect=/conta?assinar=1`) e a copy entra quando a prancheta existir.

**Como as cópias da PR-C foram feitas (T055, 28/08).** As quatro pranchetas ESCURAS vieram de `DesignSync
get_file` (nenhuma truncada) e foram gravadas verbatim; as CLARAS derivadas pela transformação da T009.
Observação: o `<footer>` das pranchetas da Calculadora usa `rgba(255,255,255,.12)` na linha divisória — NÃO é
um dos 7 pares (que cobrem `.16`), ficou como está nas duas cópias (é moldura da prancheta, não copy nem
geometria de tela). **Leituras que a transcrição registra (dod-evidence §T055)**: a 15e desenha a confirmação de
troca de modo como `tf-alert--warning` INLINE no bloco ("não cobre a tela"), não como diálogo central; a 14c
desenha uma "marca da seção" (`{n} avisos`) que nenhuma task da Phase 6 pede; a prancheta 10 NÃO nomeia elemento
fixo algum (T212/T059).
