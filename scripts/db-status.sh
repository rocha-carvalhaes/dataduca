#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/db-config.sh"

echo "Verificando status da instancia '$INSTANCE_NAME'..."
gcloud sql instances describe "$INSTANCE_NAME" --project="$GCP_PROJECT" \
  --format="table(name,state,databaseVersion,settings.tier,ipAddresses[0].ipAddress,region)"
