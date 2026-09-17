# Ajustes realizados — versão pronta para Vercel

- Banco Prisma alterado de SQLite para PostgreSQL (Supabase/Vercel).
- Script SQL aditivo `prisma/supabase-bootstrap.sql` incluído para criar as tabelas sem apagar estruturas existentes.
- Dashboard modernizado com 4 KPIs, comparativo de receitas/despesas, composição de despesas, fluxo de caixa, últimos documentos e próximos vencimentos.
- Todos os indicadores usam o motor financeiro e o banco; não há valores fictícios.
- Tema claro/escuro adicionado e persistido no navegador.
- Sino/atalho de alertas adicionado ao topo.
- Identidade do usuário e perfil exibidos no topo.
- Responsividade reforçada para tablet e celular.
- Favicon FluxoMed incluído.
- `vercel.json`, Node engine e `postinstall` do Prisma configurados.
- `.env.example` atualizado para PostgreSQL/Supabase.
- Scripts administrativos corrigidos para ler `.env.local`.
- Guia `DEPLOY-VERCEL.md` incluído.
- Nenhuma regra do motor financeiro foi alterada.

## Validação feita neste ambiente

- 69 arquivos TypeScript/TSX analisados por compilação sintática: 0 erros de sintaxe.
- JSON de `package.json`, `tsconfig.json` e `vercel.json` válidos.
- O build completo não pôde ser executado aqui porque o ambiente não conseguiu concluir o download das dependências NPM; o pacote original não trazia `node_modules` completo. No computador, `npm install && npm run build` fará a validação final com as dependências instaladas.
