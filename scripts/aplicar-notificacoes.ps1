$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)

$linhas = @()
if (Test-Path '.env') { $linhas += Get-Content '.env' }
if (Test-Path '.env.local') { $linhas += Get-Content '.env.local' }

$direta = $linhas |
  Where-Object { $_ -match '^DIRECT_URL=' } |
  Select-Object -Last 1

if (-not $direta) {
  throw 'DIRECT_URL não encontrada em .env ou .env.local.'
}

$url = ($direta -replace '^DIRECT_URL=', '').Trim('"')
Get-Content '.\prisma\manual\20260908_notificacoes_financeiras.sql' -Raw |
  npx.cmd prisma db execute --url "$url" --stdin

if ($LASTEXITCODE -ne 0) {
  throw 'Não foi possível criar a estrutura de notificações.'
}

npx.cmd prisma generate
if ($LASTEXITCODE -ne 0) {
  throw 'A tabela foi criada, mas o Prisma Client não pôde ser atualizado.'
}

Write-Host 'Notificações financeiras instaladas com sucesso.' -ForegroundColor Green
