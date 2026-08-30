# Quality gate — PostToolUse hook (Edit|Write)
# Formats/lints ONLY the file that was just written. The previous whole-repo sweep
# (`prettier --check .` + `eslint .`) cost ~5-6s on EVERY edit regardless of what changed, and it
# duplicated the lefthook pre-commit gate that already runs format+lint over the repo on each commit.
# Heavier checks (typecheck, tests, coverage) stay in lefthook pre-push and CI (`pnpm gate:all`).
# Failing checks exit 2, which blocks and feeds the error back to the agent.
# NOTE (devops): CI/Linux runs the same scripts directly; pwsh is only the local PostToolUse wrapper.
# NOTE (pwsh): never wrap these checks in a function whose result is captured — a native command's
# stdout rides the success stream, so `$failed = (Invoke-Check ...)` would collect the linter's
# output into an array and read truthy on a CLEAN file. Call them inline and read $LASTEXITCODE.

$ErrorActionPreference = 'Stop'
$root = $env:CLAUDE_PROJECT_DIR
if (-not $root) { $root = (Get-Location).Path }
if (-not (Test-Path (Join-Path $root 'package.json'))) {
  Write-Output '[quality-gate] Stack not chosen yet - lint/format/type-check placeholder (no-op).'
  exit 0
}
$rootFull = (Resolve-Path $root).Path

# The hook payload arrives as JSON on stdin (`tool_input.file_path` = the file just written).
# Run by hand (no stdin) and we fall back to the whole-repo sweep, so the script stays usable alone.
$target = $null
if ([Console]::IsInputRedirected) {
  $payload = [Console]::In.ReadToEnd()
  if ($payload) {
    try { $target = ($payload | ConvertFrom-Json).tool_input.file_path } catch { $target = $null }
  }
  # A write we cannot attribute to an existing path is not this repo's linters' business.
  if (-not $target -or -not (Test-Path $target)) { exit 0 }

  $full = (Resolve-Path $target).Path
  # Files outside the repo (scratchpad, agent memory) are never covered by this project's config.
  if (-not $full.StartsWith($rootFull, [StringComparison]::OrdinalIgnoreCase)) { exit 0 }
  $target = ($full.Substring($rootFull.Length).TrimStart('\', '/')) -replace '\\', '/'
}

$failed = $false
Push-Location $rootFull
try {
  if ($target) {
    # Prettier owns formatting: --ignore-unknown skips file types it has no parser for, and
    # .prettierignore still applies (markdown/generated files stay exempt, exit 0).
    Write-Host "[quality-gate] prettier --check $target"
    pnpm exec prettier --check --ignore-unknown $target
    if ($LASTEXITCODE -ne 0) { $failed = $true }

    # ESLint owns only JS/TS sources; --no-warn-ignored keeps ignored paths silent (exit 0).
    if ($target -match '\.(ts|tsx|js|jsx|mjs|cjs)$') {
      Write-Host "[quality-gate] eslint $target"
      pnpm exec eslint --no-warn-ignored $target
      if ($LASTEXITCODE -ne 0) { $failed = $true }
    }
  }
  else {
    Write-Host '[quality-gate] prettier --check . (manual run — whole repo)'
    pnpm exec prettier --check .
    if ($LASTEXITCODE -ne 0) { $failed = $true }
    Write-Host '[quality-gate] eslint . (manual run — whole repo)'
    pnpm exec eslint .
    if ($LASTEXITCODE -ne 0) { $failed = $true }
  }
}
finally { Pop-Location }

if ($failed) { exit 2 }
exit 0
