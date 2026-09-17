# FluxoMed Maricá — plataforma com acesso por usuário

Projeto **independente**. Não compartilha servidor, banco nem credencial com
nenhum outro sistema desta máquina.

O que já funciona de ponta a ponta:

1. Você cadastra a pessoa pelo e-mail pessoal.
2. Ela recebe um e-mail com **botão para o sistema** e uma **senha provisória**.
3. Ela entra com a senha provisória.
4. O sistema **obriga** a definir uma senha própria antes de qualquer tela.
5. A senha provisória deixa de valer e ela passa a usar a plataforma.

---

## Começar

```bash
cd FLUXOMED-SAAS
npm install
```

Crie o `.env.local` a partir do `.env.example`. O `JWT_SECRET` precisa ser
aleatório e ter 32+ caracteres:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Crie o banco e o primeiro administrador:

```bash
npx prisma db push
npm run criar-admin -- "Seu Nome" seu@email.com
```

A senha provisória do administrador aparece **uma vez** no terminal. Anote.

```bash
npm run dev
```

Abra <http://localhost:3100>.

---

## Envio de e-mail

Enquanto o SMTP não estiver preenchido no `.env.local`, **nada é enviado** —
e o sistema não finge que foi. A mensagem é gravada em `.outbox/` e a tela de
Usuários mostra a senha provisória para você repassar à mão.

Para ativar o envio de verdade, preencha no `.env.local`:

```
SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_REMETENTE
```

Serve qualquer provedor SMTP. Se o domínio for próprio, configure SPF e DKIM
no DNS — sem isso o convite cai na caixa de spam.

**As credenciais são suas.** Preencha você mesmo; elas não devem passar por
mais ninguém, nem por mim.

---

## Como o acesso é protegido

| Camada | O que faz |
|---|---|
| `bcrypt`, 12 rodadas | A senha nunca é gravada; só o hash. |
| Cookie `httpOnly` | A sessão não é legível por JavaScript — um XSS não a rouba. |
| JWT assinado | O conteúdo do cookie não pode ser forjado sem o `JWT_SECRET`. |
| Sessão conferida no banco | O token diz **qual** sessão é; quem a pessoa é hoje e o que ela pode hoje vêm sempre da linha do banco. Inativar alguém, rebaixar o perfil ou revogar a sessão vale na requisição seguinte — não daqui a sete dias, quando o token vencesse. |
| `middleware.ts` | Barra as páginas: sem sessão vai para `/login`; com troca pendente, só `/primeiro-acesso`. |
| `lib/auth/guarda.ts` | Barra as rotas de API, inclusive para quem ainda não trocou a senha provisória. |
| Tabela `Sessao` | Guarda o **hash** do token entregue. Sair revoga só aquela sessão; trocar ou redefinir a senha derruba todas as outras. |
| `RegistroAcesso` | Trilha de login, logout, convite e troca de senha. Nunca guarda senha. |
| Recusa genérica | "E-mail ou senha inválidos" é a mesma resposta para e-mail inexistente, senha errada e conta inativa — não entrega quem existe. |

Perfis: **ADMIN** (cadastra usuários), **OPERADOR** (usa), **LEITURA** (consulta).

---

## Banco

O projeto está configurado para **PostgreSQL**, adequado ao Supabase e à Vercel.
Defina `DATABASE_URL` com a conexão do Postgres hospedado. Para uma base Supabase
que já contenha outras tabelas, prefira executar `prisma/supabase-bootstrap.sql`: ele
cria somente as tabelas do FluxoMed e não remove estruturas existentes.

---

## Motor financeiro

Já portado e rodando sobre o banco: as regras de custo, nota fiscal, recibo,
resultado por competência e fluxo de caixa. São as mesmas do `fluxomed_v2.html`,
não uma reescrita.

```bash
npm run testar              # motor (57) + integração contra o banco (30)
npm run testar-motor        # regras puras e leitura de valores digitados
npm run testar-integracao    # do cadastro ao Balanço, gravando de verdade
```

O teste de integração cria tudo com prefixo `TESTE_`, mede **por diferença**
sobre o que já existe no banco e apaga o que criou. Roda com o banco cheio ou
vazio, e não encosta no saldo inicial do usuário.

