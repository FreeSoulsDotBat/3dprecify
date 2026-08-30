import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// E2 T025 — full-stack e2e prerequisites: the compose Postgres + a DEDICATED, recreated e2e
// database (never the developer's dev data) + migration 0001 applied. Runs once before the
// Playwright servers start; the backend webServer then points P3D_DATABASE_URL here.
// Requires Docker (local dev has it for the DB anyway; CI ubuntu runners ship it).

export const E2E_DB_NAME = "precifica3d_e2e";
export const E2E_DATABASE_URL = `postgresql+psycopg://precifica3d@localhost:5433/${E2E_DB_NAME}`;

const repoRoot = fileURLToPath(new URL("../../../..", import.meta.url));
const backendDir = fileURLToPath(new URL("../../../../backend", import.meta.url));

function run(command: string, cwd: string, env?: Record<string, string>): void {
  execSync(command, { cwd, stdio: "inherit", env: { ...process.env, ...env } });
}

export default function globalSetup(): void {
  // 1. Postgres up (idempotent) + wait for health.
  run("docker compose up -d --wait postgres", repoRoot);
  // 2. Fresh e2e database — dropped and recreated every run for determinism.
  run(
    `docker compose exec -T postgres psql -U precifica3d -d postgres -c "DROP DATABASE IF EXISTS ${E2E_DB_NAME} WITH (FORCE)"`,
    repoRoot,
  );
  run(
    `docker compose exec -T postgres psql -U precifica3d -d postgres -c "CREATE DATABASE ${E2E_DB_NAME}"`,
    repoRoot,
  );
  // 3. The real migrations ARE the provisioning (ADR-0013).
  // PYTHONIOENCODING: no Windows, o console herdado por este processo filho e cp1252, e a mensagem
  // da revisao 0004 carrega um travessao — o alembic estoura ao IMPRIMIR o proprio log, entre a 0003
  // e a 0004, com uma falha que nao diz nada sobre migracao. Medido 2026-08-01: o mesmo comando roda
  // liso num shell UTF-8 e falha aqui, o que fazia o e2e local parecer quebrado por outro motivo.
  // Na CI (ubuntu) nunca aconteceu; e um trap de ambiente, e forcar UTF-8 e a correcao portatil.
  run("uv run alembic upgrade head", backendDir, {
    P3D_DATABASE_URL: E2E_DATABASE_URL,
    PYTHONIOENCODING: "utf-8",
  });
}
