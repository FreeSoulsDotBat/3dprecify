# Handoff do design — cópia versionada para o incremento 019

> **Cópia de 2026-08-26** de `design_handoff_precifica3d/README.md` do projeto Claude Design
> `a90ed7d4-04ac-486b-b859-51e15c434aae` (o projeto onde o dono desenhou as 157 superfícies —
> 33 pranchetas × 2 temas). A fonte remota pode evoluir; **esta cópia é o contrato do 019**, no
> mesmo padrão do 018 (que versionou `Abas-Desktop.dc.html`). A folha `tf-components.css` ao lado
> é a cópia byte-a-byte da mesma data (69.702 bytes, 29 marcadores `NOVO`). As pranchetas em si
> são buscadas por fatia durante a implementação (DesignSync, mesmo projeto).

## O que o pacote é (nas palavras do handoff)

**Referência de design em HTML, não código de produção.** As pranchetas foram desenhadas *a
partir* do código deste repositório — cada primitivo carrega o arquivo de onde veio, cada texto
pt-BR é literal de `messages.pt-br.ts`, cada afirmação sobre medida cita a medida. **Não é
"implemente estas telas"**: a maior parte já existe no produto e está correta — a prancheta serve
de espelho. O trabalho real está nas listas abaixo.

Entrada: `Indice - As Pranchetas.dc.html` (32+ pranchetas, dois temas) e
`Cobertura - As 157 Superficies.dc.html` (**157 desenhadas · 0 de passagem · 0 sem desenho**).

## §1 — Os primitivos que o produto não tem (construir no PR-A)

Cada um nasceu de uma medida, não de gosto. Espécimes na prancheta `Primitivos - A Camada de
Baixo` (23b); inventário completo com procedência na 23g e no cabeçalho da folha (`grep NOVO`).

