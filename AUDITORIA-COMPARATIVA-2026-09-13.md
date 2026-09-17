# Auditoria comparativa — FluxoMed Maricá

Data: 13/09/2026
Base analisada: `Fluxomed-atual.zip` enviado pelo usuário.

## Escopo

Foi feita uma nova revisão estática do código atual, comparando o estado encontrado com os achados da auditoria anterior que estavam identificados no histórico de trabalho. Nenhum deploy foi realizado e nenhuma alteração de banco foi executada. Em especial, **não foi usado `prisma db push`**.

## Situação dos achados anteriores

### F-06 — Impressão não verificava revogação da sessão no banco
**Situação recebida:** já corrigido no ZIP atual.

A rota `src/app/recibos/[id]/imprimir/page.tsx` chama `sessaoAtual()` antes da consulta do recibo, envia sessão inválida para `/api/auth/encerrar` e primeiro acesso para `/primeiro-acesso`. A suíte de permissões recebida também contém cenários de primeiro acesso, inatividade, inativação da conta, redefinição de senha e acesso autorizado.

**Alteração nesta rodada:** nenhuma alteração adicional na página de impressão.

### F-07 — Painel incluía recibos substituídos e sobrepunha medição com documento
**Situação recebida:** ainda havia inconsistências.

Foram corrigidos:

- recibos substituídos não entram mais na composição de receitas do painel;
- recibos substituídos não aparecem mais na lista de contas a receber;
- `carregarBase()` passou a transportar `medicaoId` de Nota Fiscal e Recibo e `origem` do Recibo;
- a linha de medição passou a representar apenas **execução ainda não documentada**, usando `saldoAFaturarDaMedicao()`;
- quando o valor da medição já virou NF/Recibo vigente, ele deixa de ser contado novamente na linha de medição;
- a linha “Recibos Avulsos” foi renomeada para “Recibos”, pois a base pode conter recibos vinculados a medição;
- a medição continua sem ser tratada como recebimento ou entrada de caixa — documento/recebimento continuam sendo os eventos financeiros.

Arquivos principais: `src/lib/financeiro/dados.ts`, `src/lib/financeiro/motor.ts`, `src/app/(interno)/painel/page.tsx`.

### F-08 — Custo Indireto também entrava em Custos Diretos
**Situação recebida:** bug confirmado no código atual.

A causa era comparação por substring (`includes("Direto")`), que também casa com `"Custo Indireto"`.

**Correção:** a classificação agora é exata:

- `Custo Direto` → Custos Diretos;
- `Custo Indireto` → Custos Indiretos;
- `Custo Fixo` → Custos Fixos.

Arquivo: `src/app/(interno)/painel/page.tsx`.

### F-09 — Card Vencidos e detalhamento usavam escopos diferentes
**Situação recebida:** bug confirmado.

O card do painel somava custos vencidos de todas as competências, enquanto o clique levava a um detalhamento restrito à competência selecionada.

**Correção:** o KPI Vencidos agora filtra também `c.competencia === competencia`, ficando coerente com o detalhamento aberto pelo próprio card.

Arquivo: `src/app/(interno)/painel/page.tsx`.

### F-10 — Estornos tinham representação incompatível no Fluxo de Caixa
**Situação recebida:** inconsistência confirmada.

O motor tentava compensar o estorno contra o movimento original para calcular Entradas/Saídas. Isso quebrava a leitura por período quando o movimento original ficava fora do filtro e o estorno dentro, além de deixar a equação dos KPIs diferente das linhas do caixa.

**Correção:** o caixa voltou a seguir exclusivamente a direção real do dinheiro:

- estorno de pagamento de custo = **entrada**;
- estorno de recebimento = **saída**;
- Entradas e Saídas são a soma bruta das linhas por sinal;
- `Estornos` é apenas indicador informativo e já está refletido em Entradas/Saídas;
- a tabela exibe o estorno também na coluna de direção correspondente, para que as linhas somem aos KPIs;
- a coluna Estorno mostra o valor absoluto apenas como identificação complementar.

