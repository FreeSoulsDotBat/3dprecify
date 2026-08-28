# Ambiente — evidência do T005 (V0)

**Data**: 2026-08-27 · **Máquina**: Windows 11 (dev do dono) · **Branch**: `019-porte-design` (de develop `6a1a55a`, 018 mergeado)

| Sonda | Resultado | Critério |
| --- | --- | --- |
| `GET /health` | **200** | 200 exigido |
| `GET /api/v1/entitlement` (sem token) | **401** | 401 exigido — 500 aqui invalidaria tudo (016/V0) |
| Alembic | **0007 (head)** — 0008 (PR-D) e 0009 (PR-E) ainda não existem | head atual |
| Postgres | container `precifica3d-postgres` (compose, porta 5433) | healthy |
| Auth emulator | porta **9500** via `firebase.e2e-local.json` + `E2E_AUTH_EMULATOR_PORT` — a 9099 está na faixa reservada do Windows deste boot (9011–9110) | ver `specs/018-abas-desktop/evidencias/ambiente.md` |

Backend subido pelo runner Windows-safe (`backend/scripts/run_e2e_server.py`), como manda o `quickstart.md`.
