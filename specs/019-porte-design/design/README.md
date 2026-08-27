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
