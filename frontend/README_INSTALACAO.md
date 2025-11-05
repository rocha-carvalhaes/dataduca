# Instruções de Instalação - Resolvendo Erro do PowerShell

## Problema
Se você recebeu o erro sobre política de execução do PowerShell ao tentar executar `npm install`, siga uma das soluções abaixo.

## Solução 1: Alterar Política de Execução (Recomendada)

### Opção A: Para a sessão atual apenas (mais seguro)
Execute no PowerShell:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Opção B: Para o usuário atual permanentemente
Execute no PowerShell como Administrador:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

## Solução 2: Usar Command Prompt (CMD)
Se preferir não alterar a política do PowerShell:

1. Abra o **Command Prompt** (cmd) em vez do PowerShell
2. Navegue até a pasta frontend:
   ```cmd
   cd C:\Users\Gabriel.Oliveira\Documents\projetos\dataduca\frontend
   ```
3. Execute:
   ```cmd
   npm install
   ```

## Solução 3: Usar PowerShell com bypass temporário
Execute este comando diretamente no PowerShell (sem abrir como admin):
```powershell
powershell -ExecutionPolicy Bypass -Command "cd frontend; npm install"
```

## Após a instalação
Depois de resolver o problema e instalar as dependências, execute:
```bash
npm run dev
```

