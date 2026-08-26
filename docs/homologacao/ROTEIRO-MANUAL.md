# Roteiro de homologação manual — Precifica3D

**Para quem**: o dono, sentado na frente do produto. **Duração**: ~90 min para o roteiro inteiro;
os blocos são independentes e podem ser feitos em sessões separadas.

Este roteiro **não pede que você confie em mim**. Cada passo diz o que digitar e o número exato que
tem de aparecer. Onde eu não tenho o número, digo que não tenho.

**O processo em volta deste roteiro está em [`PROCESSO-HOMOLOGACAO.md`](PROCESSO-HOMOLOGACAO.md)** — em
particular a regra de que caminhar por todos os cenários é metade do trabalho: a outra metade é **repassar
pelos pontos já apontados**, depois da correção, antes de abrir cenários novos.

---

## Antes de começar

### Como subir o produto

```bash
# terminal 1 — banco (o container ja pode estar de pe; o compose mapeia 5433:5432)
docker compose up -d postgres
docker ps --filter name=precifica3d-postgres   # confirme "healthy" antes de seguir

# terminal 2 — backend na 8000, que e a porta que o cliente procura
cd backend
uv run alembic upgrade head
PORT=8000 P3D_FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 uv run python scripts/run_e2e_server.py

# terminal 3 — emulador de autenticacao (pode ja estar rodando na 9099)
npx firebase emulators:start --only auth --project=demo-precifica3d

# terminal 4 — cliente
cd apps/web && pnpm dev
```

### Confira antes de abrir o navegador

```bash
curl -s -o /dev/null -w 'health:      %{http_code}\n' http://localhost:8000/health
curl -s -o /dev/null -w 'entitlement: %{http_code}\n' http://localhost:8000/api/v1/entitlement
```

Espera-se **200** e **401**, nessa ordem. O 401 e a resposta CERTA sem token — o que importa e que
nao seja **500**.

> **Por que a conferencia nao pode ser so o `/health`, e eu aprendi isto errando:** o `/health` nao
> toca o banco nem a autenticacao. Com o backend subido do jeito errado, ele responde 200 alegremente
> enquanto **toda rota premium da 500**. Conferir so o `/health` e conferir o unico caminho que nao
> quebra.

> **O COMANDO do backend nao e `uvicorn` direto, e isto vale mais que a porta.** No Windows o
> uvicorn serve num `ProactorEventLoop`, e o driver async do psycopg **nao funciona nele**: o
> `/health` responde 200 (nao usa banco) e **toda rota que toca o banco da 500** — ou seja, toda
> tela premium. O projeto ja resolveu isso em `scripts/run_e2e_server.py`, que serve num
> `SelectorEventLoop`; o docstring dele explica por que a politica de event-loop sozinha nao basta.
>
> **E o `P3D_FIREBASE_AUTH_EMULATOR_HOST` nao e opcional**: sem ele o backend recusa todo token do
> emulador com **401**, e o app parece "sem premium" quando o problema e o token nao ser aceito.
>
> **A porta importa, e eu errei isto na primeira versao deste roteiro.** O cliente le
> `VITE_API_BASE_URL`, que em `apps/web/.env.development` aponta para **`http://localhost:8000`**.
> Se voce subir o backend noutra porta sem mudar essa variavel, o app abre, a calculadora funciona
> (ela e offline), e **toda tela premium falha em silencio** — voce concluiria que o produto esta
> quebrado quando o problema e so o endereco.
>
> **Postgres**: o banco do projeto vive na **5433** (o `docker-compose.yml` mapeia `5433:5432`, e o
> `settings.py` ja aponta para la). Se voce ver um postgres na 5432 nesta maquina, **nao e o deste
> projeto** — ignore.
>
> **Armadilha do preview**: se um `vite preview` antigo ficou vivo em :4173, ele serve um build
> **congelado**. Mate antes de investigar qualquer coisa que "nao funcionou".

### Como ficar premium para testar

```bash
cd backend
uv run python -m app.scripts.grant_premium grant <seu-email> --source comp --expires 2027-12-31
```

### O que este roteiro NÃO cobre, e por quê

| não coberto | por quê |
| --- | --- |
| **cobrança real (cartão, webhook, renovação)** | precisa do sandbox real do Mercado Pago — é a tarefa **T002**, sua, ainda não feita. Tudo aqui roda contra o stub local. |
| **leitor de tela** | exige execução assistiva real; a auditoria não o verificou e eu não vou fingir que verificou |
| **volume real de dados** | ninguém testou com 500 produtos; ver `[F13-004]` |
| **deploy / ambiente real** | nada foi provisionado |

---

## Bloco 1 — a conta bate (15 min)

O coração do produto. Se este bloco falhar, nada mais importa.

### 1.1 O vetor canônico

Abra `/calcular` **deslogado**. Digite:

Os rótulos abaixo são **exatamente** os que aparecem na tela (conferidos contra
`messages.pt-br.ts` e contra o app rodando — a primeira versão deste roteiro trazia nomes
inventados como "Gramas impressas", que não existem):

