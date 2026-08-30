# Botão: carregando, desabilitado e com brilho

## O que desenhar

O primitivo de ação do produto (`tf-btn`) nos três estados que nunca foram desenhados: **ocupado** (esperando a rede), **bloqueado** (o vendedor não pode agir agora) e **focal** (o halo roxo do CTA principal). Não é uma tela: é a matriz de estados de uma peça que aparece em toda a jornada — o "Entrar com Google" da primeira abertura, o "Salvar" do catálogo, o "Gerar PDF" da exportação, o "Assinar Premium" dos teasers, o "Sincronizar agora" da fila offline. Hoje há **25 botões em carregamento** no app e **mais de 20 botões desabilitados**, e o desenho de nenhum deles existe. Quem usa é o vendedor de peças 3D, quase sempre no celular, em geral com a conexão ruim que é exatamente a condição que faz esses estados aparecerem.

## Por que este prompt existe

A auditoria classifica esta peça como `PROTOTIPO_PARCIAL`: o protótipo de 2026-07-02 desenhou **um** botão em carregamento — o de login. Ali o giro **substituía** o ícone do Google no mesmo lugar (`{loading ? <Spinner/> : GoogleG}`), o rótulo trocava para "Entrando…", e o botão ficava desabilitado. Largura estável, causa dita. **O app implementado diverge desse único desenho**: o giro é **inserido antes** de um rótulo que não muda, então o botão **cresce enquanto o vendedor olha**. E continuam sem qualquer desenho: o **desabilitado** (o canvas põe `disabled` em dois botões mas nenhuma folha de estilo pinta o resultado), o **brilho** fora do CTA hero, e o **slot de ícone** (`iconLeft`/`full` aparecem em 4 telas do kit e não existem no componente real — um ícone passado como filho cai dentro do rótulo). A §D.2 do protótipo não descreve carregando nem desabilitado; o item 8 da auditoria já registrava "loading skeletons" como lacuna do próprio protótipo.

## O que já existe hoje (não invente do zero — corrija)

Origem: `apps/web/src/shared/ui/button.tsx`, `button.css`, `spinner.tsx`, `spinner.css`.

| Eixo | Valores reais hoje | Observação |
|---|---|---|
| Variantes | `primary`, `secondary`, `ghost`, `danger`, `danger-ghost` | `danger-ghost` nasceu de decisão do dono (2026-08-03): num diálogo de perda, quem tem preenchimento é a saída **segura**; a ação irreversível fica vermelha e legível, sem o convite de um botão cheio |
| Tamanhos | `sm` 36px · `md` 48px (padrão) · `lg` 56px | → **conflito real**: a base impõe `min-height: 44px` (alvo de toque), então o `sm` **nunca renderiza 36px**. Existe um tamanho declarado que é impossível |
| Alvo mínimo | 44×44px em altura **e** largura | invariante do projeto (WCAG 2.2 AA) |
| Foco | anel de foco do token `--ring`, sem `outline` | |
| Pressionado | escala 0,97, só quando não está desabilitado | |
| Carregando | giro `sm` (15px) **antes** do rótulo, com `gap`; rótulo intacto; clique bloqueado; cursor `progress` | → **o defeito**: a largura muda ao entrar o giro |
| Desabilitado | **opacidade 0,55 e cursor `not-allowed`. Nada mais.** | → não diz por quê; não muda cor, borda nem peso |
| Brilho (`glow`) | halo roxo `0 10px 30px -8px rgba(120,0,255,.5)` | → **prop morta: zero usos no app inteiro.** A regra "um CTA focal por zona" existe só em prosa no comentário do código |
| Ícone | **não existe slot.** Um ícone vira filho e entra dentro do rótulo | |

O giro é sempre um anel de 2px girando em 0,7s, na cor herdada do botão, com o rótulo `"Carregando…"` **visualmente escondido** só para leitor de tela. Movimento reduzido já neutraliza a animação globalmente.

## Conteúdo e dados reais

Rótulos literais que este botão carrega hoje (não reescreva — são copy homologada):

