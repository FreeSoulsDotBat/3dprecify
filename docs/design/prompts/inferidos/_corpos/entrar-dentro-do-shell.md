# Entrar — a porta de entrada e a moldura em volta dela

## O que desenhar
A tela **Entrar** do Precifica3D (rota `/sign-in`) e, principalmente, **a moldura em que ela aparece**. É a primeira tela que o vendedor vê quando tenta abrir Catálogo, Kits, Orçamentos ou Conta sem estar conectado: o app o desvia para cá, ele entra com o Google e é devolvido exatamente para onde queria ir. Calcular é público, então ninguém é obrigado a passar por aqui para precificar — quem chega aqui está tentando salvar, consultar ou gerenciar algo seu. Hoje a tela é um cartão de 384px centrado; o que precisa de desenho é a tela inteira, incluindo o que aparece **atrás e acima** dela: a barra superior e o menu do app.

## Por que este prompt existe
O protótipo de 2026-07-02 desenhou o login como tela **fullscreen** — a especificação diz literalmente "Login/logout fullscreen (Login E2 ↔ shell)", e o `LoginScreen.jsx` do ui-kit confirma pela forma: é a **única** das 6 telas do kit que não monta barra superior nem menu. O código faz o oposto: a rota de login é filha da mesma árvore de `/calcular`, então ela renderiza **dentro** do shell — menu do app montado atrás, barra superior presente. Isso é uma **contradição explícita com o desenho existente**, e ninguém desenhou o que ficou no lugar. Pior: como a barra superior esconde o logo nessa rota (para não duplicar o do cartão), sobra um **buraco onde a marca deveria estar**. E a versão desktop nunca existiu em desenho nenhum.

## O que já existe hoje (não invente do zero — corrija)

**A moldura (o shell), presente em todas as viewports:**

| Elemento | Estado em `/sign-in` hoje | |
|---|---|---|
| Barra superior (56px) | Logo **suprimido**, trocado por um espaçador vazio | → um vazio no canto esquerdo, é o achado principal |
| Identidade + botão "Sair" | Não renderiza (ninguém está conectado) | correto |
| Alternar tema (ícone sol/lua, 20px) | Único elemento visível da barra | → uma barra de 56px inteira para um ícone |
| Menu (abas em ≤425px, barra lateral acima disso) | Montado e clicável, com **Calcular · Catálogo · Kits · Orçamentos · Conta** | → 4 dos 5 itens devolvem o usuário para esta mesma tela |
| Faixa de offline / sessão expirada | Podem aparecer acima de tudo | mantêm-se |

**O conteúdo (o cartão), de cima para baixo:** logo horizontal completo → cartão com padding grande contendo o título **"Entrar"**, a legenda **"Entre para acessar seu catálogo, orçamentos e conta."**, o botão primário grande **"Entrar com Google"** e, quando houver, um aviso → abaixo do cartão, solto, o link sublinhado **"Como tratamos seus dados"**.

→ O cartão tem 384px de largura máxima. No desktop ≥1280px ele flutua sozinho numa área útil de até **1720px**, ao lado de uma barra lateral de 240px. É a mesma classe de desperdício que a homologação do 016 mediu como "~37/39% de aproveitamento".

→ O botão "Entrar com Google" hoje é **primário sólido, sem o G colorido**. O protótipo desenhou um botão de superfície com borda e o G de 4 cores — a convenção que o vendedor reconhece.

→ A proposta de valor sumiu. O protótipo abria com **"Forje o preço certo"** e **"Precifique suas impressões 3D com a conta transparente — do material à margem."**; o código entrega "Entrar" e uma frase administrativa.

## Conteúdo e dados reais
Textos literais que já estão no produto (não reescreva sem dizer que está reescrevendo):
- Título: **"Entrar"** · Legenda: **"Entre para acessar seu catálogo, orçamentos e conta."**
- Botão: **"Entrar com Google"** (no protótipo, o rótulo em carregamento era **"Entrando…"**)
- Erro genérico: **"Não foi possível entrar. Tente novamente."**
- Offline: **"Você está offline. O login precisa de internet — o cálculo continua funcionando."**
- Ambiente sem login: **"Login indisponível: Firebase não configurado neste ambiente."**
- Rodapé (link real, leva a uma página pública): **"Como tratamos seus dados"** — medido em 181×20px, com altura mínima de 24px forçada por acessibilidade (é um link solto, não dentro de frase).
- Frase estática do protótipo, que **não** virou link: "Ao continuar você concorda com os Termos e a Política de Privacidade. Os cálculos funcionam offline."
- Legenda do protótipo abaixo do botão: "Login por Google. Mais opções em breve."
- Barra superior: rótulo do controle de tema **"Alternar tema"**; nomes do menu **Calcular · Catálogo · Kits · Orçamentos · Conta**.
- Enquanto o app confere a sessão, existe a frase **"Verificando sessão…"**.

Não há campos de formulário: **um único botão**, sem e-mail, sem senha, sem "criar conta". Nenhum número, nenhum dinheiro nesta tela.

