#!/usr/bin/env bash
# Legado: liga instância Cloud SQL. Com Neon não é necessário (ver docs/neon-setup.md).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/db-config.sh"

echo "Ligando instancia Cloud SQL '$INSTANCE_NAME'..."
gcloud sql instances patch "$INSTANCE_NAME" --activation-policy=ALWAYS --project="$GCP_PROJECT" --quiet
echo "Instancia ligada com sucesso!"
gcloud sql instances describe "$INSTANCE_NAME" --project="$GCP_PROJECT" --format="value(state)"
