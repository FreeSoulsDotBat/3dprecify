# Região de toasts — onde a confirmação do app aparece, empilha e some

## O que desenhar

A faixa flutuante que carrega TODA confirmação efêmera do Precifica3D: "Filamento salvo.", "Simulação
duplicada.", "Não foi possível gerar o arquivo.", "Pendente neste dispositivo. Sincroniza sozinho quando
houver conexão." Ela é montada uma única vez no shell do app (`apps/web/src/app/providers.tsx`) e paira
sobre qualquer tela — calculadora, Catálogo, Kits, Orçamentos, Conta. Quem a usa é o vendedor logo depois
de tocar em "Salvar", "Duplicar", "Excluir", "Exportar" ou "Registrar": é por ela que ele descobre se a
ação encostou no servidor de verdade, ficou só no aparelho, ou falhou. Desenhe a REGIÃO (posição,
empilhamento, entrada/saída, convivência com a barra de abas e com os diálogos), não só o cartãozinho.

## Por que este prompt existe

Existe autoridade de desenho sobre a PEÇA e nenhuma sobre a REGIÃO. O protótipo de 2026-07-02 (§D.2)
define "**Toast** — feedback efêmero (sucesso/erro/info), radius md, sombra sm", e o CSS honra isso. Mas
nenhuma prancha do inventário §E mostra a região: não há posição, empilhamento, duração, limite, nem
convivência com a BottomBar; a matriz §G não tem linha de toast; as duas rodadas de correção não citam a
palavra; o canvas do 018 não tem nenhuma ocorrência de "toast". O tom "neutral", os 5000ms de
auto-dispensa e o `z-index: 60` **não vêm de lugar nenhum** — foram escolhidos por uma IA a partir de
requisito textual. É a mesma classe do defeito E6/T028, em que um toast prometido nunca apareceu e não
havia desenho contra o qual comparar.

## O que já existe hoje (não invente do zero — corrija)

Origem: `apps/web/src/shared/ui/toast.tsx` + `toast.css`.

Anatomia do cartão (esta parte tem desenho, mantenha): ícone 18px à esquerda · mensagem em uma ou mais
linhas · botão de fechar 44×44px com `aria-label` **"Fechar"**. Fundo `surface-raised`, borda sutil,
`radius-md`, `shadow-md`. Só o ÍCONE muda de cor por tom — o texto é sempre `text-strong`.

| Comportamento atual | Valor real no código | Leitura |
| --- | --- | --- |
| Posição < 768px | centrado, `bottom = altura da barra de abas (64px) + 12px`, largura `min(92vw, 30rem)` | → a barra de abas só existe até **425px**; entre 426px e 767px o toast flutua 76px do chão sem nada embaixo |
| Posição ≥ 768px | canto inferior direito, 24px das bordas | o corte de desktop do 018 é 1280px — a região troca de canto num limiar que não é o do layout |
| Área segura (iPhone) | a barra de abas soma `safe-area-inset-bottom`; **o toast não** | → num aparelho com barra de gestos o toast invade ~22px da navegação |
| Empilhamento | ilimitado, novo entra por BAIXO (`[...toasts, novo]`), coluna com 8px de gap | → três toasts de duas linhas ocupam ~200px sobre a navegação; ninguém desenhou o limite |
| Duração | 5000ms por item, contados individualmente | → uma frase de 96 caracteres ("Não foi possível guardar o registro neste aparelho. Ele não foi salvo.") tem os mesmos 5s de "Kit salvo." |
| Camadas | toast `z-index: 60`; overlay de diálogo/sheet **70**, diálogo **71** | → **um toast disparado com uma folha aberta nasce ATRÁS do véu** — invisível. A ficha dizia "60 contra 40"; o valor real é 70/71 |
| Entrada e saída | nenhuma. Sem `transition`, sem `keyframes`, sem `prefers-reduced-motion` | → aparece e some no talo; num empilhamento, os de baixo pulam ao expirar o de cima |
| Tom `neutral` | é o padrão do código e **nenhuma chamada do app o usa** | → tom fantasma; ou ganha papel no desenho ou o desenho declara 3 tons |
| Leitura assistiva | região `role="region" aria-label="Notificações" aria-live="polite"`; tom `danger` vira `role="alert"` | mantido |

