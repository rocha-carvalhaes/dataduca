# Desenvolvimento local

Rodar **API (FastAPI)** + **front (Vite)** no seu computador. O banco recomendado é o **Neon** (Postgres na nuvem, sem Docker).

## Pré-requisitos

- **Python 3.11+** e **Node.js 18+**
- Conta no **[Neon](https://neon.tech)** (plano gratuito disponível)

---

## 1. Neon — projeto e schema

1. Crie um **projeto** no Neon e um banco (o nome padrão costuma ser `neondb`).
2. Em **Dashboard → Connection string**, copie a URI (formato `postgresql://...`). Cole em **`DATABASE_URL`** no `.env` da raiz (veja [`.env.example`](../.env.example)).
3. Abra **SQL Editor** no Neon, cole o conteúdo inteiro de [`db/schema.sql`](../db/schema.sql) e execute (cria tabelas no banco).

Migrações, IPv4 e restore de dumps: [neon-setup.md](./neon-setup.md).

---

## 2. Variáveis da API (raiz)

```powershell
Copy-Item .env.example .env
```

Edite `.env` e defina **`DATABASE_URL`** com a URI do Neon (painel **Connection string**).

### Mesmo banco que produção (fase sem usuários)

Se ninguém usa o app ainda, pode usar **a mesma** `DATABASE_URL` que o **Railway** já usa (copie em **Railway → serviço da API → Variables → `DATABASE_URL`**, ou a mesma URI no painel do Neon). Assim o `uvicorn` local lê e grava nos **mesmos dados** que produção.

**Cuidados:**

- **Não rode** [`db/schema.sql`](../db/schema.sql) no SQL Editor se já houver dados que você queira manter — o script apaga o schema `public`.
- Quando houver usuários reais, vale **separar** dev (branch ou projeto Neon) para não arriscar dados de produção.
- **`JWT_SECRET_KEY`** no `.env` local pode ser diferente da produção: tokens emitidos pelo seu PC só valem na API local; senhas de usuário vêm do banco e continuam iguais nos dois ambientes.

O front local continua com `VITE_API_BASE_URL=http://127.0.0.1:8000` para falar com a **API na sua máquina**, que por sua vez usa esse `DATABASE_URL` compartilhado.

---

## 3. Backend

```powershell
cd C:\caminho\para\dataduca
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- API: [http://127.0.0.1:8000](http://127.0.0.1:8000)
- Swagger: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

---

## 4. Frontend

Em outro terminal:

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

`VITE_API_BASE_URL=http://127.0.0.1:8000` aponta a API local.

- App: [http://localhost:5173](http://localhost:5173)

---

## 5. Primeiro usuário

Com o banco vazio, o primeiro cadastro pode ser feito **sem** login:

- `POST /api/users/` no Swagger (`/docs`).

Campos típicos: `user_name`, `user_type` (ex.: `administrador`), `password`.

---

## Outras opções de banco (opcional)

- **PostgreSQL instalado no Windows** — use `DATABASE_URL` com `127.0.0.1:5432` e rode `db/schema.sql` com `psql`.
