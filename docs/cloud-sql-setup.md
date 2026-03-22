# Cloud SQL PostgreSQL — Setup e Operação

## Visão geral

O banco de dados PostgreSQL do Dataduca está hospedado no **Google Cloud SQL**, dentro do projeto GCP `dataduca`. A conexão local é feita via **Cloud SQL Auth Proxy**, que cria um túnel seguro sem necessidade de expor IPs ou gerenciar certificados SSL manualmente.

### Dados da instância

| Item | Valor |
|---|---|
| Projeto GCP | `dataduca` |
| Instância | `dataduca-db` |
| Versão | PostgreSQL 15 |
| Tier | `db-f1-micro` (0.6 GB RAM, vCPU compartilhada) |
| Região | `southamerica-east1` (São Paulo) |
| IP público | `34.95.137.196` |
| Banco de dados | `dataduca` |
| Usuário | `dataduca_user` |
| Connection name | `dataduca:southamerica-east1:dataduca-db` |

---

## Pré-requisitos

1. **Google Cloud SDK** instalado e autenticado:
   ```bash
   gcloud auth login
   gcloud auth application-default login
   gcloud config set project dataduca
   ```

2. **Cloud SQL Auth Proxy** instalado. No Windows, o binário fica em:
   ```
   %LOCALAPPDATA%\Google\Cloud SDK\google-cloud-sdk\bin\cloud-sql-proxy.exe
   ```
   Para reinstalar manualmente:
   ```bash
   curl -L -o cloud-sql-proxy.exe https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.15.2/cloud-sql-proxy.x64.exe
   ```

---

## Fluxo de trabalho diário

### 1. Ligar a instância

```powershell
.\scripts\db-start.ps1
```

Aguarde ~1-2 minutos até a instância ficar `RUNNABLE`.

### 2. Iniciar o proxy

Em um terminal separado (mantenha-o aberto):

```powershell
.\scripts\db-proxy.ps1
```

O proxy conecta o Cloud SQL em `localhost:5433`.

### 3. Rodar o backend

```bash
uvicorn app.main:app --reload
```

O backend já está configurado para usar a `DATABASE_URL` do `.env`, que aponta para `localhost:5433` via proxy.

### 4. Ao terminar

1. Feche o proxy com `Ctrl+C`.
2. Desligue a instância:

```powershell
.\scripts\db-stop.ps1
```

### Verificar status

```powershell
.\scripts\db-status.ps1
```

---

## Scripts disponíveis

Todos os scripts ficam na pasta `scripts/` e existem em versão PowerShell (`.ps1`) e Bash (`.sh`).

| Script | Descrição |
|---|---|
| `db-config.ps1` / `db-config.sh` | Variáveis de configuração (projeto, instância, região, porta) |
| `db-start.ps1` / `db-start.sh` | Liga a instância Cloud SQL |
| `db-stop.ps1` / `db-stop.sh` | Desliga a instância Cloud SQL |
| `db-status.ps1` / `db-status.sh` | Mostra o status atual da instância |
| `db-proxy.ps1` / `db-proxy.sh` | Inicia o Cloud SQL Auth Proxy na porta 5433 |

---

## Configuração do .env

O `.env` na raiz do projeto controla a conexão do backend:

```env
# Cloud SQL via Auth Proxy
DATABASE_URL=postgresql://dataduca_user:<SENHA>@localhost:5433/dataduca

# Para usar o banco local, comente a linha acima e descomente abaixo:
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=dataduca
# DB_USER=postgres
# DB_PASSWORD=123
```

O backend suporta dois modos de conexão:
- **`DATABASE_URL`** (prioridade): string de conexão completa, usada com o Cloud SQL.
- **Variáveis individuais** (`DB_HOST`, `DB_PORT`, etc.): usadas com PostgreSQL local.

---

## Custos

A instância `db-f1-micro` custa ~USD 7-10/mês quando ligada 24h. Como desligamos quando não está em uso, o custo efetivo depende das horas de uso:

| Uso | Custo estimado/mês |
|---|---|
| 24h/dia (sempre ligado) | ~USD 8-12 |
| ~8h/dia, dias úteis (~160h) | ~USD 2-4 |
| Desligado | ~USD 0.09 (só armazenamento HDD 10GB) |

---

## Comandos gcloud úteis

```bash
# Listar instâncias
gcloud sql instances list --project=dataduca

# Ver detalhes da instância
gcloud sql instances describe dataduca-db --project=dataduca

# Conectar direto via gcloud (sem proxy)
gcloud sql connect dataduca-db --user=dataduca_user --database=dataduca

# Ligar instância manualmente
gcloud sql instances patch dataduca-db --activation-policy=ALWAYS --project=dataduca

# Desligar instância manualmente
gcloud sql instances patch dataduca-db --activation-policy=NEVER --project=dataduca
```

---

## Migração de dados

A migração inicial foi feita com `pg_dump` / `pg_restore`:

```bash
# Dump do banco local
pg_dump -U postgres -h localhost -p 5432 -d dataduca -F c -f dataduca_backup.dump

# Restore no Cloud SQL (com proxy rodando na porta 5433)
pg_restore -h 127.0.0.1 -p 5433 -U dataduca_user -d dataduca -F c --no-owner --no-privileges dataduca_backup.dump
```

### Tabelas migradas

| Tabela | Registros |
|---|---|
| `users` | 2 |
| `activities` | 3 |
| `activity_sessions` | 170 |
| `user_sessions` | 13 |
| `documents` | 3 |
| `activity_params` | 19 |
| `user_activity_params` | 34 |

---

## Próximos passos (quando for deployar o backend)

Para conectar de serviços externos como Render, Railway, etc.:

1. Habilitar IP público (já habilitado: `34.95.137.196`).
2. Autorizar o IP do serviço de hospedagem:
   ```bash
   gcloud sql instances patch dataduca-db --assign-ip --authorized-networks=<IP_DO_RENDER>/32
   ```
3. Configurar `DATABASE_URL` no serviço apontando para o IP público com `?sslmode=require`.
4. Alternativa mais segura: usar o Cloud SQL Auth Proxy como sidecar no container de deploy.
