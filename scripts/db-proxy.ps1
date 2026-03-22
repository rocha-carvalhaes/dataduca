. "$PSScriptRoot\db-config.ps1"

$proxyPath = "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\cloud-sql-proxy.exe"
if (-not (Test-Path $proxyPath)) {
    Write-Host "Cloud SQL Auth Proxy nao encontrado em: $proxyPath" -ForegroundColor Red
    Write-Host "Instale com: curl.exe -L -o `"$proxyPath`" https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.15.2/cloud-sql-proxy.x64.exe"
    exit 1
}

Write-Host "Iniciando Cloud SQL Auth Proxy..." -ForegroundColor Cyan
Write-Host "Conexao: $CONNECTION_NAME -> localhost:$PROXY_PORT" -ForegroundColor Yellow
Write-Host "Pressione Ctrl+C para parar." -ForegroundColor Gray
& $proxyPath $CONNECTION_NAME --port=$PROXY_PORT
