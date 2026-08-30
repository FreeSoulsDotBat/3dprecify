# Selo (Badge) — os quatro tons de status, o selo Premium que falta e o selo de procedência que quebra linha

## O que desenhar
O selo é a pílula pequena que o Precifica3D usa para carimbar um estado sobre um elemento maior: o plano do vendedor na aba Conta ("Premium", "Gratuito", "Premium pausado"), a etiqueta "recomendado" no cartão do plano anual, o aviso "Alterações não salvas" na barra de contexto do cenário, o estado de sincronização de cada registro do Histórico e — o caso mais pesado — o **selo de procedência da tarifa** que fica colado a cada campo de comissão de marketplace na calculadora, dizendo de onde aquele número veio e quando foi conferido. É a peça que o vendedor lê de relance, sem clicar, para saber se pode confiar no que está na tela. Ela aparece em todas as abas, no mobile e no desktop, sobre cartão e dentro de formulário.

## Por que este prompt existe
`PROTOTIPO_PARCIAL`. O protótipo de 2026-07-02 (`docs/design/prompts/claude-design-prototype.md` §D.2) **desenhou** os tons de status — o canvas do dono tem `tf-badge--success` ("Ao vivo"), `tf-badge--info` ("recomendado") e `tf-badge--neutral` nos chips de período — então os quatro tons não são invenção do código. O que **falta é o outro selo**, especificado duas vezes no mesmo documento: *"Badge Premium — pequeno, **laranja** (`--energy`, texto preto), rótulo 'Premium'. Marca ações gated"*, com ícone de coroa e aparência sólida. O `badge.tsx` do app não tem aparência sólida, não tem espaço para ícone e não tem nenhum tom laranja — a marca visual do que é Premium, o principal sinal do modelo freemium, foi desenhada e nunca existiu. Isso é **divergência declarada**, não lacuna.
E o canvas prova a falta pela prática: vários selos dele são pintados com `background`/`color` **inline**, porque o primitivo não oferecia o tom necessário.
Sem desenho também estão as **exceções locais** que nasceram fora do DS (`fee-seal.css`, "US2 homologation (T026b)"): o selo de tarifa reverte três decisões do primitivo — deixa quebrar linha, alinha o texto à esquerda e ganha uma borda de 1px porque **no tema escuro o fundo do selo neutro (`--bg-muted` = neutral-900) é idêntico ao do cartão (`--surface-card` = neutral-900) e a pílula simplesmente sumia**.

## O que já existe hoje (não invente do zero — corrija)

Um único primitivo, com uma única propriedade (`tone`), quatro valores:

| Tom | Fundo | Texto | Onde aparece hoje (texto literal) |
|---|---|---|---|
| `neutral` | `--bg-muted` | `--text-body` | "Gratuito" · "Premium pausado" · "Não foi possível confirmar seu plano." · "Alterações não salvas" · a maioria dos selos de tarifa |
| `info` | `--tf-info-soft` (ciano) | `--info-text` | selo de tarifa com referência fresca · "Pendente neste dispositivo" no Histórico · "estimativa de frete" |
| `success` | `--tf-success-soft` (verde) | `--success-text` | "Premium" no cartão do plano · "recomendado" no Plano anual |
| `danger` | `--tf-danger-soft` (vermelho) | `--danger-text` | "Não foi possível registrar" no Histórico |

Forma atual (inferida no código, sem desenho): altura mínima **24px**, respiro `0,125rem` na vertical × `--space-3` na horizontal, raio pílula, `caption` semibold, `line-height: 1`, `white-space: nowrap`, texto centralizado por padrão, sem borda.

→ **Problema 1 — o selo neutro desaparece no escuro.** Fundo do selo = fundo do cartão. O `fee-seal` resolveu localmente com uma borda de 1px `--border-default`; todos os outros selos neutros do app ("Gratuito", "Premium pausado", "Alterações não salvas") continuam invisíveis como pílula — leem-se como texto solto. O desenho tem de decidir isso **no primitivo**, não em cada feature.
→ **Problema 2 — não existe selo Premium.** Nenhuma ação gated é marcada visualmente; o freemium não tem carimbo.
→ **Problema 3 — o selo de tarifa não é um selo de status, é uma frase.** Chega a ~90 caracteres e quebra em 2–3 linhas; a forma "pílula de 24px" foi feita para uma palavra. Ele merece uma variante desenhada, não uma exceção sobrescrevendo o primitivo.
→ **Problema 4 — "Não foi possível confirmar seu plano." é uma frase com ponto final dentro de uma pílula.** Copy ruim para o formato: é mensagem de erro, não rótulo de estado. Ou o selo encolhe para "Plano não confirmado" (e a frase vira legenda abaixo), ou este caso deixa de ser selo.