## Conteúdo e dados reais

Toda a copy abaixo já está homologada — cite-a EXATA nas pranchetas, não reescreva:

- **success** — "Filamento salvo." · "Impressora salva." · "Produto salvo." · "Kit salvo." ·
  "Registro salvo em Orçamentos." · "Simulação salva." · "Simulação atualizada." ·
  "Simulação duplicada." · "Simulação renomeada." · "Simulação excluída." · "Registro excluído." ·
  "Rótulo atualizado." · "Assinatura cancelada. Premium ativo até 12/09/2026."
- **info** (as frases honestas de sincronização, ADR-0018) — "Pendente neste dispositivo. Sincroniza
  sozinho quando houver conexão." · "Envio pausado — o Premium não está ativo. O registro continua neste
  aparelho." · "Envio pausado — sua sessão expirou. O registro continua neste aparelho."
- **danger** — "Não foi possível guardar o registro neste aparelho. Ele não foi salvo." ·
  "Não foi possível registrar. O servidor não aceitou este registro." · "Não foi possível gerar o
  arquivo." · "Exportar precisa do Premium ativo." · "Não foi possível excluir o registro." ·
  "Não foi possível atualizar o rótulo."

Medidas para desenhar com número de verdade: mensagem mais curta = 11 caracteres ("Kit salvo."); mais
longa = 96 caracteres, que a 480px de largura ocupa **duas linhas** e a 358px (92vw de um 390px) ocupa
**três**. Desenhe com a de três linhas, não com a curta. Nenhum toast carrega dinheiro hoje, mas se o
desenho abrir espaço para valor, use o formato do app: R$ 1.234,56.

## Estados obrigatórios

1. **Repouso, um toast** — tom `success`, ícone `circle-check` verde, "Kit salvo.", botão fechar visível.
2. **Repouso, mensagem longa** — tom `danger`, ícone `circle-alert`, a frase de 96 caracteres em 3 linhas
   a 390px; mostre onde o botão de fechar se ancora (topo? centro?) quando o texto cresce.
3. **Empilhado, 2 e 3 itens** — misture tons (info + danger) e mostre a ordem: o mais novo entra embaixo
   hoje. Diga se isso deve mudar.
4. **Empilhado além do limite** — o desenho precisa DECIDIR o teto (ex.: 3 visíveis) e o que acontece com
   o quarto: descarta o mais antigo, agrupa, ou empilha atrás? Hoje não há teto.
5. **Foco no botão fechar** — anel de foco do DS, contraste medido contra `surface-raised`, não contra o
   fundo da página.
6. **Hover / pressionado do fechar** — hoje só muda de `text-muted` para `text-strong`; sem pressionado.
7. **Entrada e saída** — desenhe os dois quadros (de onde vem, para onde vai) e a variante de
   movimento reduzido, que hoje não existe.
8. **Sobre a barra de abas (≤425px)** — a folga real entre o cartão e a navegação, com área segura.
9. **Com folha/diálogo aberto** — o estado que hoje é um defeito: mostre onde o toast deve aparecer
   quando há um véu na tela.
10. **Offline / Premium pausado** — não são estados VISUAIS próprios: viram tom `info` com as frases
    acima. O desenho deve deixar claro que falha de rede e sessão expirada **não** usam vermelho de erro
    de servidor, porque o registro não se perdeu.

## Viewports

- **390px** — obrigatória. É onde a região colide com a barra de abas e onde a frase longa vira 3 linhas.
- **425px** — obrigatória, é o último pixel com barra de abas.
- **768px** — obrigatória: é o limiar em que a região salta para o canto direito hoje, sem que nada no
  layout mude junto.
- **1280px** — obrigatória, é o corte real de desktop do 018 (menu lateral, sem barra de abas).
- 1920px opcional, só se a ancoragem à direita precisar de outra distância da borda.

## Regras que o desenho não pode quebrar

