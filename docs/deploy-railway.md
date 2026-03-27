# Deploy do backend no Railway (Docker)

O backend FastAPI usa o [`Dockerfile`](../Dockerfile) na raiz do repositório (`app/` + `requirements.txt`). O Railway injeta a variável **`PORT`**; o container sobe com `uvicorn` escutando nessa porta.

## Pré-requisitos

- Conta no [Railway](https://railway.app) (pode usar o mesmo projeto e adicionar **um novo serviço** ao repo).
- Banco **Neon** com `DATABASE_URL` (recomendado: URL **pooled**; **IPv4** no Neon se a conexão falhar).
- URL do **frontend** em produção (HTTPS) para `CORS_ORIGINS`.

## Passos (resumo)

1. **New project** → **Deploy from GitHub** (ou GitLab) → selecione o repositório `dataduca`.
2. Se já existir um projeto Railway, use **New** → **GitHub Repo** (ou **Empty Service** → conecte o repo) e escolha o mesmo repositório; o Railway cria **outro serviço** no mesmo projeto.
3. O Railway deve **detectar o `Dockerfile`** na raiz. Se pedir builder, escolha **Dockerfile**.
4. Em **Variables**, defina:

| Variável | Descrição |
|----------|-----------|
| `DATABASE_URL` | Connection string do Neon. |
| `JWT_SECRET_KEY` | Chave forte e aleatória. |
| `DEBUG` | `false` |
| `CORS_ORIGINS` | Origens separadas por vírgula, ex.: `https://seu-front.vercel.app` (sem `/` no final). Inclua depois a URL pública gerada pelo Railway para testar a API no browser, se necessário. |

5. **Settings** → **Networking** → **Generate domain** (HTTPS).
6. Faça o deploy e confira os logs. Health check: `GET /health`.

## Porta

O `CMD` do Dockerfile usa `uvicorn ... --port ${PORT:-8000}`. O Railway define `PORT` automaticamente — não fixe `8000` nas variáveis.

## Frontend

No build do Vite (front na **Vercel**), configure `VITE_API_BASE_URL` com a URL HTTPS desta API, **sem** barra no final. Passo a passo: [deploy-vercel.md](./deploy-vercel.md).

Depois do deploy do front, coloque o domínio da Vercel em `CORS_ORIGINS` no Railway.

O Railway **detecta automaticamente** um `Dockerfile` na raiz do repositório. Se precisar de outro caminho, defina a variável `RAILWAY_DOCKERFILE_PATH` no serviço (veja [documentação](https://docs.railway.app/builds/dockerfiles)).

## Teste local com Docker

```bash
docker build -t dataduca-api .
docker run --rm -p 8000:8000 -e PORT=8000 -e DATABASE_URL="postgresql://..." -e JWT_SECRET_KEY="..." -e DEBUG=false -e CORS_ORIGINS="http://localhost:5173" dataduca-api
```