## Conteúdo e dados reais
- **Plano (aba Conta):** "Premium" (`success`) · "Gratuito" (`neutral`) · "Premium pausado" (`neutral`) · "Não foi possível confirmar seu plano." (`neutral`). Em carência o selo **continua verde com o texto "Premium"** — a cautela mora na legenda, em `--info-text`: o premium segue ativo e degradar o selo seria a mentira contrária.
- **Oferta de planos:** "recomendado" (`success`) sobre o cartão "Plano anual · R$ 155,88/ano · equivalente a R$ 12,99/mês · ~19% de economia frente ao mensal". O mensal é "R$ 15,99/mês".
- **Histórico (estado do registro):** "Pendente neste dispositivo" (`info`) · "Envio pausado · precisa de Premium" (`info`) · "Envio pausado · sessão expirada" (`info`) · "Não foi possível registrar" (`danger`). Repare que três desses passam de 20 caracteres — nenhum é uma palavra só.
- **Cenários:** "Alterações não salvas" (`neutral`).
- **Selo de procedência da tarifa (calculadora, um por canal):** textos montados, com números reais —
  - "Referência: Tabela de comissões da Amazon — Calçados (11%) · atualizada em 06/07/2026" (`info`)
  - "referência embutida (offline) · atualizada em 06/07/2026 · pode estar desatualizada" (`neutral`)
  - "Referência: Tabela do Mercado Livre (para Calçados) · atualizada em 06/08/2026" (`info`)
  - "categoria não informada — usando a maior alíquota da tabela" (`neutral`, **nunca** `info`)
  - "ajustado por você" (`neutral`) · "sem referência — informe as taxas" (`neutral`) · "estimativa de frete" (`info`)
  - selo separado da taxa fixa: "Taxa fixa: venda.amazon.com.br/precos · vigente desde 01/08/2026" (`neutral`)
- **Selo Premium (a desenhar):** rótulo "Premium", laranja `--energy`, texto em `--energy-contrast`, ícone de coroa ~11px à esquerda, aparência **sólida** (não o fundo suave dos tons de status). Marca ação/campo bloqueado — vive colado a um botão ou ao título de um bloco gated, nunca sozinho no meio do nada.

## Estados obrigatórios
- **Repouso** — cada um dos quatro tons, sobre `--surface-card` **e** sobre `--bg-base`, nos dois temas. O escuro é onde o neutro morre: mostre a solução.
- **Selo Premium sólido** — laranja, com e sem ícone de coroa.
- **Selo longo (procedência)** — 2 e 3 linhas, texto alinhado à esquerda, respiro interno que não vira "caixa de texto", ainda legível como carimbo. Inclua o pior caso: "Referência: Tabela de comissões da Amazon — Calçados (11%) · atualizada em 06/07/2026 · pode estar desatualizada".
- **Premium pausado** — selo neutro "Premium pausado" + a legenda que o acompanha: "Seus itens salvos continuam disponíveis para leitura."
- **Carência** — selo verde "Premium" com a legenda em tom de cautela abaixo. Desenhe os dois juntos para provar que a temperatura visual difere de uma assinatura saudável **sem** degradar o selo.
- **Offline / informação velha** — o selo do plano ganha o sufixo "última informação do servidor" na legenda; o selo de tarifa embutido diz "referência embutida (offline)".
- **Erro** — "Não foi possível registrar" (`danger`) e o caso do plano não confirmado.
- **Sem permissão (gated)** — a ação com o selo Premium ao lado; o selo não é clicável, quem é clicável é a ação.
- **Não existem** para esta peça: foco, hover, pressionado, desabilitado. O selo é decorativo-informativo e **não recebe foco nem clique** — se o desenho quiser torná-lo interativo, isso é decisão de produto (veja Perguntas em aberto), não um estado a inventar.

## Viewports
- **Mobile 390px** — obrigatório: é onde o selo de procedência quebra linha e onde ele divide a largura com o campo de taxa. Desenhe o selo longo dentro de uma coluna de conteúdo real de 390px, não isolado.
- **Desktop 1280px** — a largura de corte do redesenho 018: o selo do plano vive na coluna do plano (com a oferta aberta inline ao lado) e o selo de procedência ganha espaço, então mostre como ele se comporta quando **cabe em uma linha só** — a mesma peça não pode parecer dois componentes diferentes.
- 1920px é opcional: nada muda além da largura disponível.

