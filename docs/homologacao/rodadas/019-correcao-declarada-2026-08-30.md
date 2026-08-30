# 019 — as seis fatias em CORREÇÃO DECLARADA (2026-08-30)

**Estado**: as seis fatias do incremento **019-porte-design** foram mergeadas em `develop` —
PR-A #59 · PR-B #60 · PR-C #61 · PR-D #62 · PR-F #63 · PR-E #65 — todas com CI verde e evidência
por fatia em `specs/019-porte-design/dod-evidence.md` + `specs/019-porte-design/evidencias/pr-*/`.

**Nada disso está homologado.** Pelo processo (`docs/homologacao/PROCESSO-HOMOLOGACAO.md`), um
"corrigido" de dev/agente é **CORREÇÃO DECLARADA** — só a segunda passada do dono, no produto
rodando, fecha um ponto. A **Rodada 1** (relatório de 2026-08-03/04 → incremento 016, 15 pontos)
segue **ABERTA em re-verificação desde 2026-08-10**, e enquanto ela tiver pontos aguardando
re-verificação, **cenário novo não abre** (decisão do dono, 2026-08-10).

Portanto: as superfícies novas e alteradas do 019 (o caminho sem parede, os comportamentos da
calculadora, o recálculo do Catálogo, o rodapé da prancheta 10, Simulações ≥1280 e o construtor
Montar-e-Enviar) **aguardam a Rodada 1 fechar** para entrar em rodada de homologação própria —
nenhum cenário novo foi aberto por este registro (D5 da spec do 019).

Pontos que o dono ratifica nos gates (não são homologação; estão nos corpos dos PRs e no
dod-evidence §PR-B/§PR-C/§PR-D/§PR-F/§PR-E): flips dos ADRs 0032/0033/0034 + emendas (0031 §2026-08-26,
0017 §2026-08-29), e as listas de ratificação por fatia. Follow-up ALTA registrado na PR-E:
`app-shell.tsx` com dois `<Outlet/>` — redimensionar cruzando 425px zera estado local não salvo.
