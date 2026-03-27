# Neon PostgreSQL — Setup e migração (Dataduca)

Este documento descreve como usar o **Neon** como banco PostgreSQL do projeto e como migrar dados a partir do **Google Cloud SQL**. O projeto migrou do GCP porque o custo para desenvolvimento era alto (da ordem de **~US$ 0,50/dia** na instância que usávamos); os scripts antigos do Cloud SQL estão em [`scripts/legacy/cloud-sql/`](../scripts/legacy/cloud-sql/README.md).

O backend ([`app/routes/auth.py`](../app/routes/auth.py)) aceita `DATABASE_URL`; não é necessário alterar código para conectar ao Neon.

---

## Fase 1 — Conta e projeto Neon

1. Crie uma conta em [Neon](https://neon.tech) e um **novo projeto**.
2. Escolha uma **região** próxima dos usuários (ex. América do Sul, se disponível; caso contrário `US East` é comum).
3. No painel do Neon, anote:
   - **Connection string (direct)** — host sem `-pooler`, para `pg_restore` e migrações.
   - **Connection string (pooled)** — com `-pooler` na URL, opcional para a aplicação em produção com muitas conexões curtas.
4. **IPv4:** se o backend estiver em um serviço que não suporta IPv6 (comum em alguns planos gratuitos de PaaS), ative o add-on **IPv4** no Neon conforme o painel indicar; sem isso a conexão pode falhar.

---

## Fase 2 — Dump a partir do Cloud SQL

Pré-requisito: instância Cloud SQL acessível (proxy local ou IP autorizado). Veja também [cloud-sql-setup.md](./cloud-sql-setup.md) (referência legada).

Com **Cloud SQL Auth Proxy** em `localhost:5433`:

**Windows (PowerShell):** com proxy rodando e `.env` contendo `DATABASE_URL` apontando para `localhost:5433` (usuário/senha do Cloud SQL):

```powershell
.\scripts\legacy\cloud-sql\pg-dump-cloudsql.ps1
```

Ou: `.\scripts\legacy\cloud-sql\pg-dump-cloudsql.cmd`

Ou manualmente:

```bash
pg_dump -h 127.0.0.1 -p 5433 -U dataduca_user -d dataduca -F c -f dataduca_neon_migration.dump
```

Opcional: repetir o dump após pausar escritas na aplicação para um cutover sem perda de dados recentes.

---

## Fase 3 — Restore no Neon

Use a connection string **direct** (não a pooled) como destino.

### Opção A — Script no repositório (Windows / PowerShell)

1. Copie [`scripts/neon-restore.env.example`](../scripts/neon-restore.env.example) para **`scripts/neon-restore.env`** (esse arquivo está no `.gitignore` e não sobe para o Git).
2. Edite `scripts/neon-restore.env` e preencha:
   - **`NEON_RESTORE_URL`**: connection string **direct** do Neon (sem `-pooler` no host).
   - **`DUMP_PATH`**: caminho do `.dump` relativo à raiz do repo (padrão `dataduca_neon_migration.dump`).
3. Coloque o arquivo `.dump` na raiz do projeto (ou ajuste `DUMP_PATH`).
4. Na **raiz** do repositório, use **um** destes:

**Recomendado (funciona mesmo com política de execução restrita e no CMD):**

```cmd
scripts\pg-restore-neon.cmd
```

Ou no PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\pg-restore-neon.ps1
```

Evite dar duplo clique em arquivos `.ps1` — no Windows eles costumam abrir no **Bloco de Notas**. Use o `.cmd` acima ou o comando `powershell ... Bypass`.

Para reexecutar em banco que já tem objetos, em `neon-restore.env` defina `PG_RESTORE_CLEAN=1`.

**Política de execução (opcional, fix permanente no seu usuário):** `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`

### Opção B — Comando manual

Primeira carga em banco vazio (sem `--clean`):

```bash
pg_restore -d "postgresql://USER:PASSWORD@ep-xxx.region.aws.neon.tech/neondb?sslmode=require" -F c --no-owner --no-privileges dataduca_neon_migration.dump
```

Substitua a URL pela que o Neon fornece (ajuste o nome do banco `neondb` / `dataduca` conforme criado no projeto).

Se precisar reexecutar sobre um banco que já tem objetos:

```bash
pg_restore --clean --if-exists -d "<DATABASE_URL_DIRECT>" -F c --no-owner --no-privileges dataduca_neon_migration.dump
```

**Validação sugerida:** conferir tabelas (`users`, `activities`, `activity_sessions`, `activity_params`, `user_activity_params`, etc.) e contagens básicas.

---

## Fase 4 — Cutover da aplicação

1. No `.env` na raiz do repositório:

```env
DATABASE_URL=postgresql://USER:PASSWORD@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
```

Mantenha `sslmode=require` (geralmente já incluído na URL do Neon).

2. Suba o backend (`uvicorn app.main:app --reload`) e teste: login, atividades, aba Gerenciar, reavaliação de níveis.
3. No **deploy** (ex.: Railway): atualize o secret `DATABASE_URL` com a URL do Neon (pooled em produção, se preferir) e faça redeploy.
4. O front só precisa de `VITE_API_BASE_URL` diferente se a URL da **API** mudar — a troca de banco não altera isso por si só.

---

## Fase 5 — Documentação e scripts legado

- A configuração ativa do banco está neste arquivo (`neon-setup.md`).
- [cloud-sql-setup.md](./cloud-sql-setup.md) permanece como referência histórica da instância Cloud SQL.
- Scripts GCP (`db-*`, `pg-dump-cloudsql`) estão em **`scripts/legacy/cloud-sql/`** — só úteis se ainda existir instância Cloud SQL; no dia a dia com Neon não são necessários.

---

## Fase 6 — Desligar custo no GCP

1. Após validar o Neon (recomendado: alguns dias a duas semanas), faça um backup final opcional do Neon:

```bash
pg_dump "postgresql://..." -F c -f dataduca_neon_backup.dump
```

2. No **Google Cloud Console**, exclua ou desative a instância Cloud SQL (`dataduca-db` no projeto `dataduca`, se ainda existir).
3. Revise faturamento GCP (armazenamento, IPs, outros recursos).

---

## Riscos e mitigações

| Risco | Mitigação |
| ----- | --------- |
| Hospedagem só IPv4 vs endpoint IPv6 do Neon | Ativar IPv4 no Neon ou usar provedor com IPv6. |
| Muitas conexões | Usar URL **pooled** na aplicação. |
| Conflitos de roles no restore | `--no-owner --no-privileges` no `pg_restore`. |
| Janela de inconsistência | Fazer dump final com app parada ou em manutenção. |

---

## Backup local a partir do Neon (rotina)

```bash
pg_dump "postgresql://USER:PASSWORD@ep-xxx.region.aws.neon.tech/neondb?sslmode=require" -F c -f dataduca_backup_$(date +%Y%m%d).dump
```

Use sempre a string **direct** para dumps longos, a menos que o Neon documente o contrário para sua região.