Arquivos: `src/lib/financeiro/motor.ts`, `src/app/(interno)/fluxo-caixa/VerFluxoCaixa.tsx`.

### F-11
O texto/título integral do F-11 da auditoria anterior não estava dentro do ZIP recebido e não foi localizado entre os artefatos do projeto. Por isso, este relatório não atribui artificialmente um problema ao código apenas para preencher o número do finding.

A nova auditoria, porém, encontrou uma inconsistência adicional relacionada ao mesmo domínio de substituição de recibos e ela foi corrigida, conforme abaixo.

## Achado adicional da nova auditoria — recibo substituído podia reaparecer em alertas calculados pela base

`src/lib/financeiro/alertas.ts` percorria todos os recibos sem ignorar `substituido`. Isso permitia que um recibo histórico substituído voltasse a ser classificado como próximo/vencido em qualquer consumidor futuro de `alertasDaBase()`.

**Correção:** recibos substituídos são ignorados nessa camada. O serviço de notificações por banco já possuía filtro equivalente (`substituidoPor: null`), e agora as duas implementações ficam coerentes.

Foi incluído teste de regressão específico.

## Testes e validações executadas nesta rodada

### Motor financeiro
Executado em ambiente isolado, sem banco:

- **81 verificações**;
- **81 passaram**;
- **0 falharam**.

Foram adicionados testes para:

- estorno de pagamento compondo Entradas;
- estorno de recebimento compondo Saídas;
- reconciliação `Saldo inicial + Entradas - Saídas = Saldo final`;
- estorno dentro do período com movimento original fora do filtro;
- estornos como indicador informativo, sem dupla aplicação aritmética;
- recibo substituído não reaparecendo em alertas.

O resultado completo está em `RESULTADO-TESTE-MOTOR-2026-09-13.txt`.

### Verificação sintática
Foram analisados **91 arquivos `.ts`/`.tsx`** de `src` e `scripts` com o parser/transpilador TypeScript.

Resultado: **0 erros sintáticos**.

### Build / TypeScript completo / testes com banco
O ZIP foi corretamente enviado sem `node_modules` e sem `.env`, como medida de segurança. Neste ambiente de auditoria, a reinstalação completa das dependências externas não concluiu dentro da janela disponível do repositório npm. Por esse motivo, não foi possível executar aqui:

- `npm run build` completo do Next.js;
- `tsc --noEmit` completo com todas as typings do projeto;
- `testar-integracao` e `testar-permissoes`, que também dependem do `.env.local` e do banco do usuário.

Isso **não foi substituído por `prisma db push`** nem por qualquer alteração de banco. A etapa final de build e testes conectados deve ser executada no computador do usuário após aplicar o pacote, usando as dependências e credenciais locais existentes.

## Arquivos alterados nesta rodada

- `src/lib/financeiro/dados.ts`
- `src/lib/financeiro/motor.ts`
- `src/lib/financeiro/alertas.ts`
- `src/app/(interno)/painel/page.tsx`
- `src/app/(interno)/fluxo-caixa/VerFluxoCaixa.tsx`
- `scripts/testar-motor.ts`

Backups dos arquivos anteriores às alterações desta rodada foram mantidos em `backups/auditoria-20260913/`.

## Arquivos deliberadamente não alterados

- schema do Prisma;
- migrations/banco;
- autenticação já corrigida do F-06;
- páginas sem relação com os findings;
- identidade visual e CSS fora do necessário;
- deploy/Vercel.

## Próxima validação no computador do usuário

Depois de substituir os arquivos pelo pacote corrigido, a sequência recomendada é:

1. `npx.cmd prisma generate`
2. `npx.cmd tsc --noEmit`
3. `npm.cmd run testar-motor`
4. com o servidor local ativo e `.env.local` presente: `npm.cmd run testar-permissoes`
5. `npm.cmd run build`
6. `npm.cmd run start`
7. validação visual e funcional do Painel, Custos, Vencidos, Fluxo de Caixa e impressão de Recibo.

Nenhuma publicação deve ser feita antes dessa validação local.
