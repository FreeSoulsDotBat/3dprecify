# Quality gate — PostToolUse hook (Edit|Write)
# Runs fast format/lint checks via pnpm (the chosen package manager, ADR-0004).
# Heavier checks (typecheck, tests, coverage) run in lefthook pre-push and CI — not on every edit.
# Failing checks exit 2, which blocks and feeds the error back to the agent.
# NOTE (devops): CI/Linux runs the same scripts directly; pwsh is only the local PostToolUse wrapper.

$ErrorActionPreference = 'Stop'
$root = $env:CLAUDE_PROJECT_DIR
if (-not $root) { $root = (Get-Location).Path }

$pkg = Join-Path $root 'package.json'
if (-not (Test-Path $pkg)) {
  Write-Output '[quality-gate] Stack not chosen yet - lint/format/type-check placeholder (no-op).'
  exit 0
}

$json = Get-Content $pkg -Raw | ConvertFrom-Json
$scripts = $json.scripts
$targets = @('format:check', 'lint')
$failed = $false
foreach ($t in $targets) {
  if ($scripts -and ($scripts.PSObject.Properties.Name -contains $t)) {
    Write-Output "[quality-gate] pnpm run $t"
    pnpm run $t
    if ($LASTEXITCODE -ne 0) { $failed = $true }
  }
}
if ($failed) { exit 2 }
exit 0