- `"Entrar com Google"` (lg, primary, no login) · `"Assinar Premium"` (CTA de cobrança) · `"Salvar"` / `"Salvar alterações"` · `"Voltar"` (ghost — o produto **não usa** a palavra "cancelar" em lugar nenhum: uma guarda de copy a proíbe para não colidir com o cancelamento de assinatura) · `"Excluir"` (danger) · `"Exportar"` · `"Gerar PDF"` / `"Baixar CSV"` · `"Tentar novamente"` · `"Sincronizar agora"` · `"Entrar de novo"`.
- Motivos de bloqueio, quando existem, são **parágrafo legível abaixo do botão**, nunca tooltip: `"Exportar precisa de conexão."` · `"Exportar precisa do Premium ativo."` · `"Esta ação precisa de conexão."` · `"Premium pausado — reative para renomear, duplicar, editar ou excluir."`
- O rótulo mais longo em uso real é `"Premium pausado — reative para renomear, duplicar, editar ou excluir."` (motivo, não botão) e `"Salvar alterações"` no botão. Desenhe com esses comprimentos, não com "Salvar".
- Barra real a desenhar como caso de estresse: **4 botões `sm` lado a lado** (`Abrir origem` ghost · `Renomear` ghost · `Duplicar` secondary · `Salvar alterações` primary) numa linha que quebra, com o motivo ocupando a largura toda embaixo.

## Estados obrigatórios

1. **Repouso** — por variante e por tamanho.
2. **Hover** (só ponteiro, só quando habilitado) — `primary` escurece o fundo; `secondary` escurece a borda; `ghost` ganha fundo suave; `danger-ghost` ganha fundo vermelho suave.
3. **Foco por teclado** — anel visível, inclusive **sobre** o botão com brilho (os dois não podem se confundir).
4. **Pressionado** — escala 0,97.
5. **Carregando** — giro + rótulo. **Decida aqui o que o protótipo já decidia: o giro ocupa um lugar reservado, a largura não muda.** O clique está bloqueado e o leitor de tela anuncia ocupado.
6. **Desabilitado com motivo** — o botão apagado **mais** a frase que diz por quê, legível, abaixo (é assim no `Exportar` e na barra de simulações). Mostre as duas frases: a de conexão e a de Premium pausado.
7. **Desabilitado sem motivo** — o que o app faz na maioria dos casos hoje. Desenhe-o para **mostrar que é insuficiente**, e proponha o mínimo (peso, borda, ou obrigatoriedade do motivo).
8. **Offline** — é o caso 6 com `"Esta ação precisa de conexão."`; nunca some o botão sem explicação.
9. **Premium pausado** — é o caso 6 com `"Premium pausado — reative…"`; o bloqueio é de plano, **não** de rede.
10. **Focal com brilho** — o halo roxo, em repouso, hover e foco, e a demonstração de "um por zona": duas ações lado a lado onde **só uma** brilha.
11. **Com ícone** — o slot que hoje não existe: ícone à esquerda do rótulo, e como ele se comporta quando o botão entra em carregando (o giro toma o lugar do ícone, como no login).

## Viewports

- **390px (mobile)** — obrigatório: é onde o produto vive e onde a barra de 4 botões `sm` quebra em duas linhas. Desenhe essa barra a 390px e também a 360px, o pior caso já medido no projeto.
- **1280px (desktop)** — o corte de desktop do produto. O mesmo botão em formulário largo e em barra de ação de painel, onde o crescimento pela entrada do giro é mais visível porque há botões alinhados à direita.
- Não é preciso 1920px: a peça não muda de forma acima de 1280px.

## Regras que o desenho não pode quebrar

