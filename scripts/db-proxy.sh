#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/db-config.sh"

if ! command -v cloud-sql-proxy &> /dev/null; then
    echo "Cloud SQL Auth Proxy nao encontrado. Instale em: https://cloud.google.com/sql/docs/postgres/connect-auth-proxy"
    exit 1
fi

echo "Iniciando Cloud SQL Auth Proxy..."
echo "Conexao: $CONNECTION_NAME -> localhost:$PROXY_PORT"
echo "Pressione Ctrl+C para parar."
cloud-sql-proxy "$CONNECTION_NAME" --port="$PROXY_PORT"
