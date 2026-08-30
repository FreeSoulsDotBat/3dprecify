# Ambiente — evidência do T002

**Data**: 2026-08-26 · **Máquina**: Windows 11 (dev do dono) · **Executor**: fechamento do 018

Stack subida pelo caminho documentado (Docker Desktop → `docker compose up -d postgres` →
`uv run python scripts/run_e2e_server.py` — o runner Windows-safe do repositório, porque
`uvicorn --reload` no Windows põe o psycopg async no ProactorEventLoop e quebra toda rota de
banco; ver `backend/README.md`).

| Sonda | Resultado | Critério |
| --- | --- | --- |
| `GET /health` | **200** `{"status":"ok"}` | 200 exigido |
| `GET /api/v1/entitlement` (sem token) | **401** | 401 exigido — um **500 aqui invalidaria tudo** (foi exatamente o modo de falha dos pontos 15–19 da homologação, medidos e fechados sem código no 016/V0) |

Postgres: container `precifica3d-postgres` **healthy**, migrações em `0007 (head)`.

Nota de ambiente (armadilha conhecida desta máquina): a faixa de portas reservada do Windows
muda a cada boot; neste dia ela engoliu a **9099** (auth emulator) — `netsh interface ipv4 show
excludedportrange` mostrou `9011–9110`, e o destrave é `net stop winnat && net start winnat`
elevado. Registrado porque qualquer "emulador não sobe" futuro provavelmente é isto, não o app.
