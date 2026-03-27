# Legado: Google Cloud SQL

Estes scripts eram usados quando o PostgreSQL do Dataduca rodava no **Google Cloud SQL** (proxy local `localhost:5433`, `gcloud`, ligar/desligar instância).

**Migramos para o [Neon](https://neon.tech)** porque o custo no GCP estava alto para o uso de desenvolvimento — da ordem de **~US$ 0,50 por dia** (instância pequena + disco + horas ligadas), sem necessidade de manter esse valor com o Neon serverless.

A configuração atual do banco está em **[docs/neon-setup.md](../../../docs/neon-setup.md)**.

| Script | Função (só se ainda existir instância Cloud SQL) |
|--------|--------------------------------------------------|
| `db-config.*` | Variáveis projeto/região/instância |
| `db-start.*` / `db-stop.*` | Ligar/desligar a instância |
| `db-proxy.*` | Cloud SQL Auth Proxy na porta 5433 |
| `db-status.*` | Status no `gcloud` |
| `pg-dump-cloudsql.*` | `pg_dump` via proxy para arquivo `.dump` |

Se a instância Cloud SQL já foi **removida** no GCP, estes arquivos podem ser apagados; mantemos no repositório apenas como referência ou para migração pontual de um backup antigo.