## Estados obrigatórios
1. **Repouso** — botão pronto, nenhum aviso. É o estado que 95% das visitas vê.
2. **Foco por teclado** — anel visível no botão e no link do rodapé, medido contra o fundo real do cartão (o projeto já corrigiu um medidor de foco que errava).
3. **Hover / pressionado** no botão e no link.
4. **Enviando** — botão em carregamento, não clicável, com indicação de progresso; a janela do Google abre por cima. Diga o que o vendedor lê aqui ("Entrando…" ou o rótulo mantido — decida no desenho e mostre).
5. **Erro** — aviso de tom perigo com "Não foi possível entrar. Tente novamente.", abaixo do botão, dentro do cartão; o botão volta a ficar clicável.
6. **Offline** — aviso de tom informativo com a frase completa sobre o cálculo continuar funcionando. **Nunca** vender falha de rede como "sem permissão" ou "premium".
7. **Login indisponível no ambiente** — botão **desabilitado** + aviso informativo. É o único estado em que o botão nasce morto; precisa parecer morto e explicado, não quebrado.
8. **Verificando sessão** — o instante antes de decidir se mostra a tela ou devolve o usuário ao destino.
9. **Faixa de offline global** e **faixa de sessão expirada** podem aparecer acima da barra superior: desenhe pelo menos uma composição com a faixa presente, para provar que a tela não é empurrada para fora.

## Viewports
- **Mobile 390px** — obrigatória: é onde o vendedor realmente entra. Barra de abas embaixo, barra superior em cima, cartão no meio.
- **Desktop 1280px** — obrigatória: é o corte em que a área útil abre e o cartão de 384px começa a boiar.
- **Desktop 1920px** — obrigatória: é o caso extremo (área útil de até 1720px) e é onde o desperdício foi medido.
- Verifique também a faixa **426–599px**, onde o menu lateral aparece já recolhido em rail de 76px: é a largura em que a moldura mais aperta o conteúdo.

## Regras que o desenho não pode quebrar
- **A marca não pode ser um buraco.** Se o logo sai da barra superior nesta rota, o que fica no lugar precisa ser uma decisão visível, não um espaçador vazio.
- **Nada de laço.** Se o menu continuar visível, os itens que exigem login não podem parecer disponíveis e devolver o usuário para esta mesma tela sem explicação.
- **Honestidade de rede.** Offline é offline: a frase inteira, em elemento de largura cheia — **nunca dentro de um campo/placeholder** (o projeto já perdeu uma frase honesta cortada por isso).
- **Alvo de toque:** botão principal grande (≥56px de altura no mobile); link do rodapé com ≥24px de altura real e área de clique coerente.
- **Contraste medido contra o fundo real** — inclusive o do aviso sobre o cartão, e inclusive no tema claro.
- **Zero rolagem horizontal** em 390px e em 1920px, medida nos dois eixos.
- Se você propuser uma tela sem moldura (fullscreen, como o protótipo), **desenhe também a transição**: o que o vendedor vê no instante seguinte ao login, quando o shell aparece.

## Armadilhas já pagas neste projeto
- **Aproveitamento medido**: telas com conteúdo estreito num campo largo foram reprovadas em homologação com "~37/39% de aproveitamento". Um cartão de 384px em 1920px cai nessa categoria.
- **Transbordo horizontal invisível em teste**: um elemento pode passar em todos os testes de texto e ainda estar fora da tela. Mostre as caixas.
- **Frase honesta cortada**: mensagens de honestidade em elementos estreitos ficam com reticências. O aviso de offline é a frase mais longa desta tela — desenhe-a com o texto inteiro.
- **Barra lateral que come o conteúdo**: abaixo de 600px, 240px de menu deixaram ~150px de página e mediram 131px de transbordo. A moldura desta tela sofre do mesmo.
- **Logo duplicado**: a barra superior esconde a marca justamente porque o cartão já mostra uma. Resolva o par, não um lado só.

## Entregável
Pranchetas, **tema escuro como padrão e tema claro como igual** (não como variação secundária):
1. `Entrar · 390px · repouso` — moldura completa (barra superior + abas) e cartão.
2. `Entrar · 390px · estados` — enviando, erro, offline, login indisponível, foco por teclado.
3. `Entrar · 1280px · repouso` — sua proposta de composição desktop (moldura ou fullscreen).
4. `Entrar · 1920px · repouso` — a mesma proposta no campo largo, provando o aproveitamento.
5. `Entrar · barra superior em detalhe` — o que ocupa o lugar da marca nesta rota, nos dois temas.
6. `Entrar · 1280px · tema claro`.

Reutilize os primitivos existentes: **Card** (padding grande) para o bloco central, **Button** primário tamanho grande para "Entrar com Google", **Alert** (tom informativo para offline e ambiente sem login; tom perigo para erro), **Logo** (lockup completo), **Icon** para o G do Google e para o controle de tema, e os componentes de barra superior e navegação já existentes. **Não crie primitivo novo**; se a composição pedir um (por exemplo, um painel de marca lateral no desktop), diga explicitamente que é novo e por quê.

## Perguntas em aberto para o dono
1. **Login dentro ou fora do shell?** O protótipo disse fullscreen, o código entrega emoldurado. É a decisão que muda tudo nesta tela — e ela também define como fica o "sair" (a volta pelo mesmo caminho).
2. **Se ficar emoldurado**, o menu continua clicável nos itens que exigem login, ou eles aparecem marcados como "precisa entrar"?
3. **A proposta de valor volta?** "Forje o preço certo" + "Precifique suas impressões 3D com a conta transparente — do material à margem." estavam desenhadas e não foram implementadas.
4. **O rodapé legal**: fica só o link "Como tratamos seus dados", ou volta a frase do protótipo sobre Termos e Política de Privacidade? Hoje **não existe página de Termos** — se a frase voltar, ela precisa de destino ou precisa ser reescrita.
5. **O controle de tema aparece na tela de entrada?** É o único controle da barra superior nesta rota; mantê-lo é uma escolha, não uma consequência.
6. **"Login por Google. Mais opções em breve."** — a promessa do protótipo continua de pé? Se não houver outra opção planejada, ela não deve ser desenhada.