- **Nunca vender falha de rede como falta de Premium, nem o contrário.** As três frases de "Envio pausado"
  distinguem premium inativo de sessão expirada; o desenho não pode uniformizá-las num só ícone genérico.
- **Sucesso só depois do 2xx real.** Todo toast verde deste app é disparado com resposta confirmada do
  servidor; nada de confirmação otimista. O desenho não deve sugerir um estado "salvando…" dentro do toast.
- **A frase honesta nunca cabe cortada.** A região tem 480px no máximo; o texto quebra em linhas, jamais
  em reticências. (Lição do 016: frase honesta nunca vive em placeholder nem em elemento estreito.)
- **Alvo de toque ≥44px** para o fechar, sem que ele coma a margem do texto.
- **Contraste medido contra `surface-raised`**, que é mais claro que o fundo da página no tema escuro.
- Ícone é reforço, não portador: a mensagem sozinha precisa dizer o que houve.

## Armadilhas já pagas neste projeto

- **E6/T028**: um toast prometido no código NUNCA renderizou — o diálogo desmontava antes do callback.
  O desenho é o que permite dizer "isto deveria estar aqui"; por isso a prancha com folha aberta é a mais
  importante da lista.
- **016/T118**: uma barra fixa parou 56px DENTRO da barra de abas porque `padding-bottom` não alcança
  quem é `fixed`/`sticky`. A região de toasts tem exatamente essa forma e hoje ignora a área segura.
- **016/PR-B**: o headless não vê barra de rolagem clássica — meça overflow nos DOIS eixos. A 390px,
  `92vw` + sombra precisa caber sem empurrar a página na horizontal.
- **014**: `toBeVisible` passa em elemento totalmente ocluso. Um toast atrás do véu de um diálogo passa em
  todo teste de texto e é invisível para o vendedor.

## Entregável

Pranchetas em tema **escuro (padrão)** e **claro (first-class)**:

1. `Região · 390px` — mapa da tela inteira com barra de abas, área segura, um toast, cotas em px.
2. `Região · 390px empilhado` — 3 toasts (info + danger + success), com o teto proposto explícito.
3. `Região · 768px` e `Região · 1280px` — ancoragem no canto, distância das bordas, largura máxima.
4. `Cartão · anatomia` — os 4 tons lado a lado (ou 3, se `neutral` cair), com as frases reais.
5. `Cartão · texto longo` — a frase de 96 caracteres em 3 linhas, com o fechar posicionado.
6. `Estados do fechar` — repouso, hover, foco, pressionado.
7. `Movimento` — quadros de entrada/saída + a variante de movimento reduzido.
8. `Convivência` — toast com folha/diálogo aberto e toast sobre a barra de abas.

Reutilize os primitivos existentes, sem criar novos: o cartão é `tf-toast` sobre `surface-raised` com
`radius-md`/`shadow-md`; os ícones são `info`, `circle-check`, `circle-alert` e `x` do `Icon` do DS; o
fechar herda o anel de foco do DS; as cores de tom são `info-text`, `success-text`, `danger-text`. A
região `tf-toaster` é só posicionamento — não desenhe caixa, fundo nem borda para ela.

## Perguntas em aberto para o dono

1. **Quantos toasts podem coexistir?** Hoje é ilimitado. Teto de 3 com descarte do mais antigo, ou
   agrupar ("+2 mensagens")?
2. **Qual o limiar de posição?** A região troca de canto a 768px, mas o layout de desktop só começa a
   1280px e a barra de abas some a 425px. Um único limiar (425px ou 1280px) ou os três continuam?
3. **O tom `neutral` deve existir?** Nenhuma chamada do app o usa; ou ele ganha um papel (aviso sem
   cor) ou o desenho fixa três tons e o código perde o quarto.
4. **Erro deve auto-dispensar?** Os 5000ms valem hoje para "Kit salvo." e para "Não foi possível guardar
   o registro neste aparelho. Ele não foi salvo." igualmente — a segunda pede ação e some sozinha.
5. **Toast disparado com folha aberta**: deve aparecer POR CIMA do véu, ou a folha deve exibir a mensagem
   internamente e o toast só surgir depois que ela fechar?
