# Legado: desliga instância Cloud SQL. Com Neon não é necessário (ver docs/neon-setup.md).
. "$PSScriptRoot\db-config.ps1"

Write-Host "Desligando instancia Cloud SQL '$INSTANCE_NAME'..." -ForegroundColor Cyan
gcloud sql instances patch $INSTANCE_NAME --activation-policy=NEVER --project=$GCP_PROJECT --quiet
if ($LASTEXITCODE -eq 0) {
    Write-Host "Instancia desligada com sucesso!" -ForegroundColor Green
} else {
    Write-Host "Erro ao desligar a instancia." -ForegroundColor Red
    exit 1
}
