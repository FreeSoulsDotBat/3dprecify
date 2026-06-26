# Quality gate — PostToolUse hook (Edit|Write)
# Runs lint/format/type-check WHEN the stack provides them.
# Until the stack is chosen there is no package.json -> this is a no-op (exit 0).
# When the stack exists, failing checks exit 2, which blocks and feeds the error back to the agent.
# NOTE (devops): generalize for CI/Linux (pwsh may be absent) and tune which checks run per edit.

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
$targets = @('lint', 'format:check', 'typecheck')
$failed = $false
foreach ($t in $targets) {
  if ($scripts -and ($scripts.PSObject.Properties.Name -contains $t)) {
    Write-Output "[quality-gate] npm run $t"
    npm run $t
    if ($LASTEXITCODE -ne 0) { $failed = $true }
  }
}
if ($failed) { exit 2 }
exit 0
