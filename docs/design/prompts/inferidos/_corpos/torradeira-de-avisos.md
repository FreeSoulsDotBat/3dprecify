# Aviso efêmero (Toast) — onde aparece, quanto fica, quantos cabem

## O que desenhar
O aviso efêmero é a única forma que o Precifica3D tem de dizer "deu certo", "está pendente" ou "não deu"
depois de uma ação que o vendedor já disparou. Ele nasce de um salvamento (filamento, impressora, produto,
kit, orçamento, simulação), de um cancelamento de assinatura, de uma exportação e — o caso mais delicado —
de cada um dos quatro estados de sincronização do outbox offline. Vive fixado no rodapé em todas as telas do
app, montado uma única vez no shell (`app/providers.tsx`), acima do conteúdo mas abaixo das folhas/diálogos.
Desenhe a peça: o cartão em cada tom, a região que os empilha, a âncora em cada viewport, a entrada, a saída
e o que acontece quando chegam vários de uma vez.

## Por que este prompt existe
Nada disso foi desenhado. O DS antigo tem UMA linha de prosa sobre ele ("Toast — feedback efêmero
(sucesso/erro/info), radius md, sombra sm"); nenhuma das 6 telas do ui_kit dispara um, o canvas do 018 não o
desenha, e as três rodadas de auditoria não o citam. Posição, duração (5000 ms), profundidade da pilha (sem
limite) e a total ausência de animação foram decididas dentro do CSS. E o código contraria duas regras já
escritas neste projeto: `toast.css:15` corta em **768px**, enquanto o app inteiro passou a cortar em **1280px**
(018/ADR-0031) — é o único corte de largura em todo o `shared/ui`; e o toaster ignora `--pinned-bottom`, a
variável que o shell criou justamente para que nada pinado se sente em cima da barra de abas (014/T118).

## O que já existe hoje (não invente do zero — corrija)
A região (`.tf-toaster`): fixa, `z-index: 60`, coluna, gap de 8px, largura `min(92vw, 30rem)` → 480px de teto,
358px em 390px de tela.

| Aspecto | Como está hoje | Leitura |
| --- | --- | --- |
| Âncora < 768px | rodapé, centralizado, `bottom: 64px (barra de abas) + 12px` | → **não soma `env(safe-area-inset-bottom)`**; num aparelho com indicador de home o aviso desce para dentro da barra |
| Âncora ≥ 768px | canto inferior direito, `bottom: 24px`, `right: 24px` | → entre **768px e 1279px** o layout ainda é o MÓVEL (a barra de abas continua na tela) e o aviso já pulou para 24px do chão — ou seja, **sobre a barra de abas**, numa faixa de 512px de largura |
| Duração | 5000 ms para todos os tons, inclusive erro | → o mesmo tempo para "Kit salvo." (11 caracteres) e para "Não foi possível guardar o registro neste aparelho. Ele não foi salvo." (69) |
| Pausa | nenhuma: não pausa no hover, não reinicia no foco | → um erro lido pela metade não volta |
| Fila | ilimitada, novos **acrescentados ao fim** | → no celular o mais NOVO nasce colado na barra de abas e empurra os antigos para cima; cinco avisos cobrem ~312px da tela e cada cartão captura toque |
| Animação | **nenhuma** de entrada ou de saída | → o aviso aparece e some por corte seco; não há `prefers-reduced-motion` a respeitar porque não há movimento |
| Distinção de tom | só a cor do ícone de 18px muda (`info` / `success` / `danger`); fundo, borda e sombra são idênticos | → um erro e um sucesso são o mesmo retângulo com um ponto colorido |
| Camada | toast `z-index: 60`, overlay de diálogo `70`, conteúdo do diálogo `71` | → um aviso disparado com a folha ainda aberta fica **atrás do overlay**: invisível |
| Fechar | botão de 44×44 com margem negativa (−8px vertical, −4px horizontal), rótulo `aria-label="Fechar"` | o alvo cumpre 44px, mas a margem negativa o encosta na borda do cartão |
| Região | `role="region"`, `aria-label="Notificações"`, `aria-live="polite"`; o cartão de erro usa `role="alert"` dentro dessa região polida | → erro urgente dentro de região educada é uma contradição de anúncio |

Registro que reforça tudo isso: na homologação visual do E6/PR-B um toast **nunca renderizou** — a folha
desmontava antes do retorno da mutação, e a frase ficou no pacote afirmando um reconhecimento que não houve.

## Conteúdo e dados reais
Um aviso é sempre: ícone (18px) + uma frase pt-BR + botão fechar. Sem título, sem ação, sem link — não existe
"Desfazer" em lugar nenhum. Frases literais, homologadas, que o desenho deve usar como estão:

- Sucesso (curtas): `"Filamento salvo."` · `"Impressora salva."` · `"Produto salvo."` · `"Kit salvo."` ·
  `"Simulação salva."` · `"Simulação atualizada."` · `"Simulação duplicada."` · `"Simulação renomeada."` ·
  `"Simulação excluída."` · `"Rótulo atualizado."` · `"Registro excluído."` · `"Registro salvo em Orçamentos."`
- Sucesso longa (assinatura): `"Assinatura cancelada. Premium ativo até {data}."` → com data real:
  "Assinatura cancelada. Premium ativo até 14/09/2026."
- Info / sincronização (as três mais longas, e as que mais importam):
  `"Pendente neste dispositivo. Sincroniza sozinho quando houver conexão."` ·
  `"Envio pausado — o Premium não está ativo. O registro continua neste aparelho."` ·
  `"Envio pausado — sua sessão expirou. O registro continua neste aparelho."`
- Erro: `"Não foi possível guardar o registro neste aparelho. Ele não foi salvo."` ·
  `"Não foi possível registrar. O servidor não aceitou este registro."` ·
  `"Não foi possível gerar o arquivo."` · `"Não foi possível excluir o registro."` ·
  `"Não foi possível atualizar o rótulo."` · `"Exportar precisa do Premium ativo."`

Tons existentes: `neutral`, `info`, `success`, `danger` — quatro, e hoje `neutral` e `info` são visualmente
idênticos. Nenhuma chamada do app passa duração própria: os 5000 ms valem para todos. O código aceita
`duration <= 0` (fica até fechar), e **nenhuma tela usa isso hoje** — é a porta pronta para o erro que precisa
esperar leitura.

## Estados obrigatórios
- **Repouso — sucesso**: `"Kit salvo."`, ícone de conferido; frase curta, cartão de uma linha.
- **Repouso — info**: `"Pendente neste dispositivo. Sincroniza sozinho quando houver conexão."` — mostre em
  390px, onde quebra em 2–3 linhas; o cartão cresce, não corta.
- **Repouso — erro**: `"Não foi possível guardar o registro neste aparelho. Ele não foi salvo."` — precisa ser
  reconhecível como erro **antes** de ler a frase.
- **Repouso — neutro**: decida se sobrevive como tom distinto ou some (ver perguntas ao dono).
- **Entrando**: hoje não existe; desenhe o quadro de entrada (de onde vem, quanto dura).
- **Saindo / expirando**: desenhe o fim, e desenhe se o tempo restante é visível ou invisível.
- **Foco no botão fechar**: anel de foco visível sobre o fundo elevado do cartão, não sobre o fundo da página.
- **Hover no botão fechar**: hoje o ícone passa de esmaecido a forte — mantenha e mostre.
- **Pilha de 2 e de 5**: o mesmo desenho com dois e com cinco avisos; mostre o que acontece com o excedente.
- **Sobre folha/diálogo aberto**: o estado que hoje é invisível — desenhe onde o aviso fica quando há uma
  folha por cima.
- **Aviso persistente (sem contagem)**: o cartão sem prazo, esperando o toque em Fechar.

## Viewports
- **390px** — obrigatório: é onde a peça é mais crítica, mora sobre a barra de abas de 64px (mais a área
  segura do aparelho) e onde a frase de 77 caracteres precisa caber.
- **1024px** — obrigatório, e é o quadro que hoje está errado: layout ainda móvel (barra de abas presente),
  aviso já no canto direito a 24px do chão. Desenhe a resposta certa para esta faixa.
- **1280px** — o corte real do app: a barra de abas dá lugar ao rail lateral; o canto inferior direito fica
  livre. Mostre a âncora final e a relação com o rail recolhido (76px) e expandido (240px).
- 1920px não precisa de prancheta própria se a âncora for a mesma de 1280px — diga se for.

## Regras que o desenho não pode quebrar
- **O aviso nunca afirma o que não aconteceu.** Todo sucesso aqui só dispara em resposta real do servidor; o
  desenho não pode sugerir confirmação onde o vocabulário diz "pendente" ou "pausado".
- **Falha de rede nunca é vendida como falta de Premium, e vice-versa.** Os três "Envio pausado" e o
  "Não foi possível registrar" são causas diferentes e precisam ser legíveis como diferentes.
- **A frase honesta é o corpo do aviso** — nunca reticências, nunca truncamento, nunca uma versão curta
  "de caber". Se não cabe, o cartão cresce.
- **Não pode cobrir a barra de abas nem a área segura do aparelho**: a folga do rodapé é a mesma que o shell
  já declara para tudo que é pinado (barra de abas + respiro + área segura), não um número novo.
- **Alvo de toque ≥ 44px** no botão fechar, sem que a margem negativa o faça sangrar para fora do cartão.
- **Contraste medido contra o fundo elevado do cartão**, nos dois temas — inclusive o ícone colorido de cada
  tom, que é hoje o único portador de significado.
- **Erro precisa de tempo de leitura maior que sucesso** (ou de nenhum tempo). 5 segundos para 69 caracteres
  é uma decisão de código, não de desenho.

## Armadilhas já pagas neste projeto
- **A barra de abas engoliu um elemento pinado antes** (014/T118: o total do kit parou a 8px do chão, 56px
  DENTRO da barra, e o vendedor leu o total com os dígitos cortados). O toaster repete o padrão pela metade:
  soma a barra, esquece a área segura.
- **Um toast que nunca renderizou** (E6/PR-B): 0 inserções em 8 segundos de observação. Um aviso disparado no
  fim de um fluxo que fecha a folha pode nascer atrás do overlay ou não nascer.
- **`toBeVisible` passa em elemento ocluso** — occlusão não é propriedade de texto. Este cartão é ocluído por
  duas coisas reais: a barra de abas e o overlay de diálogo. Desenhe as camadas explicitamente.
- **Estouro horizontal medido**: 92vw em 390px = 358,8px, menos 44px de botão e 18px de ícone e os espaçamentos
  → sobram ~270px para a frase. Desenhe com a frase de 77 caracteres, não com "Kit salvo.".
- **Headless não vê barra de rolagem clássica** (016/PR-B): a pilha crescendo não pode virar uma coluna que
  rola; ela precisa de um teto desenhado.

## Entregável
Pranchetas, tema escuro primeiro e claro como primeira classe (as duas, não uma variação de nota de rodapé):
1. **Anatomia do cartão** — ícone, frase, botão fechar, medidas e folgas, com os quatro tons lado a lado.
2. **Os quatro tons com as frases reais** (a curta, a longa de sincronização, a de erro, a de assinatura com
   data), cada uma em 390px.
3. **Âncora em 390px** — com a barra de abas de 64px desenhada abaixo, mostrando a folga real.
4. **Âncora em 1024px** — a faixa hoje quebrada, com a resposta proposta.
5. **Âncora em 1280px** — com o rail lateral expandido e recolhido.
6. **Pilha** — 2 avisos e 5 avisos, com a decisão de ordem (novo em cima ou embaixo) e de teto de fila.
7. **Movimento** — quadros de entrada e saída, e a versão para movimento reduzido.
8. **Aviso sobre folha aberta** — a resolução de camada.

Reutilize os primitivos `tf-*` em vez de criar novos: o cartão é `tf-toast` (fundo elevado, radius md, sombra
md, borda sutil — os mesmos tokens de superfície do `tf-card`); o ícone vem do conjunto `Icon` já existente
(`info`, `circle-check`, `circle-alert`, `x`); o botão fechar é a variante ícone-apenas do `tf-button`, não um
botão novo; o anel de foco é o `--ring` do DS. Se um tom precisar de fundo ou borda própria, derive dos tokens
`info` / `success` / `danger` existentes; não introduza cor nova.

## Perguntas em aberto para o dono
1. **Duração por tom**: sucesso curto pode sair em 3–4s, mas erro deve ficar até o vendedor fechar? O código
   já suporta "sem prazo" e ninguém usou.
2. **Ordem da pilha**: o aviso mais novo deve nascer perto do polegar (embaixo, como hoje) ou no topo da pilha?
   Hoje o mais recente é o mais próximo da barra de abas.
3. **Teto de fila**: quantos avisos simultâneos no máximo, e o que acontece com o excedente — descarta o mais
   antigo, ou agrupa ("+2 avisos")?
4. **Tom `neutral`**: ele deve continuar existindo como tom próprio ou colapsa em `info`? Hoje são visualmente
   idênticos e nenhuma tela pede um neutro deliberadamente.
5. **Aviso disparado com folha aberta**: ele deve aparecer POR CIMA da folha, ou esperar a folha fechar? A
   escolha muda a camada e a animação.
6. **Progresso visível**: o aviso mostra quanto tempo falta (uma linha que encolhe) ou some sem avisar?
