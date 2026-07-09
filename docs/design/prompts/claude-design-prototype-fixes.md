# Prompt de correção — Precifica3D Protótipo Clicável (rodada 1, 2026-07-02)

> Enviar ao Claude Design no projeto "Precifica3D — Protótipo Clicável". Origem dos achados:
> `docs/design/prototype-audit-2026-07-02.md` (auditoria de 6 agentes contra regras de negócio,
> arquitetura e domínio canônico).

---

O protótipo passou por homologação técnica e foi aprovado como visão do produto. Aplique SOMENTE as
correções abaixo. NÃO refaça telas, NÃO mude a identidade visual, os tokens, a navegação (4 abas +
sidebar), o modelo freemium ("calcular é grátis; salvar é Premium"), o upsell com "R$ —", a tela 404
nem o banner de offline — tudo isso foi validado e deve permanecer como está.

## A. Fronteira freemium e copy de negócio

1. Na aba Calcular, o card "Do catálogo" (selects Filamento/Impressora) só pode existir para usuário
   Premium. Para o usuário grátis, substitua por um card compacto de teaser: "Preencha direto do seu
   catálogo — recurso Premium" + link "Ver Premium". Catálogo é persistência, e persistência é 100%
   Premium.
2. No overlay Premium, remova "Pagamento via Mercado Pago. Cancele quando quiser." → use "Preço em
   definição. Pagamento seguro — detalhes na contratação." (provedor de pagamento e política de
   cancelamento ainda não foram decididos pelo produto).
3. No login, troque "Login por Google. Mais opções em breve." por "Entre com sua conta Google."
   (o conjunto de provedores do lançamento ainda não foi decidido).
4. No hero do login, troque "com a conta inteira à mostra — do material à margem" por uma promessa
   sem completude, ex.: "com a conta aberta, item a item" (o modelo ainda não inclui mão de obra,
   impostos e acabamento — decisões em aberto).
5. Presets de Marketplace: corrija ML Clássico para R$ 6,75 + 14% e ML Premium para R$ 6,75 + 19%;
   adicione nota visível "Taxas de referência — confirme as taxas atuais do canal". Não apresente
   taxas de terceiros como fato.

## B. Fórmula, números e consistência da conta

6. Sementes da calculadora = exemplo canônico de homologação: Custo do rolo 100,00 · Peso 1 kg ·
   Gramas 20 · Markup varejo 50% (resultado: Material R$ 2,00 · Preço sugerido R$ 3,00). Energia,
   máquina, falha e marketplace zerados por padrão.
7. A conta tem que fechar ao centavo: arredonde uma única vez e derive as linhas de modo que a soma
   das linhas exibidas == total exibido (hoje 9,35 + 4,68 = 14,03, mas o total mostra 14,02).
8. Histórico demo: gere os itens com a própria fórmula, internamente coerentes (hoje material 9,35 +
   margem 4,68 ≠ preço 23,38, e o sheet de detalhe não fecha a conta). Em cada cálculo salvo, mostre
   discretamente "fórmula v1.0.0" (carimbo de versão) e persista TODOS os inputs. `onSave()` deve
   gravar os valores realmente calculados do estado atual — nunca constantes fixas.
9. Peso do rolo = 0: além do alerta, zere TODAS as linhas do breakdown (hoje o hero mostra 0,00 mas
   Material/Margem exibem valores calculados com fallback silencioso de peso=1).
10. Valide todos os campos numéricos como ≥ 0 com mensagem inline (hoje só o peso é validado;
    negativos calculam silenciosamente).
11. Marketplace: proteja a divisão — se comissão ≥ 100%, mostre erro amigável em vez de calcular.
12. Catálogo de filamentos: o sub-rótulo mistura unidades — mostre "R$ 120,00/rolo · 1 kg" (ou derive
    o preço por kg = custo ÷ peso). Nunca "R$ {custo do rolo}/kg".
13. No breakdown, renomeie "Margem — markup X%" para "Markup (X% sobre o custo)". Reserve "margem"
    para percentual sobre a receita.
14. Formatação monetária única em todo o app: R$ #.###,## (impressoras hoje mostram "R$ 1.200" sem
    centavos).
15. Na Conta, separe "Moeda: R$ (BRL)" de "Idioma: Português (Brasil)" — hoje "Real brasileiro (R$)
    · pt-BR" mistura moeda com idioma.

## C. Estados que faltam

16. Loading: skeletons (shimmer respeitando reduced-motion) para o bloco de resultado, a lista do
    Catálogo e a lista do Histórico; adicione na Conta um toggle "Demo: carregando" análogo ao de
    offline.
17. Erro de carregamento: estado "Não foi possível carregar. Tente de novo." + botão "Tentar
    novamente" para Catálogo e Histórico.
18. Empty do Histórico (Premium com 0 cálculos): "Seus cálculos salvos aparecem aqui." + CTA "Fazer
    um cálculo" + grafismo.