- **A largura do botão não muda ao entrar ou sair o carregamento.** Esta é a razão de existir do prompt.
- **O alvo de toque nunca desce de 44×44px**, inclusive no tamanho `sm` — resolva o conflito declarado acima em vez de herdá-lo.
- **Motivo de bloqueio é texto legível, nunca tooltip**: em toque não há hover, e a explicação de um controle desabilitado precisa ser lida.
- **Falha de rede nunca é vendida como falta de Premium** — as duas frases são distintas e o desenho não pode dar a elas o mesmo tratamento visual sem distinção.
- **Frase honesta nunca dentro de campo/placeholder** e nunca cortada: a legenda de motivo mora em elemento de largura total.
- **Nunca oferecer um botão que não pode funcionar** — a regra do produto é ou habilitar, ou desabilitar **com motivo**; não existe terceiro caminho de "some sem avisar".
- **Contraste medido no fundo real**: o rótulo a 55% de opacidade sobre o fundo do cartão, nos dois temas. Se não passar, o desabilitado precisa de outra solução que não seja opacidade.

## Armadilhas já pagas neste projeto

- **Botão nascido fora da viewport**: a homologação visual de cobrança mediu 100,5px de estouro horizontal a 360px, com um botão que nascia fora da tela. Grupos de botões a 360px precisam ser desenhados, não presumidos.
- **Texto que passa no teste e não aparece na tela**: asserções de texto são cegas a oclusão e a estouro. O que decide aqui é a caixa, não a string — desenhe as caixas.
- **Frase cortada por caber em elemento estreito** (016/PR-F): a legenda honesta foi parar num sufixo de placeholder e foi clipada. Motivo vai em bloco de largura total.
- **Rótulo longo estourando a coluna**: `"Salvar alterações"` com giro à esquerda num botão `sm` dentro de uma barra de 4 é o caso que quebra.

## Entregável

Pranchetas, tema **escuro como padrão** e **claro como primeira classe** (as duas versões de cada prancheta):

1. **Matriz de estados** — 5 variantes (`primary`, `secondary`, `ghost`, `danger`, `danger-ghost`) × 6 estados (repouso, hover, foco, pressionado, carregando, desabilitado).
2. **Tamanhos** — `sm` / `md` / `lg` com a régua do alvo de 44px visível sobre cada um.
3. **Carregando, antes e depois** — o botão parado e o mesmo botão ocupado, sobrepostos com a medida de largura, provando que não mexeu.
4. **Bloqueado com motivo** — `Exportar` com as duas frases, e a barra de 4 botões `sm` a 390px e 360px com a legenda ocupando a linha inteira.
5. **Focal com brilho** — duas ações vizinhas, só uma com halo, incluindo o foco por teclado sobre a que brilha.
6. **Com ícone** — repouso e carregando, com o giro ocupando o lugar do ícone.

Reutilize os primitivos existentes: `tf-btn` e seus modificadores `tf-btn--{variante}` / `tf-btn--sm|lg` / `tf-btn--glow` / `tf-btn--loading`, as partes internas `tf-btn__spin` e `tf-btn__label`, o giro `tf-spinner--sm`, e o rótulo só-para-leitor-de-tela `tf-vh`. **Não crie primitivo novo**: se a peça precisar de algo que não existe (um slot de ícone, um estilo de desabilitado que não seja opacidade), proponha-o como **modificador do `tf-btn`** e nomeie-o, para virar decisão do dono.

## Perguntas em aberto para o dono

1. **O rótulo troca durante o carregamento?** O protótipo trocava ("Entrar com Google" → "Entrando…"); o app não troca em nenhum dos 25 casos. Trocar exige uma segunda frase por botão (24 novas frases de copy) e ainda muda a largura — manter o rótulo e reservar o lugar do giro resolve a largura sem copy nova. É decisão de produto, não de desenho.
2. **O brilho (`glow`) fica ou sai?** Hoje tem **zero** usos no app inteiro. Se fica, quais são as "zonas" e qual é o CTA focal de cada uma (login? "Assinar Premium"? o "Calcular" da calculadora?).
3. **Todo botão desabilitado passa a exigir motivo visível?** Hoje só dois lugares mostram (`Exportar` e as simulações); os demais ficam mudos. Se a resposta for sim, alguém precisa escrever ~20 frases de motivo.
4. **O tamanho `sm` de 36px é intenção ou engano?** Ele é impossível hoje (o alvo de 44px vence). Ou o `sm` vira oficialmente 44px, ou existe uma exceção declarada de alvo para densidade em desktop.