Com o servidor no ar em outro terminal:

```bash
npm run dev
npm run testar-permissoes   # 43 verificações de quem pode o quê
```

Esse cobre o que não dá para ver na tela: rota por rota sem sessão, com senha
provisória pendente, com perfil de leitura, e o que acontece com uma sessão já
aberta quando o administrador rebaixa, inativa ou redefine a senha da pessoa.

As duas regras que mais importam e foram preservadas:

- **Estorno neutraliza, não apaga.** O lançamento original continua no
  histórico; o líquido é NORMAL menos REVERSAL, e nunca fica negativo.
- **Caixa classifica pela direção do dinheiro.** Estorno de pagamento de custo
  é dinheiro voltando: ENTRA no caixa, mesmo reduzindo despesa no resultado.

### Telas

| Tela | O que faz |
|---|---|
| Visão Geral | Indicadores da competência, caixa e composição do resultado. |
| Custos | Lançar, pagar, estornar; histórico completo de cada custo. |
| Medições | Registrar a execução e o valor medido. Medição **não** é receita nem caixa. |
| Notas Fiscais | Emitir a partir de uma medição ou avulsa; receber em parcelas; estornar. |
| Recibos | Mesma mecânica das notas, com o vocabulário de recibo. |
| Fluxo de Caixa | Realizado, previsto e consolidado; saldo inicial; filtro por período. |
| Balancete | Resultado gerencial da competência, com o detalhamento por documento. |
| Balanço | Visão anual mês a mês, com link para o balancete de cada mês. |
| Clientes / Categorias | Cadastro com ativar e inativar. |
| Usuários | Convidar, mudar perfil, inativar, reativar, redefinir senha. |

Lançar e estornar usam o **mesmo painel** em Custos, Notas e Recibos: a
mecânica é a mesma nos três, e duas telas diferentes para a mesma regra é o
caminho mais curto para as duas divergirem.

## O que ainda NÃO está aqui

- **Migração do `localStorage`.** Por decisão sua, não há importador: o banco
  começa limpo.
- **SMTP real.** É opcional e depende das credenciais do provedor de e-mail.
- **Credenciais da Vercel/Supabase.** Não ficam no código; devem ser cadastradas como variáveis de ambiente.
- **Balanço Patrimonial contábil.** O sistema não estrutura Ativo, Passivo e
  Patrimônio Líquido, e a tela diz isso em cima.

---

## Estrutura

```
prisma/schema.prisma            contas, sessões, trilha e todo o financeiro
scripts/criar-admin.ts          primeiro administrador
scripts/testar-motor.ts         regras puras
scripts/testar-integracao.ts    do cadastro ao Balanço, contra o banco
scripts/testar-permissoes.ts    quem pode o quê, contra o servidor

src/lib/auth/senha.ts           hash, verificação, senha provisória
src/lib/auth/sessao.ts          JWT + cookie httpOnly, conferido no banco
src/lib/auth/guarda.ts          proteção das rotas de API
src/lib/email.ts                envio SMTP + caixa de saída local
src/lib/validacao.ts            mensagens de erro em português
src/lib/ui.ts                   formatação e leitura de valores em pt-BR
src/lib/financeiro/motor.ts     as regras, sem banco nenhum
src/lib/financeiro/eventos.ts   lançamento e estorno, escritos uma vez
src/lib/financeiro/dados.ts     carrega a base do banco para o motor
src/middleware.ts               proteção das páginas

src/components/CascaInterna.tsx     menu lateral, que vira gaveta no celular
src/components/PainelEventos.tsx    histórico e estorno de Custos/Notas/Recibos
src/components/GerenciarDocumentos.tsx  Notas e Recibos no mesmo componente
src/components/GerenciarCadastro.tsx    Clientes e Categorias
src/components/ModalConfirmacao.tsx     toda pergunta de "tem certeza?"

src/app/(publico)/login             tela de acesso
src/app/(publico)/primeiro-acesso   troca obrigatória
src/app/(interno)/*                 as onze telas
src/app/api/auth/*                  login, logout, trocar-senha, encerrar
src/app/api/usuarios/*              convidar, alterar perfil, redefinir senha
src/app/api/{custos,medicoes,notas,recibos,clientes,categorias,fluxo-caixa}
```
