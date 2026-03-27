# Legado: liga instância Cloud SQL. Com Neon não é necessário (ver docs/neon-setup.md).
. "$PSScriptRoot\db-config.ps1"

Write-Host "Ligando instancia Cloud SQL '$INSTANCE_NAME'..." -ForegroundColor Cyan
gcloud sql instances patch $INSTANCE_NAME --activation-policy=ALWAYS --project=$GCP_PROJECT --quiet
if ($LASTEXITCODE -eq 0) {
    Write-Host "Instancia ligada com sucesso!" -ForegroundColor Green
    Write-Host "Aguardando a instancia ficar pronta..."
    gcloud sql instances describe $INSTANCE_NAME --project=$GCP_PROJECT --format="value(state)"
} else {
    Write-Host "Erro ao ligar a instancia." -ForegroundColor Red
    exit 1
}
