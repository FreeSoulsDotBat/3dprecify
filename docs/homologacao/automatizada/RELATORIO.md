# Homologação automatizada — relatório consolidado

**Data:** 2026-08-13 · **Branch:** `018-abas-desktop` · **Pilha:** preview (build real) + FastAPI +
Postgres + emulador Firebase Auth + stub MP · **Escopo:** toda a plataforma exceto o checkout.

Corre em paralelo à homologação humana (rodada 1 ABERTA desde 2026-08-10). Nada aqui fecha ponto:
pelo processo do dono, só a segunda passada dele homologa.

---

## 0. O enunciado descrevia outra plataforma

Expo + React Native Web, Supabase e RevenueCat: **zero ocorrências** no repositório. Tudo foi
mapeado contra o stack real (React 19 + Vite PWA + FastAPI + Postgres + Firebase Auth). Três
cenários pedidos **não foram criados por não existirem**: cadastro por e-mail/senha, recuperação de
senha e exclusão de conta pela UI — o único método de autenticação é `signInWithGoogle`.

## 1. Números

| Fase | Entregue |
|---|---|
| 1 — cenários funcionais | **48**, cada um com evidência de código |
| 2 — subcenários de UI | **112** (cruzamento dirigido) |
| 3 — execução | **773 verificações reais** em 62 subcenários — 473 na UI (61 testes, 54 passaram) + **300 renderizações de PDF** |
| Defeitos | **35** — 0 críticos · 11 altos · 18 médios · 6 baixos |

Por categoria do que rodou: `input_invalido` 125 · `usuario_leigo` 76 · `acolhimento` 57 ·
`layout` 53 · `calculo` 33 · `gate_premium` 27 · `fluxo` 22 · `estresse_de_dados` 10 ·
`usuario_burro` 7 · `rede` 7 · `seguranca` 6 · `rota` 3 · `tema` 3 · `acessibilidade` 3 ·
`sessao` 1 · `crud` 1 · `concorrencia` 1.

## 2. O achado principal: o produto entrega preço errado sem avisar

A bateria do usuário leigo (`estresse-leigo.spec.ts`) não pergunta "quebrou?" — pergunta
"**avisou?**". Ela simula o erro que o vendedor real comete: digitar um número **plausível** que
significa outra coisa. Nenhum validador reprova esses valores, e o produto devolve um preço com
cara de preço.

**Nove achados ALTA, todos da mesma família:**

| O que o vendedor faz | Por que ele faz | Custo total vai de → para | Avisou? |
|---|---|---|---|
| Digita `120` em "Consumo médio" | A etiqueta da impressora diz **120 W**; o campo pede kW | R$ 16,16 → **R$ 615,56** (38×) | **não** |
| Digita `220` em "Consumo médio" | Confunde consumo com a **tensão da tomada** | R$ 16,16 → **R$ 1.115,56** (69×) | **não** |
| Digita `500` em "Reserva de manutenção" | Informa o gasto **anual**; o campo pede R$/hora | R$ 18,66 → **R$ 2.516,16** (135×) | **não** |
| Digita `150` no campo de **horas** | Quis dizer 150 **minutos** (2h30) | 15× o custo | **não** |
| Digita `1,000` em "Custo do rolo" | Copiou de site em inglês (mil) | lido como **1** → custo despenca para R$ 6,26 | **não** |
| Persona "copia da etiqueta" | Soma dos erros de unidade acima | **R$ 57.005,57** (3.528×) | **não** |
| Persona "pensa em anos e meses" | Vida útil em anos, manutenção anual, salário mensal | **R$ 5.516,16** (341×) | **não** |
| Persona "exagera sem perceber" | Erra casas decimais para cima | **R$ 6.000.061,60** (371.291×) | **não** |
| Persona "zera o que não entende" | Põe 0 em tudo que parece opcional | custo **R$ 0,00** e preço de venda **R$ 0,00** | **não** |

O caso `1,000` merece destaque porque é o único em que o erro é do PRODUTO, não do usuário: o
vendedor digitou mil e o produto entendeu um. Os outros oito são entradas legítimas do ponto de
vista do tipo — e é exatamente por isso que só um **aviso de plausibilidade** os pega.

