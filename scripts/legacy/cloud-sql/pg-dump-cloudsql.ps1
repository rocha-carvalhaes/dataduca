# Gera dataduca_neon_migration.dump na raiz do repositorio.
# Pre-requisitos: Cloud SQL ligado, cloud-sql-proxy em 127.0.0.1:5433, pg_dump no PATH.
# A senha vem do usuario:senha em DATABASE_URL no .env (mesmo formato do backend com proxy).
$ErrorActionPreference = "Stop"
# Script em scripts/legacy/cloud-sql — raiz do repo sobe 3 niveis
$RepoRoot = Split-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) -Parent
Set-Location $RepoRoot
$raw = Get-Content -Path ".env" -Raw
if (-not ($raw -match 'postgresql://[^:]+:([^@]+)@')) {
    Write-Error "DATABASE_URL com usuario:senha@ nao encontrado no .env"
}
$env:PGPASSWORD = [Uri]::UnescapeDataString($Matches[1])
$out = Join-Path $RepoRoot "dataduca_neon_migration.dump"
& pg_dump -h 127.0.0.1 -p 5433 -U dataduca_user -d dataduca -F c -f $out
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Get-Item $out | Format-List FullName, Length