| Primitivo | O que é | Por quê (resumo; medida completa no handoff remoto) |
| --- | --- | --- |
| `tf-aviso` | 3ª categoria de mensagem (ícone + texto + dispensa) | Nem dica, nem erro: o número é válido, a conta sai, mas 850 g numa peça só provavelmente significa outra coisa. O produto tem 4 tons de aviso e nenhum serve. |
| `tf-plist` | Linha de lista densa (nome + meta + valor) | A 390px é a diferença entre ver 4 itens e ver 9. |
| `tf-table` | Tabela densa do Catálogo ≥1024px | Comparar preços de 12 produtos é leitura de COLUNA, e coluna não existe em cartões. |
| `tf-segmented--split` | Bandeja que ocupa a linha e divide em partes iguais | Só onde a largura é escassa (celular, par varejo/atacado); no desktop volta a se ajustar ao texto. |
| `tf-btn--full` / `--half` | As duas larguras do botão solto em coluna | Largura tirada do nº de letras não é legítima; na metade, rótulo >50% quebra em 2 linhas centradas com line-height próprio. |
| `tf-phone-scroll` | — | **Dispositivo de prancheta. NÃO portar.** |
| `tf-frozen` | Congelamento com esmaecimento nos CONTROLES, não no contêiner | `opacity` no wrapper arrastava a dica a 2,58:1 (reprova AA). Com a regra: dica 5,67:1, rótulo 18,23:1. **O `background: var(--bg-muted)` é obrigatório** (no claro são #ededf1 vs #ffffff). |
| `tf-alert--compact` + `tf-alert__action` | Geometria do selo de procedência | O tf-alert é alerta de PÁGINA (16px, ação 44px); o selo é denso — 12px e ação de 18px. Depende de `.tf-alert__body { flex: 1 }`. |
| `tf-alert__close` | "×" de dispensa dentro do selo | Alvo de 44px por **pseudo-elemento**, não por caixa (caixa de 44px ditava a altura do alerta). Decisão do dono (2026-08-26): dispensa vale **até a fonte mudar**. |

## §2 — O token que falta

`--warning-text` + tom `tf-alert--warning`. O produto tem 4 tons (neutro/info/confirmado/erro) e
nenhum de ATENÇÃO — o tom de que um app de precificação mais precisa ("o número saiu, e você
provavelmente não quer esse número"). Valor = `--tf-warning-deep`, que já existe. Observação de
contraste que vale conferir: **ciano e laranja reprovam como texto sobre branco** — usar os pares
escuros (`*-text`) quando a cor precisa ser LIDA (prancheta 23f).

## §3 — As oito adaptações de prancheta (DESFAZER no porte)

Cada uma está em comentário ao lado da própria regra na folha:

1. `var(--border)` → `--border-default` (troca de NOME, não de cor).
2. `position: fixed` → `absolute` no toaster e na TabBar (a moldura da prancheta não é a janela).
3. URLs de ícone → cópia local (`assets/icons/lucide/`) — o produto já faz igual via `TF_ICON_BASE`.
4. Componente React → classe CSS.
5. `a.tf-btn { text-decoration: none }` — o produto herda do preflight do Tailwind.
6. `clamp(3rem, 11cqw, 4.75rem)` + `container-type` no preço, onde o produto tem `12vw` — só a
   unidade muda; piso e teto são os do produto.
7. `flex: 0 0 auto` no `.tf-price__int` onde o produto tem `min-width: 0` — se o produto tiver o
   mesmo problema num valor extremo, o conserto vale lá também (decisão de quem porta).
8. `tf-price--rola` (máscara de esmaecimento) — **dispositivo de prancheta, NÃO portar**.

E dois que **não** são adaptação — consertos que o produto já tinha e a folha copiou de volta
(015/A6 tamanho no `__amount`; 016/T018-A1 `line-height: 1.2`). **Reverter reintroduz bugs pagos.**

## §4 — Divergências D1–D4 (decisões, não bugs)

| # | O quê | Sugestão do handoff |
| --- | --- | --- |
| D1 | 3 textos independentes de "Premium pausado" (Simulações/Kits/Orçamentos), cada um com os próprios verbos | NÃO unificar (dizem coisas diferentes de propósito); teste que força os três a mudarem juntos |
| D2 | 2 folhas de "Renomear simulação" com o mesmo título | Manter (telas que não coexistem); vigiar o TEXTO (mesma chave) |
| D3 | Vazio de busca: Catálogo não cita o termo; Orçamentos/Simulações citam | Decisão de gosto → clarify |
| D4 | "pode estar desatualizada" por linha + faixa no topo | Defensável/ruído → clarify |

## §5 — Copy nova a aprovar (verbatim nas pranchetas)

- **Bloco da máquina**: "Estimar"/"Ajustar" · "de R$ 4.000,00 ÷ 3.600 h" · "falta o valor da
  máquina" · 3 frases da confirmação de troca de modo.
- **Lista e o recálculo**: "3 preços mudaram desde a sua última visita" · "era R$ 38,90" ·
  "Salvo em 12/05" · "O cálculo continua grátis" · 2 frases da exclusão.
- **O item aberto**: "Preço fixado por você" · "Voltar a acompanhar o custo" · "Gancho (cópia)" ·
  "Este nome já está no catálogo" · 2 linhas do kit com peça parada.
- **Montar e enviar**: "Válido até" · "Enviar congela este preço" · "Voltar a acompanhar não vale
  para orçamentos enviados" · "Abaixo do custo" · "10 un. sai mais barato que 9" · 5 palavras de estado.
- Correção sem decisão: **"1 anos" → "1 ano"**.

## §6 — Mudanças de comportamento propostas

- **Aviso de plausibilidade**: gatilho `change`→`blur`; anunciado ao aparecer (a11y); "Entendi"
  guarda o par campo+valor pela sessão; o erro não come a lição; dinheiro no formato do produto.
- **Bloco da máquina**: custo/hora vira *readout* com a divisão escrita embaixo; existe no modo
  ajustar; zero ganha ressalva; troca de modo pede confirmação.
- **Selo de procedência**: ganha dispensa (`tf-alert__close`); **decisão do dono: até a fonte mudar**.
- **`Orcamentos - Montar e Enviar`**: a ÚNICA prancheta que não recria o código — propõe o
  construtor multi-item (quantidade, desconto, piso de custo). **Decisão do dono (2026-08-25):
  ENTRA no 019** (era proposta marcada; virou escopo).

## §7 — Fora de escopo (cercas do dono; NÃO implementar)

Mercado Livre/canal inteiro (US15 — volta com o token da casa; *não iniciar num "continue"*) ·
pipeline de ingestão mensal (= 017) · frete real (lacuna E3) · perfil do vendedor (lacuna E1) ·
homologação da parte premium (o dono faz depois). E não-defeito registrado: pontos 15–19 do
relatório de homologação eram o backend 500 pré-conserto (016/V0).

## Vocabulário e marca (decisões do dono já aplicadas nas pranchetas)

- **"marketplace", não "canal"**: 374 ocorrências de texto visível trocadas nas pranchetas;
  símbolos/arquivos/chaves intactos. Decisão do dono (2026-08-25): o produto acompanha NESTA leva.
- **Wordmark = `logo-inteira-{white,black}.png`** (arte real, Peace Sans — vive em
  `apps/web/public/brand/logo/`); `tf-symbol-color*.svg` só para o símbolo pequeno da top-bar;
  os `tf-lockup-color*.svg` foram APAGADOS do pacote de propósito (reconstroem o wordmark em
  Paytone One). TabBar 12→10px com 7px de respiro; anel de foco 2px; anel do menu em `--accent`;
  grafismos fora das telas 404/erro.

## Lote 32 — "Premium: o caminho sem parede" (mudança de padrão do dono)

O Premium passa a bloquear **só no salvar**. Sai a parede antes da lista, o botão de criar
desabilitado e o aviso de reativação para quem nunca teve. Entra o vazio didático (6 frases —
Filamento é do dono verbatim; as outras 5 aprovadas em 2026-08-25) + o formulário inerte
(`tf-frozen`, campos VAZIOS, "Salvar faz parte do Premium." acima da linha de botões, "Assinar
Premium" secundário, "Salvar" desabilitado visível). Exceção 32e (tinha e deixou vencer): campos
PREENCHIDOS inertes + "Reative o Premium… Seus itens estão salvos." 32f: os vazios de Orçamentos/
Simulações levam à calculadora ("Fazer um cálculo"). **O servidor continua recusando toda escrita**
— nada disso é permissão, é interface (Constituição IV intacta). Razão do dono: *"melhor que
escrever um texto do que a pessoa poderia fazer é mostrar o que ela poderia fazer"*.

## Mapa prancheta → arquivos

O mapa completo (60+ linhas, prancheta → arquivos do repositório) vive no handoff remoto e no
`github.md` do projeto Claude Design — consultar lá por fatia; reproduzi-lo aqui duplicaria um
documento que a implementação vai ler linha a linha na fonte.