> **Re-baseline 2026-08-26 (fechamento do 018/T053).** A versão anterior desta seção pedia o campo
> **Desperdício** e prometia R$ 28,65 / 42,98 / 37,25 — números do modelo **3.1.0**. O campo morreu
> no 016/PR-D (pricing-core 4.0.0, ADR-0026) e o vetor abaixo é o do modelo **4.1.0**, derivado
> executando o próprio motor (`computeCalculator`) com estas entradas e conferido contra a UI real
> pelo e2e `calculator.spec.ts` ("SC-001 canonical vector"). Se um número daqui divergir da tela,
> o defeito é real — não é este roteiro que está velho.

| campo (rótulo na tela) | valor |
| --- | --- |
| Custo do rolo | `100` |
| Peso do rolo | `1` |
| **Gramas usadas** | `100` |
| Tempo de impressão | `5` h `0` min |
| **Consumo médio** | `0,10` |
| Tarifa de energia | `1` |
| Valor da máquina | `4000` |
| **Vida útil da máquina** | `2000` — toque **"Ajustar horas direto"** antes: o formulário nasce no modo ritmo (016/US8) e este campo só aparece no modo ajustar |
| Taxa de falha | `10` |
| Tempo de acabamento | `0,5` |
| **Valor do acabamento** | `10` |
| Markup varejo | `50` |
| Markup atacado | `30` |

> Alguns campos vêm **pré-preenchidos** com valores semente. Substitua o conteúdo — não digite por
> cima. Com os valores semente intactos a tela mostra R$ 16,16 / R$ 24,24 / R$ 21,01, que são
> números legítimos e **não** os deste exercício.

**Tem de aparecer, exatamente:**

- Custo total → **R$ 27,55**
- Preço varejo → **R$ 41,33**
- Preço atacado → **R$ 35,82**

☐ bate ☐ não bate → anote o que apareceu

### 1.2 O arredondamento não escorrega

Zere tudo e ponha só: custo do rolo `1`, peso `1`, gramas `10`, e **markup varejo 0 / atacado 0**.

Custo total → **R$ 0,01**. Varejo → **R$ 0,01**. (`0,005` arredonda para **cima** — ADR-0008.)

☐ bate ☐ não bate

### 1.3 Markup 0% não altera o custo

Com qualquer conjunto de valores, ponha os dois markups em `0`. **Varejo e atacado têm de ser
IGUAIS ao custo total** — markup zero não é desconto.

☐ bate ☐ não bate

### 1.4 O produto recusa em vez de adivinhar

No campo "Custo do rolo", digite `5x3`.

**Tem de recusar** com uma mensagem, e **não** calcular como se fosse `53`. Numa calculadora de
preço, adivinhar o número do vendedor é pior do que recusá-lo.

☐ recusou ☐ **calculou 53** → isto é grave, anote

---

## Bloco 2 — o que a auditoria consertou (25 min)

Cada item aqui é um defeito **medido** e corrigido. Você está conferindo o conserto.

### 2.1 `[F11a-002]` O preço não quebra no meio do número

Estreite a janela para **360px de largura** (DevTools → responsivo → 360). Digite valores que
produzam um preço de **seis dígitos** — por exemplo: custo do rolo `99999`, gramas `950`, markup
varejo `900`.

**O preço tem de aparecer numa única linha, inteiro.** Antes ele quebrava: `950.096` virava
`950.09` numa linha e `6` na outra.

☐ uma linha ☐ quebrado → anote

**Repita a 390px.** O conserto foi medido nas duas larguras, porque um piso errado consertava uma e
deixava a outra quebrada.

☐ 390 também OK

### 2.2 `[F11a-001]` O campo mostra o número inteiro

Ainda a **360px**, olhe o campo "Tarifa de energia" com um valor digitado.

**O valor tem de caber.** Antes o campo ficava com 33px úteis para 36px de conteúdo — mostrava a
cauda do número, não ele todo.

☐ cabe ☐ cortado

### 2.3 `[F11a-007]` A comissão não finge ser zero

Na seção Marketplace, deixe o canal em **Amazon** (é o padrão agora) e **não escolha categoria**.

**O campo "Comissão" tem de mostrar a alíquota que está sendo aplicada**, em cinza de placeholder
(sinal de "não digitado"). Antes mostrava `0,00` — ao lado de um preço que já tinha 15% descontados.

☐ mostra a alíquota ☐ mostra 0,00

Agora troque para **Shopee**. A comissão dela varia por faixa de preço, então **o campo tem de ficar
vazio** — não existe um número único a mostrar, e inventar um seria a mesma mentira.

☐ vazio na Shopee ☐ mostra um número → anote qual

### 2.4 `[F11a-006]` A primeira tela calcula

Recarregue `/calcular` limpo. O marketplace padrão é **Amazon**, e a seção "Preços por canal" tem de
mostrar preço.

