. "$PSScriptRoot\db-config.ps1"

Write-Host "Verificando status da instancia '$INSTANCE_NAME'..." -ForegroundColor Cyan
$info = gcloud sql instances describe $INSTANCE_NAME --project=$GCP_PROJECT --format="table(name,state,databaseVersion,settings.tier,ipAddresses[0].ipAddress,region)" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Output $info
} else {
    Write-Host "Erro ao consultar status. A instancia pode nao existir." -ForegroundColor Red
    exit 1
}
