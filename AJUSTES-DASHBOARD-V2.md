# FluxoMed Maricá — Dashboard V2

Atualização visual e estrutural do painel, mantendo as regras financeiras e os dados reais.

## Alterações
- Dashboard reorganizado conforme a referência visual aprovada.
- KPIs essenciais restaurados: saldo em caixa, entradas realizadas, saídas realizadas, a receber e vencidos.
- Resumo da competência e posição projetada.
- Tabelas de receitas e custos.
- Contas a receber e contas a pagar.
- Projeção de caixa por competência.
- Sidebar compactada para eliminar o grande espaço vazio entre menus e usuário.
- Preferências de notificação incluídas no menu Sistema.
- Preferências persistidas no banco por usuário.
- Nenhuma regra de pagamento/recebimento foi removida ou substituída.

## Banco
Foi adicionada a tabela `PreferenciaNotificacao` de forma aditiva, sem apagar dados existentes.

## Após copiar a atualização
Execute:

```powershell
npx.cmd prisma generate
npm.cmd run build
npm.cmd run dev
```
