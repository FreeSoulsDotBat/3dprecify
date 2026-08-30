# Quickstart — 019 O porte do design

Como subir a stack e **provar** cada fatia ponta a ponta. Prova = o produto rodando + a guarda
automatizada verde + a evidência visual que a segunda passada do dono vai reverificar (D5).

## Pré-requisitos

- Docker Desktop (Postgres 17 em `5433`), Node 24 + pnpm, Python 3.12 + uv, Firebase CLI.
- **Armadilha desta máquina (Windows)**: a faixa reservada do SO muda a cada boot e já engoliu a
  porta **9099** do auth emulator (`netsh interface ipv4 show excludedportrange protocol=tcp`). Sem
  admin: `E2E_AUTH_EMULATOR_PORT=9500` + `firebase emulators:exec --config firebase.e2e-local.json`
  (cópia gitignored do `firebase.json` com `auth.port` livre). Com admin: `net stop winnat & net start
  winnat`. Detalhe em `specs/018-abas-desktop/evidencias/ambiente.md`.

## Subir

```bash
docker compose up -d postgres
cd backend && uv run alembic upgrade head        # 0007 hoje; 0008 (PR-D) e 0009 (PR-E) quando existirem
PORT=8000 uv run python scripts/run_e2e_server.py   # o runner Windows-safe (psycopg async ≠ Proactor)
pnpm dev                                        # emulador de auth + vite em 5173
```

Sanidade: `GET /health` → 200 · `GET /api/v1/entitlement` sem token → **401** (500 aqui invalida tudo).

## Provar por fatia

| fatia | guarda automatizada | prova no produto (evidência 1:1, dois temas) |
| --- | --- | --- |
| **V0** | — | tabela (a)/(b)/(c) com arquivo:linha por item do handoff §1/§3 no `dod-evidence.md`; contagem de "canal"; contraste do `--warning-text` **medido** |
| **PR-A** | `styles/*.test.ts` (uma classe/um arquivo; zero phone-scroll/rola — vermelhas por mutação) · `token-parity` 88 · unit dos primitivos · `overflow-geometria` 10 larguras | `tf-frozen` dica/rótulo ≥4,5:1 AA MEDIDOS nos 2 temas (T016; a folha usa `--border-subtle`); `tf-plist` ≥9 itens a 390px (contados na imagem); `tf-alert__close` 44×44 sem alterar altura; `:focus-visible` sem anel em todo controle; zero "canal" em UI e PDF |
| **PR-B** | `git diff origin/develop -- backend/app/{entitlement,api,models,services}` **vazio** + `test_entitlement_gate.py` por método · unit: mock de rede com **zero** chamadas de escrita no estado grátis · e2e: outbox com 0 itens | Catálogo grátis: vazio didático → "Adicionar filamento" → formulário inteiro inerte, "Salvar" desabilitado visível, "Salvar faz parte do Premium." acima dos botões; lapsed com itens: campos preenchidos + "Reative o Premium…"; Orçamentos/Simulações: "Fazer um cálculo" leva à calculadora |
| **PR-C** | unit: aviso não dispara em `change`, dispara em `blur`; "Entendi" 850 dispensa, 2.400 volta; `R$/kWh` 3+ casas == motor · e2e T212 caixa visível durante rolagem a 390px (dois eixos) | readout "de R$ 4.000,00 ÷ 3.600 h" nos dois modos; confirmação só ao voltar ao ritmo com valor manual ("Ajustar" nunca pergunta); selo compacto dispensado que **reaparece** ao mudar a data da tarifa (mutar `effectiveDate` no catálogo servido e esperar o valor mutado — lição A2) |
| **PR-D** | pytest: migração 0008 round-trip; corrida de nome (duas criações ⇒ uma "(2)", zero perdidas); vetor de normalização compartilhado · drift-guard idempotente · e2e: mudar custo do filamento ⇒ "N preços mudaram" + "era R$ X" corretos | preço GRANDE sempre recomputado; fixado não muda ao mudar custo e AVISA (ATENÇÃO) quando o custo ultrapassa; desfixar volta; primeira visita sem "0 mudaram"; `tf-table` ≥1024px com densidade contada |
| **PR-E** | `pricing-core`: `computeQuote` vetor numérico + **varredura de igualdade 4.1.0↔4.2.0** antes do bump · pytest: 0009 round-trip + snapshot com total divergente **recusado** + Literal==dict · e2e: 3 itens × quantidades soma com igualdade exata; UPDATE no enviado falha | "Abaixo do custo" no limite do piso; "Válido até" impresso; PDF com bruto → desconto → total; nome adversarialmente longo sem colisão de coluna (geometria na página) |
| **PR-F** | e2e: largura útil de Simulações medida 1280/1440/1920 antes/depois; zero transbordo 2 eixos · unit D1 falha se UM texto mudar (mutação); D2 chave única | Simulações ≥1280px = prancheta 20g; mobile idêntico (screenshot a screenshot); A11-r itens visíveis sem rolar contados |

## Gate de cada PR

`pnpm gate:all` (mesmo comando do lefthook/CI) + e2e completo contra a stack real + drift-guard +
linha no `docs/token-ledger.md` + o ADR da fatia flipado pelo dono no merge. Entrega =
**CORREÇÃO DECLARADA**; só a segunda passada do dono fecha, e ela espera a Rodada 1.