## Regras que o desenho não pode quebrar
- **Procedência é obrigação, não enfeite.** Um número pré-preenchido nunca pode parecer conferido pelo vendedor. O tom `info` significa "temos referência da SUA categoria"; catch-all e semente ficam em `neutral` de propósito — dar a eles o mesmo tom de uma referência confirmada é exatamente o que faz o vendedor parar de escolher a categoria.
- **Freemium é binário.** "Premium" e "Gratuito" são os dois únicos planos; não invente níveis intermediários, "trial" ou "pro".
- **Degradação dita, nunca escondida** — "pode estar desatualizada", "referência embutida (offline)", "sem referência — informe as taxas" precisam caber inteiras e legíveis. Frase honesta nunca em elemento que corta.
- **Falha de rede nunca vendida como falta de Premium** — "Envio pausado · sessão expirada" e "Envio pausado · precisa de Premium" são dois selos diferentes e devem ler-se diferentes.
- **Contraste medido contra o fundo real** — o selo vive sobre `--surface-card` e sobre `--bg-base`; texto ≥4,5:1 e a **borda/fundo do selo distinguível do cartão** em ambos os temas (é o defeito nº 1).
- **Alvo ≥44px** só vale se o selo virar interativo; hoje não é. Se ficar não-interativo, ele **não** pode parecer um botão nem um chip clicável.
- O selo **não carrega dinheiro**. Preço tem seu próprio primitivo; um selo com "R$ 1.234,56" dentro é sinal de que a informação está no lugar errado.

## Armadilhas já pagas neste projeto
- **A pílula que some no escuro** — `--bg-muted` e `--surface-card` são o mesmo neutral-900. Isso passou em todo teste de texto (o texto estava lá, legível) e só apareceu numa homologação visual. Qualquer solução tem de ser **medida contra o fundo do cartão**, não contra o fundo da página.
- **Texto que estoura a coluna** — o `white-space: nowrap` do primitivo empurrava a largura mínima do selo para a linha inteira e gerava rolagem horizontal em 390px. Nenhum selo pode forçar overflow horizontal; meça o eixo X **e** o eixo Y.
- **Frase honesta cortada** — a homologação de 016 pegou uma frase de honestidade morando num sufixo de placeholder, onde era clipada. Frases de honestidade vivem em elemento de largura cheia; selos carregam rótulos curtos.
- **Exceção local que vira DS de fato** — três decisões do primitivo já são revertidas por uma feature. Ou o desenho abençoa uma variante "selo longo", ou o primitivo continua sendo contrariado onde mais importa.
- **Selo decorativo que nunca preenche** — já houve um campo dentro do selo que nenhum caminho de produção alimentava. Todo pedaço desenhado precisa de um dado real por trás.

## Entregável
Pranchetas, tema escuro (padrão) **e** tema claro, ambos completos:
1. **Cartela do primitivo** — os quatro tons em repouso, sobre `--surface-card` e sobre `--bg-base`, com as medidas de altura, respiro e raio anotadas, e a solução do contraste no escuro explicitada.
2. **Selo Premium** — sólido, laranja `--energy`, rótulo "Premium", com e sem coroa, em três contextos: ao lado de um `tf-button` gated, ao lado de um título de bloco gated, e dentro de uma linha de lista.
3. **Variante "selo longo" (procedência)** — os sete textos reais de tarifa, em 390px (quebrando) e em 1280px (uma linha).
4. **Em contexto** — o cartão do plano na Conta nos quatro estados (Premium, carência, Gratuito, Premium pausado) e uma linha do Histórico com cada um dos quatro selos de sincronização.
Reutilize os primitivos existentes: `tf-badge` é o alvo do redesenho; use `tf-card` como superfície de contexto, `tf-button` para a ação gated, `tf-alert` quando a mensagem for longa demais para um selo (é a fronteira que o desenho precisa marcar) e os tokens de texto para as legendas. Não crie primitivo novo — o que se pede é **uma propriedade de aparência (suave/sólida), um slot de ícone e um tom `accent`/laranja** no selo que já existe.

## Perguntas em aberto para o dono
1. O selo Premium **marca** a ação gated (carimbo ao lado, não clicável) ou **é** o gatilho da oferta (o vendedor toca nele e abre a assinatura)? Isso muda alvo mínimo, foco e se ele precisa de estado pressionado.
2. "Não foi possível confirmar seu plano." deve continuar dentro de uma pílula, ou vira legenda/alerta e o selo passa a mostrar algo curto (ex.: "Plano não confirmado")?
3. O selo de procedência da tarifa deve continuar sendo o mesmo componente do selo de status, ou é um componente próprio ("selo de procedência") com sua forma, já que é frase e não rótulo?
4. Existe algum lugar em que o laranja `--energy` do selo Premium concorra com o roxo `--accent` do botão principal na mesma linha? Se sim, quem ganha a atenção — a ação ou o carimbo?