Troque para **Mercado Livre**: ele **não tem tabela** e tem de dizer isso honestamente ("sem
referência — informe as taxas"), sem preço inventado.

☐ Amazon calcula ☐ ML diz que não sabe

### 2.5 `[F11a-003]` A promessa lidera

Em `/calcular`, **sem rolar a página**, procure a frase *"Calcular e ver a conta é grátis"*.

**Ela tem de estar visível na primeira tela.** Antes vivia a 97% da altura — 4,6 telas de rolagem.

☐ visível sem rolar ☐ tive de rolar

### 2.6 `[F03a-003]` O aviso avisa, não acusa

Ponha markup **varejo 50** e **atacado 200**.

Tem de aparecer um **aviso** dizendo que o atacado ficou acima do varejo — e o preço tem de ser
**calculado normalmente**. Nada pode ser recusado.

☐ avisou E calculou ☐ bloqueou → isto é o oposto do decidido, anote

Confira que o aviso **não parece um erro** (não é vermelho, não diz "corrija").

☐ tom de aviso ☐ parece erro

### 2.7 `[F11b-002]` e `[F11b-004]` — a cobrança (precisa de premium)

Vá em `/conta` com uma conta premium.

**Estado ativo**: "Gerenciar assinatura" e "Cancelar assinatura" são ambos discretos — está certo,
não há nada em risco.

Clique em **"Cancelar assinatura"**. No diálogo:

- **"Voltar" tem de ser o botão preenchido** (a saída segura)
- **"Cancelar assinatura" tem de ser vermelho SEM preenchimento**

☐ hierarquia certa ☐ invertida

> **O estado de carência** (`[F11b-002]`, onde "Atualizar forma de pagamento" agora é o botão roxo
> preenchido) **não dá para provocar sem o sandbox real do MP**. Fica para depois da T002 — anotado
> como não verificado, não como verificado.

---

## Bloco 3 — o que a auditoria NÃO consertou (10 min)

Estes você vai ver. **Não são regressões** — são achados registrados e não corrigidos. O bloco existe
para você não descobri-los sozinho achando que algo quebrou.

| o que você vai ver | achado | por quê ficou |
| --- | --- | --- |
| a 360px, a aba "Impressoras" do catálogo aparece como **"mpressoras"** | `[F11b-003]` | Médio, não bloqueia |
| sete gatilhos de ajuda (ⓘ) têm alvo de toque de **28×28px** (o mínimo é 44) | `[F11a-004]` | Médio |
| a 1440px a calculadora usa **37% da largura** e rola 3,8 telas | `[F11a-005]` | Baixo |
| no cartão de cenário, três ações só-ícone com **4px** entre "Duplicar" e "Excluir" | `[F11b-005]` | Médio |
| a barra do cenário reaberto mostra **21% do nome** | `[F11b-006]` | Baixo |
| a cortesia não oferece caminho de assinatura | `[F11b-007]` | Baixo |
| a 360px o painel fixo do kit come **45% da viewport** | `[F11b-008]` | Baixo |
| a 768px os **centavos** do preço caem para a linha de baixo | pré-existente | não é regressão do A6 |

☐ vi e reconheço ☐ vi algo diferente disso → anote

---

## Bloco 4 — o que só você pode julgar (20 min)

Aqui não há número certo. É julgamento de produto.

### 4.1 Passe pelo fluxo inteiro como se fosse um vendedor

Calcular → salvar produto → montar um kit → congelar no histórico → exportar PDF → salvar cenário.

Em cada tela, pergunte: **eu entenderia isto se não tivesse construído o produto?**

Anote qualquer frase que soe a jargão, qualquer número sem explicação, qualquer botão cuja função
você não adivinha em dois segundos.

### 4.2 O PDF exportado

Abra o PDF de verdade. Confira que **nenhuma coluna colide** com um nome de item longo — foi um
defeito real do E4, corrigido, e ele só aparece na imagem.

☐ colunas limpas ☐ colisão → anote com print

### 4.3 Offline

Com o app aberto, desligue a rede (DevTools → Network → Offline) e recarregue.

O app tem de **abrir e calcular**. Salvar tem de dizer honestamente que precisa de conexão.

☐ abre e calcula ☐ não abre

---

## Como anotar

Para cada ☐ que não bater:

1. **o que você fez** (a tela, os valores)
2. **o que apareceu** (o número, a frase, um print)
3. **o que você esperava**

O item 2 é o que mais falta quando um defeito é relatado, e é o único que não dá para reconstruir
depois.

---

## O que este roteiro assume, e pode estar errado

- Que o backend local e o emulador estão de pé. Um erro de rede pode parecer defeito de produto.
- Que a sua conta tem premium onde o roteiro pede.
- Que o catálogo de tarifas servido é o versionado (`backend/app/data/catalog.json`). Se você
  apontar para outro, os números de comissão mudam e o Bloco 2.3 fica sem sentido.

---

*Gerado da homologação pré-provisionamento (F01–F13, 31 achados). Os valores do Bloco 1 vêm dos
casos-ouro medidos em `docs/homologacao/evidencias/F03a-casos-ouro.json`; os do Bloco 2, das
medições que produziram cada achado.*
