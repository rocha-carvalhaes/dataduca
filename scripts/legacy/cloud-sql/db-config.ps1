# Legado: Google Cloud SQL. Desenvolvimento/produção com Neon: use DATABASE_URL no .env (ver docs/neon-setup.md).
$GCP_PROJECT = "dataduca"
$INSTANCE_NAME = "dataduca-db"
$REGION = "southamerica-east1"
$CONNECTION_NAME = "${GCP_PROJECT}:${REGION}:${INSTANCE_NAME}"
$PROXY_PORT = 5433
