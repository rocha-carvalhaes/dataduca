#!/usr/bin/env bash
# Legado: desliga instância Cloud SQL. Com Neon não é necessário (ver docs/neon-setup.md).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/db-config.sh"

echo "Desligando instancia Cloud SQL '$INSTANCE_NAME'..."
gcloud sql instances patch "$INSTANCE_NAME" --activation-policy=NEVER --project="$GCP_PROJECT" --quiet
echo "Instancia desligada com sucesso!"