19. Tela de erro genérica (além da 404): "Algo deu errado" on-brand, botão "Recarregar" e linha
    discreta "Código de suporte: {correlationId}" (placeholder) — será o error-boundary do app real.
20. Erros com código: organize as mensagens numa tabela código→frase pt-BR (UNAUTHENTICATED → "Sua
    sessão expirou. Entre de novo." · VALIDATION_ERROR → mensagem do campo · INTERNAL → "Não foi
    possível completar. Tente de novo." · offline → a mensagem atual de offline). Documente no
    readme do design system.
21. Empty do Catálogo: adicione CTA secundário "Começar com filamentos comuns" (semeia PLA/PETG/ABS
    ilustrativos).

## D. Acessibilidade

22. Gestão de foco: sheets, overlay Premium e 404 devem prender o foco (focus-trap), fechar com
    Escape e devolver o foco ao elemento que abriu; na troca de aba/tela, mover o foco para o título
    da nova tela.
23. Alvos de toque ≥ 44px: "Adicionar" e "Comparar" (hoje 40px), lápis de editar (36px), fechar do
    upsell (38px), toggle de tema da sidebar (40px), Switch (28px) e o SegmentedControl — todos com
    área tocável ≥ 44px.
24. Toggle de tema da sidebar: `aria-pressed` + indicação visível de estado; banner offline:
    `role="status" aria-live="polite"`.
25. Contraste com o tema ESCURO como default: crie o token semântico `--danger-text` (e equivalentes
    para success/info usados como texto), remapeado por tema — no dark, um vermelho claro ≥ 4,5:1
    sobre `--surface-card` (o `--danger-deep` atual fica ~3,1:1). Atualize o readme com a regra
    "status como texto".
26. Card "Truth's Forge Premium" da Conta: no dark ele fica branco com título branco (contraste 1:1
    — invisível). Use tokens que invertem com o tema (`--text-on-inverse` ou equivalente) e valide
    ≥ 4,5:1 nos DOIS temas.

## E. Tema e movimento

27. Script pré-paint: resolva `localStorage → prefers-color-scheme → dark` (hoje a primeira visita
    pula a preferência do sistema operacional).
28. Reconcilie a documentação: o produto usa DARK como default (light é first-class, não default) —
    corrija o comentário "LIGHT (default, v1)" em `tokens/colors.css` e o readme §3, e reavalie os
    papéis de status-como-texto sob esse default.
29. Logo do login: troque a animação `p3dpulse` infinita por uma entrada one-shot (a própria regra do
    design system proíbe loops decorativos infinitos).

## F. Layout e fidelidade de token

30. Overflow: Calcular/Catálogo/Histórico/Conta têm ~6px de scroll lateral em 390px (grafismos com
    `right:-22px` sem clip) — adicione `overflow-x: clip` (ou hidden) ao container de cada tela.
31. Substitua raios/espaçamentos hardcoded (18px/14px/24px) pelos tokens `--radius-*`/`--space-*`;
    alinhe a largura de conteúdo ao token `--content-max` (1120px — hoje 880px).
32. No sheet do catálogo, troque o `<input>` cru pelo componente Input/Field do design system (anel
    de foco único de marca).
33. Glow: mova o glow do botão "Salvar" para o PriceHero do resultado — o foco visual é a conta, não
    o botão (mantenha 1 glow por zona).
34. Complete o formulário de Impressora: modelo, valor (R$), horas/dia, dias/mês, payback e nível de
    uso (Básico/Médio/Profissional/Intenso) — hoje só captura "Nome" e a impressora criada não
    alimenta o cálculo. No Filamento, adicione o campo "cor". Valide "Nome" obrigatório inline e
    desabilite "Salvar" enquanto inválido.
35. Iniciais dos itens do catálogo: use 2 letras ou o tipo (PLA/PETG/ABS) para evitar duplicatas
    (hoje "PLA Branco" e "PETG Preto" viram ambos "P").
36. Identidade da Conta: troque "Jonatan Silva / jonatan@email.com" por placeholder neutro (ex.:
    "Sua conta / voce@gmail.com") e anote no readme: no app real, nome/e-mail vêm do endpoint
    `/api/v1/me` (identidade confirmada pelo servidor) e o status Premium vem do servidor — o
    `localStorage` do protótipo é apenas simulação de demonstração, nunca o modelo real.

## G. Notas de handoff (readme)

37. Adicione ao readme uma seção "Escopo por época": fatia 001 = login Google + material+markup
    único; E1 = energia/máquina/falha/atacado (modelo ILUSTRATIVO, ainda não ratificado); E2 =
    catálogo/salvar; E4 = histórico/export/compartilhar; E5 = simulador de marketplace; E6 =
    assinatura. Deixe explícito que toda fórmula além de material+markup é PROPOSTA a ratificar
    pelo produto, não decisão tomada.