Nenhum é bug de fórmula. A aritmética está certa em todos. O defeito é de **acolhimento**, e num
produto de precificação para leigos é o defeito mais caro que existe: o vendedor anuncia por
R$ 0,00 ou por R$ 6 milhões e o produto não deu um pio.

## 2b. Gross-up por canal (CF-010) — o segundo cálculo crítico **passou**

A verificação não compara o produto com a implementação dele. Compara com a **promessa que ele
publica na própria tela** (`sectionInfo.marketplace`): *"Anúncio = (preço + taxa fixa) ÷ (1 −
comissão%). Recebido líquido = o que sobra após a comissão sobre o anúncio e a taxa fixa."*

Duas invariantes, checadas em **24 combinações de tarifa** (4 comissões × 3 taxas fixas × 2 fretes),
com números lidos **só da tela** — sem supor arredondamento, ordem de operações ou banda aplicada:

- **I1** líquido == preço-base − frete → o gross-up entrega o que prometeu
- **I2** líquido == anúncio − anúncio×c% − taxa fixa − frete → a conta fecha com o que está exposto

**As 24 passaram nas duas.** Também passaram: o anúncio nunca fica abaixo do preço-base; o líquido
nunca fica acima dele; comissões de 100% e 150% são recusadas com mensagem nomeada; **o isolamento
por slot (SC-107) se sustenta** — um canal inválido erra sozinho e o vizinho continua precificando;
o selo declara a procedência da tarifa; e trocar o marketplace troca a tarifa aplicada.

Um achado ALTA, da mesma família do §2: **digitar `0,12` em "Comissão" querendo dizer 12%.** Ninguém
recusa — 0,12% é uma comissão válida —, e o anúncio cai de R$ 27,55 para R$ 25,24. O vendedor
anuncia R$ 2,31 abaixo do necessário e só descobre no extrato do marketplace.

Uma observação registrada como confirmação, não como defeito: **o slot da Amazon não renderiza o
campo "Frete"**, porque os campos do canal são dirigidos pelos eixos declarados no catálogo. É
exatamente o ponto 10 da sua rodada 1 ("os campos devem fazer sentido de acordo com o marketplace")
— implementado.

## 2c. Kits e Cenários salvos (CF-021–024, CF-013/032–034) — o essencial **passou**

**Kits.** A propriedade que governa o recurso — *montagem = soma independente por peça* (ADR-0016) —
foi verificada com **8 peças e quantidades variadas (1 a 10)**, somando os "Total da linha" lidos da
tela contra o "Custo total" do bloco "Total do kit": **fecha**. Continua fechando depois de salvar e
reabrir, o que também confirma o FR-407 (nenhum preço é armazenado — o kit reaberto **recalcula**).
Salvar sem nome é recusado com a frase do produto. Um nome de kit com 400 caracteres não estoura o
layout.

**Quantidade** foi atacada com 11 entradas reais (zero, negativa, decimal, "2 un", por extenso,
vazia, emoji, teto do int4 e acima dele). O produto avisa na maioria e, ao **salvar** com
2.147.483.648, não finge sucesso nem vaza linguagem técnica. Sobra um achado: enquanto se digita,
2.147.483.648 e 999.999.999.999.999 são aceitos **sem nenhum aviso** — mesma família do §2.

