#Requires -Version 5.1
<#
  Restore de dump PostgreSQL (.dump formato -F c) para o Neon.
  Variáveis: arquivo scripts/neon-restore.env (copie de neon-restore.env.example)
  ou defina $env:NEON_RESTORE_URL e $env:DUMP_PATH antes de rodar.

  Uso (abra PowerShell e vá até a raiz do repositório):
    cd C:\...\dataduca
    .\scripts\pg-restore-neon.ps1

  Não use duplo clique no .ps1 (a janela fecha e parece que "nada acontece").
#>

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
$EnvFile = Join-Path $ScriptDir "neon-restore.env"

function Import-DotEnv {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return }
    Get-Content $Path -Encoding UTF8 | ForEach-Object {
        $line = $_.Trim()
        if ($line -match '^\s*#' -or $line -eq '') { return }
        $pair = $line -split '=', 2
        if ($pair.Count -lt 2) { return }
        $key = $pair[0].Trim()
        $val = $pair[1].Trim()
        # Remove aspas envolvendo o valor, se houver
        if ($val.Length -ge 2 -and $val.StartsWith('"') -and $val.EndsWith('"')) {
            $val = $val.Substring(1, $val.Length - 2)
        }
        Set-Item -Path "Env:$key" -Value $val
    }
}

Write-Host ""
Write-Host "=== pg-restore-neon (Dataduca) ===" -ForegroundColor Cyan
Write-Host "Raiz do repo: $RepoRoot" -ForegroundColor DarkGray

if (Test-Path $EnvFile) {
    Import-DotEnv -Path $EnvFile
    Write-Host "OK: carregado $EnvFile" -ForegroundColor Green
    if ($env:NEON_RESTORE_URL) {
        $masked = $env:NEON_RESTORE_URL -replace '://[^:]+:[^@]+@', '://***:***@'
        Write-Host "NEON_RESTORE_URL: $masked" -ForegroundColor DarkGray
    }
} else {
    Write-Host "AVISO: nao encontrado $EnvFile" -ForegroundColor Yellow
    Write-Host "Copie scripts/neon-restore.env.example para scripts/neon-restore.env e preencha NEON_RESTORE_URL." -ForegroundColor Yellow
}

if (-not $env:NEON_RESTORE_URL) {
    Write-Host "ERRO: defina NEON_RESTORE_URL no neon-restore.env ou: `$env:NEON_RESTORE_URL='postgresql://...'" -ForegroundColor Red
    Read-Host "Pressione Enter para sair"
    exit 1
}

# Erro comum: colar "DATABASE_URL=postgresql://..." como valor (duplica o nome da variavel)
if ($env:NEON_RESTORE_URL -match '^\s*DATABASE_URL=') {
    $env:NEON_RESTORE_URL = ($env:NEON_RESTORE_URL -replace '^\s*DATABASE_URL=\s*', '').Trim()
    Write-Host "Aviso: removido o prefixo DATABASE_URL= duplicado no valor." -ForegroundColor Yellow
}
$env:NEON_RESTORE_URL = $env:NEON_RESTORE_URL.Trim()

$dumpRelative = if ($env:DUMP_PATH) { $env:DUMP_PATH } else { "dataduca_neon_migration.dump" }
$DumpPath = if ([System.IO.Path]::IsPathRooted($dumpRelative)) {
    $dumpRelative
} else {
    Join-Path $RepoRoot $dumpRelative
}

if (-not (Test-Path $DumpPath)) {
    Write-Host "ERRO: dump nao encontrado: $DumpPath" -ForegroundColor Red
    Write-Host "Gere o arquivo com scripts\legacy\cloud-sql\pg-dump-cloudsql.cmd ou ajuste DUMP_PATH em neon-restore.env" -ForegroundColor Yellow
    Read-Host "Pressione Enter para sair"
    exit 1
}

$pgRestore = Get-Command pg_restore -ErrorAction SilentlyContinue
if (-not $pgRestore) {
    Write-Host "ERRO: pg_restore nao esta no PATH." -ForegroundColor Red
    Write-Host "Instale o PostgreSQL (client tools) ou adicione a pasta bin ao PATH." -ForegroundColor Yellow
    Read-Host "Pressione Enter para sair"
    exit 1
}

$cleanArgs = @()
if ($env:PG_RESTORE_CLEAN -eq "1") {
    $cleanArgs = @("--clean", "--if-exists")
    Write-Host "Modo: --clean --if-exists" -ForegroundColor Cyan
}

Write-Host "Executando pg_restore (pode levar alguns minutos; saida verbosa abaixo)..." -ForegroundColor Cyan
Write-Host "Dump: $DumpPath" -ForegroundColor DarkGray
Write-Host ""

# -v = lista objetos no terminal (sem isso parece que "travou")
& pg_restore @cleanArgs -v -d $env:NEON_RESTORE_URL -F c --no-owner --no-privileges $DumpPath
$exit = $LASTEXITCODE
Write-Host ""
if ($exit -ne 0) {
    Write-Host "pg_restore retornou codigo $exit." -ForegroundColor Yellow
    Write-Host "Se apareceram ERROS de tipo/objeto, tente PG_RESTORE_CLEAN=1 no neon-restore.env" -ForegroundColor Yellow
    Write-Host "Se travar em SSL, remova &channel_binding=require da URL no Neon." -ForegroundColor Yellow
} else {
    Write-Host "Concluido (codigo 0)." -ForegroundColor Green
}

Read-Host "Pressione Enter para sair"
