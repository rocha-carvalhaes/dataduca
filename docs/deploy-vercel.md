# Deploy do frontend na Vercel

O front é **Vite + React** na pasta [`frontend/`](../frontend). A URL da API vem de **`VITE_API_BASE_URL`** ([`frontend/src/config/api.js`](../frontend/src/config/api.js)).

## Pré-requisitos

- Conta [Vercel](https://vercel.com) e repositório no GitHub (o mesmo do backend).
- URL **HTTPS** da API no Railway (ex.: `https://seu-servico.up.railway.app` — **sem** barra no final).

## Passos

1. Acesse [vercel.com/new](https://vercel.com/new) e **Import** o repositório `dataduca`.

2. **Configure o projeto:**
   - **Root Directory:** `frontend`  
     (obrigatório: o `package.json` do Vite está dentro de `frontend/`, não na raiz do monorepo.)
   - **Framework Preset:** Vite (geralmente detectado sozinho).
   - **Build Command:** `npm run build` (padrão).
   - **Output Directory:** `dist` (padrão do Vite).

3. **Environment Variables** (Production / Preview):
   - `VITE_API_BASE_URL` = URL **completa** do backend, **obrigatoriamente** com `https://` no início e **sem** `/` no final.  
     Ex.: `https://dataduca-production.up.railway.app`  
     **Não** use só o hostname (`dataduca-production.up.railway.app`): o navegador interpreta como caminho no site da Vercel e o login quebra (405).

4. Faça **Deploy**. A cada push na branch conectada, a Vercel gera novo build.

5. **CORS no backend (Railway):** em `CORS_ORIGINS`, inclua a URL do front na Vercel, ex.:  
   `https://dataduca.vercel.app`  
   (copie o domínio exato em **Project → Settings → Domains**.)

6. Se mudar o domínio ou a API depois, atualize `VITE_API_BASE_URL` na Vercel e **redeploy** (ou novo commit).

## Teste local com URL de produção

Na pasta `frontend/`:

```bash
cp .env.example .env
# Edite .env: VITE_API_BASE_URL=https://sua-api.railway.app
npm run build && npm run preview
```

## Arquivos úteis

- [`frontend/vercel.json`](../frontend/vercel.json) — rewrites para SPA (evita 404 em rotas futuras com React Router).