**Cenários salvos.** Salvar → listar → reabrir funciona de ponta a ponta, e a tela declara
*"Recalculado com os preços de hoje"* — a frase que separa uma simulação de um orçamento congelado.
As validações de 121 caracteres no nome e 501 na nota aparecem com as mensagens que o produto
define. A busca da lista aguentou 6 termos adversariais (acentos, emoji, `.*`, SQL, 300 caracteres)
sem esvaziar a folha nem vazar valor cru. Offline, a recusa é honesta (*"Salvar uma simulação
precisa de conexão"*) e **nenhum toast falso de sucesso** aparece. O usuário FREE não vê a ação de
salvar e recebe a oferta, sem erro.

**O follow-up R5 do 016 não reproduziu**: o valor `12.345,00` reabriu com a máscara de milhar
intacta.

Um achado MÉDIA, e é de acolhimento puro: **salvar uma simulação com o nome vazio não produz
absolutamente nada**. A evidência capturada mostra o botão "Salvar simulação" **habilitado**, o
clique acontecendo, e a folha continuando aberta sem a mensagem `"Dê um nome à simulação."` que o
produto já tem escrita. O vendedor clica e nada acontece — sem erro, sem salvamento, sem pista.

## 2d. Exportação PDF/CSV (CF-029) — a geometria **passou** em 300 renderizações

A lição que o E4 pagou duas vezes governa esta seção: *abrir o artefato é necessário e não é
suficiente — é preciso abri-lo com dados adversariais e, num artefato renderizado, com TAMANHO
adversarial, medindo GEOMETRIA*, porque os glifos colidem na página e não na string.

`docs/homologacao/automatizada/scripts/pdf_geometria.py` reusa o extrator posicional que a suíte do
projeto já mantém (`tests/test_export.py:_pdf_runs`) — escrever um segundo extrator seria inventar
uma segunda verdade sobre onde o texto está. A regra medida é geral e não depende de conhecer as
colunas do desenho: **na mesma linha de base, nenhum trecho pode começar antes de o anterior
terminar**; e nada pode ser desenhado fora da folha A4.

**15 nomes × 5 magnitudes de valor × com e sem detalhamento de custos = 150 orçamentos, 300
verificações. Zero colisões. Zero texto fora da folha.** O corpo inclui 400 caracteres sem espaço
(não há onde quebrar a linha), 200+ com espaços, emoji e CJK (glifos largos), árabe (RTL), markup
`& <…>`, texto com cara de fórmula, e valores até doze dígitos.

No fluxo real de download: o PDF chega, começa com `%PDF-`, tem conteúdo, e o nome do arquivo
sobrevive a um rótulo com 120 letras, `<b>` e emoji sem caractere proibido em sistema de arquivos.
O CSV chega com cabeçalho e linha. **O portão de entitlement é real**: com o Premium revogado pelo
mesmo caminho de operador que o concedeu, nenhum artefato nasce. Offline, a recusa é honesta e
nenhum arquivo falso é entregue.

## 2e. Shopee, bandas por regra, fila offline e degradação — **os quatro passaram limpos**

Zero defeitos nos quatro grupos, e cada um foi atacado no ponto em que costuma quebrar:

- **Perfil Shopee (CF-009).** As duas perguntas aparecem só na Shopee, a segunda só quando o perfil
  é CPF, e as quatro combinações (vazio · CNPJ · CPF+alto volume · CPF sem volume) **não produzem o
  mesmo número** — o eixo escolhe tabela de verdade, não é decorativo. A invariante do gross-up
  (anúncio ≥ base) vale em cada um dos quatro perfis.
- **Taxa fixa como REGRA, não constante (CF-010, `PCT_OF_PRICE`).** Empurrando o preço-base para
  abaixo de R$ 8 — onde a Shopee cobra metade do anúncio — a conta continua fechando, e a legenda
  que avisa que o valor muda conforme a faixa está lá. Atravessando o limiar para cima (markup
  ×500), o anúncio acompanha: **monotonicidade preservada**.
- **Categoria do anúncio (CF-008).** Busca com 7 termos adversariais (uma letra só, acento, emoji,
  SQL, 120 caracteres). Nenhum expôs valor cru, e **a contagem exibida não mente** — o defeito que o
  014 pagou para aprender ("8 encontradas" com 31 correspondências) não reapareceu.
- **A fila diante de 401 e de 403 (CF-025-UI-03 / CF-042).** Registro criado offline; a rede volta e
  o servidor recusa. Com **401**, o registro **não é destruído**, a tela nomeia a causa VERDADEIRA
  (sessão, não conexão) e oferece "Entrar de novo" — o hotfix 016/A3 se sustenta. Com **403**
  (Premium lapsado entre o registro e a sincronização), o registro é **retido e visível**, e a causa
  é dita. Nenhum dos dois vazou código HTTP para a tela.
- **Degradação de referência apagada (CF-024).** Kit salvo → o produto materializado é excluído do
  catálogo → o kit reabre, a linha continua existindo, declara-se `(avulsa)` e o preço não some.

## 3. Demais defeitos

### ALTA — nenhum fora da família do §2
O antigo CF-025 ("um Premium não encontra Salvar em Orçamentos") **caiu**: era a mesma corrida de
CF-012 e CF-029 — o teste procurava a ação enquanto o `GET /api/v1/entitlement` ainda estava em voo.
Corrigido na raiz do harness (a concessão agora espera a resposta do servidor dizer `active`), os
três desapareceram juntos. **Não há mais nenhum achado ALTA fora da família do §2.**

### MÉDIA — 16
1. **Texto sem espaços estoura a página**: nome de sub-custo com 300 caracteres → **2.100px** de
   rolagem horizontal (culpado medido: o texto dentro de `SPAN.tf-brow__label`, que pinta fora da
   caixa sem alargá-la); nome de filamento com 500 caracteres → **4.948px** no catálogo.
2. **A faixa de 426px quebra**: o teaser premium estoura **131px** no primeiro pixel do layout
   desktop. 390, 1024, 1279 e 1440 estão limpas.
3. **Recarregar apaga o que foi digitado**, sem aviso (custo voltou de R$ 19,91 para a semente).
   O reflexo de quem acha que travou é justamente recarregar.
4. **O custo total só aparece após 3,9 telas de rolagem** a 390px — quem não rola não vê o
   resultado.
5. **"2:30" e "2h30" no campo de horas**: nem aceitos nem explicados. O campo aceita o texto e
   simplesmente não reage — sem mensagem e sem efeito no preço.
6. **Foco invisível** no item de navegação **ATIVO** e num input. Causa no CSS:
   `.tf-nav__item:focus-visible` usa `background: var(--accent-soft)`, o mesmo realce que
   `[aria-current="page"]` já aplica — o item ativo não muda nada ao receber foco (WCAG 2.4.7).
7. **Contraste abaixo de 4,5:1** em 3 telas (Conta premium, oferta a 390px e a 1440px).
8. **Alvo abaixo de 24×24** na tela de entrada (link "Como tratamos seus dados", 181×20) — reprova
   WCAG 2.2 AA 2.5.8.
9. **`999999999999` gramas aceito sem aviso** (mesma família do §2).
10. **"Vida útil da máquina" não é alcançável** para quem pensa em anos: o campo só existe no modo
    "Ajustar horas direto". É consequência desejada do modo ritmo (016/US8), registrado como
    observação, não como regressão.

### BAIXA — 4
Gatilhos de tooltip ⓘ com 28×28: passam na WCAG 2.2 AA (24px), abaixo do conforto de 44px.

## 4. O que passou e vale dizer

- **A fórmula está certa.** Recalculei o preço-semente relendo as regras da spec em vez de importar
  `pricing-core`: 10,00 / 0,60 / 5,56 / 16,16 / 24,24 / 21,01. Bate ao centavo, e a soma das linhas
  exibidas fecha com o total exibido.
- **Offline o cálculo continua** — dobrar o custo do rolo moveu material para R$ 20,00 sem rede.
- **Nenhuma tela em branco, stack trace ou JSON cru** em 5 rotas × 3 larguras × 2 temas, nos 404 de
  1 e 2 segmentos, nem com o servidor em 500.
- **Open-redirect protegido**: 4 payloads (`https://…`, `//…`, `/../etc/passwd`, `javascript:`)
  testados **autenticando de verdade** — todos descartados.
- **Conteúdo do vendedor nunca é executado** (payloads `<script>` e `<img onerror>`).
- **Teasers honestos**: um por aba, sem "Entendi"/"Ir para a calculadora", e o usuário FREE vê o
  mesmo que o anônimo sem erro de verificação (ponto 15 da rodada 1 — **confirmado corrigido**).
- **Duas abas** editando a calculadora não derrubam uma à outra; 40 cliques seguidos no mesmo botão
  não quebram a tela.

## 5. Falsos positivos meus, eliminados antes de reportar

Dezessete achados iniciais eram do harness, não do produto — inclusive **dois "críticos de cálculo"** e
**dois "open-redirect críticos"**:

| Falso positivo | Causa real |
|---|---|
| "Soma de 20 sub-custos não bate" · "Remover linha do meio erra o total" | Meu seletor `/Valor/` casava com "Valor da hora", "Valor do acabamento" e "Valor da máquina". |
| "6 linhas do detalhamento sem R$" | Regex minha proibindo dígitos entre rótulo e valor ("Preço varejo / markup 50% / R$ 24,24"). |
| "Erro de console" | Meu `addInitScript` escrevendo em `document.documentElement` antes de ele existir. |
| "7 elementos sem foco visível" | Leitura de `box-shadow` **em transição** — medi o quadro 0. |
| "Tema não persiste" | Meu init script reescrevia a preferência a cada recarga. |
| "Open-redirect aceito" (×2, crítico) | `safeRedirect` age ao **concluir** o login; eu nem autenticava. |
| "Premium não acha 'Usar do catálogo'" | É **título de seção**; o controle é um combobox "Filamento salvo". Corrigido, o prefill passa. |
| "Persona não achou 'Mão de obra (horas)'" | Parênteses no rótulo viram **grupo** de regex sem escape. |
| **"12 críticos: a conta do canal não fecha"** | O slot da Amazon **não tem campo Frete**; meu preenchimento falhava em silêncio e eu cobrava um desconto que nunca foi informado. Ignorei o retorno da função. |
| "Erro de 150% não aparece no 2º canal" | `^Comissão` casa também com **"Comissão mínima/item"** — escrevi 150 no piso por item do canal 1. A evidência entregou: campo com "150,00" e 4 blocos de anúncio na tela. |
| "Reabrir o kit não restaura o nome" | Leitura ÚNICA logo após o clique, enquanto a reabertura ainda buscava o kit no servidor. Com `toHaveValue` (que reexecuta até o timeout) passa. |
| **"Um Premium não encontra X"** (×3: CF-012, CF-025, CF-029) | O auxiliar de concessão seguia adiante com o `GET /api/v1/entitlement` ainda em voo. Passou a esperar a resposta do servidor dizer `active` — os três caíram na mesma rodada. |
| "O nome da peça sumiu do PDF" (×20) | Comparação byte a byte contra um parágrafo que **normaliza** tabulações e espaços múltiplos. O nome estava lá, com um espaço no lugar de três. |
| "A linha degradada não se declara (avulsa)" + "o kit perdeu os preços" | Rodei a degradação a **1440px**, onde o 018 mudou o COMPORTAMENTO do card: clicar SELECIONA na ficha em vez de NAVEGAR. Eu lia a tela do catálogo achando que lia o compositor. A 390px passa. |

Registro isso porque um crítico falso queima a confiança nos verdadeiros.

## 6. O que ainda não foi executado

**bandas `PROGRESSIVE`** (o regime por FATIA do preço — o `PCT_OF_PRICE` foi coberto; a Amazon
publica progressivas em algumas categorias e nenhuma foi exercida) · **rollup de canais do kit**
(CF-023) · **produtos com referência viva** (CF-017) · **cenário sobre base apagada** (CF-033, o
gêmeo do CF-024 que passou) · **recalcular hoje / comparar então-vs-agora** (CF-028) ·
**throttling 3G** (implementado no harness, nunca acionado).

## 7. Recomendação priorizada

1. **Aviso de plausibilidade** — é o §2 inteiro, nove achados de uma vez. Não precisa recusar nada
   (a decisão do dono sobre `failurePct` sem teto continua válida): precisa **perguntar**. Uma
   faixa "esse preço ficou muito acima do usual — confira o consumo médio" resolve a família toda.
2. **Ler `1,000` como mil** ou avisar que o separador foi lido como decimal — é o único erro de
   interpretação do produto na lista.
3. **Reverificar CF-025** — único item que pode ser grave e ainda não é certeza.
4. **Quebrar texto longo** (`overflow-wrap: anywhere`) — mata os dois estouros.
5. **Foco do item de navegação ativo** — uma linha de CSS, uma reprovação de WCAG a menos.
6. **Faixa de 426px**, contraste, alvo de 24px, rascunho na recarga, resultado abaixo da dobra.

---

**Arquivos:** `fase1-cenarios.json` · `fase2-subcenarios.json` · `defeitos.json` · `resultados/`
(JSONL incremental por worker) · suíte em `apps/web/tests/homologacao/` — o modelo do usuário leigo
mora em `_leigo.ts` (erros de unidade, formatos reais, tempos reais, 6 personas).

Rodar: `npx firebase emulators:exec --only auth --project=demo-precifica3d "cd apps/web && pnpm exec playwright test --config=playwright.homolog.config.ts --grep-invert DIAG"`

**Nenhum arquivo de produção foi alterado. Nenhuma dependência foi adicionada** — o axe-core foi
substituído por verificações WCAG calculadas em página (contraste com composição de alpha, rótulos,
foco medido por comparação com/sem foco, alvos de toque com a isenção de alvo inline).
