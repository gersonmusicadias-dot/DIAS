# FluxoMed Maricá — publicação na Vercel

Este pacote já está preparado para Next.js + PostgreSQL (Supabase) + Vercel.

## 1. Banco Supabase

O Prisma está configurado para `postgresql`. No computador, crie `.env.local` a partir de `.env.example` e preencha `DATABASE_URL` com a conexão Postgres do Supabase.

Na primeira implantação, abra o SQL Editor do Supabase e execute **uma vez** o arquivo `prisma/supabase-bootstrap.sql`. Ele é aditivo: cria apenas as estruturas necessárias ao FluxoMed e não apaga tabelas existentes.

Depois, no projeto local:

```bash
npm install
npx prisma generate
```

Evite `prisma db push` em um projeto Supabase que já contenha tabelas de outros sistemas.

## 2. Primeiro administrador

Com o banco configurado:

```bash
npm run criar-admin -- "Gerson Dias" seu-email@dominio.com
```

A senha provisória aparece uma única vez no terminal.

## 3. Variáveis na Vercel

Em Project > Settings > Environment Variables, configure para Production, Preview e Development:

- `DATABASE_URL`
- `JWT_SECRET`
- `NEXT_PUBLIC_APP_URL` (ex.: `https://fluxomedmarica.vercel.app`)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_REMETENTE` (somente se o envio real de convites for usado)

Não envie `.env.local` para o Git/Vercel.

## 4. Publicar

Na raiz da pasta `nuvem`:

```bash
npm install
npm run build
npx vercel --prod
```

Se o projeto Vercel já existe, selecione/vincule o projeto existente quando a CLI perguntar. Não crie outro projeto com nome diferente.

## 5. Conferência pós-publicação

- `/login` abre sem erro.
- login redireciona para `/painel`.
- Dashboard carrega valores do banco.
- Custos, Medições, Notas Fiscais, Recibos, Fluxo de Caixa, Balancete e Balanço abrem.
- modo claro/escuro alterna no topo.
- menu mobile abre e fecha.
- logout encerra a sessão.

## Segurança

Sessões usam cookie `httpOnly`, JWT assinado e validação da sessão no banco. `JWT_SECRET` deve ser forte e exclusivo. O banco não deve aceitar conexão pública irrestrita fora das credenciais configuradas no servidor.
