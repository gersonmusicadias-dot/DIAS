-- FluxoMed Maricá — criação aditiva das tabelas usadas pelo Prisma.
-- Seguro para executar em um projeto Supabase que já tenha outras tabelas:
-- este script NÃO remove tabelas nem dados existentes.

DO $$ BEGIN
  CREATE TYPE "Papel" AS ENUM ('ADMIN','OPERADOR','LEITURA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "TipoEvento" AS ENUM ('NORMAL','REVERSAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "Usuario" (
  "id" TEXT PRIMARY KEY,
  "nome" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "senhaHash" TEXT NOT NULL,
  "papel" "Papel" NOT NULL DEFAULT 'OPERADOR',
  "ativo" BOOLEAN NOT NULL DEFAULT TRUE,
  "trocarSenha" BOOLEAN NOT NULL DEFAULT TRUE,
  "ultimoAcesso" TIMESTAMPTZ,
  "convidadoEm" TIMESTAMPTZ,
  "convidadoPor" TEXT,
  "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Usuario_email_idx" ON "Usuario"("email");

CREATE TABLE IF NOT EXISTS "Sessao" (
  "id" TEXT PRIMARY KEY,
  "usuarioId" TEXT NOT NULL REFERENCES "Usuario"("id") ON DELETE CASCADE,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "navegador" TEXT,
  "ip" TEXT,
  "expiraEm" TIMESTAMPTZ NOT NULL,
  "revogadaEm" TIMESTAMPTZ,
  "criadaEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Sessao_usuarioId_idx" ON "Sessao"("usuarioId");
CREATE INDEX IF NOT EXISTS "Sessao_expiraEm_idx" ON "Sessao"("expiraEm");

CREATE TABLE IF NOT EXISTS "RegistroAcesso" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT NOT NULL,
  "acao" TEXT NOT NULL,
  "sucesso" BOOLEAN NOT NULL,
  "detalhe" TEXT,
  "ip" TEXT,
  "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "RegistroAcesso_email_idx" ON "RegistroAcesso"("email");
CREATE INDEX IF NOT EXISTS "RegistroAcesso_criadoEm_idx" ON "RegistroAcesso"("criadoEm");

CREATE TABLE IF NOT EXISTS "Cliente" (
  "id" TEXT PRIMARY KEY,
  "razaoSocial" TEXT NOT NULL,
  "nomeFantasia" TEXT NOT NULL,
  "cnpj" TEXT,
  "ativo" BOOLEAN NOT NULL DEFAULT TRUE,
  "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Categoria" (
  "id" TEXT PRIMARY KEY,
  "nome" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "ativa" BOOLEAN NOT NULL DEFAULT TRUE,
  "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Custo" (
  "id" TEXT PRIMARY KEY,
  "descricao" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "categoriaId" TEXT REFERENCES "Categoria"("id"),
  "competencia" TEXT NOT NULL,
  "vencimento" TEXT NOT NULL,
  "valorPrevisto" DOUBLE PRECISION NOT NULL,
  "observacoes" TEXT,
  "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Custo_competencia_idx" ON "Custo"("competencia");
CREATE INDEX IF NOT EXISTS "Custo_vencimento_idx" ON "Custo"("vencimento");

CREATE TABLE IF NOT EXISTS "PagamentoCusto" (
  "id" TEXT PRIMARY KEY,
  "custoId" TEXT NOT NULL REFERENCES "Custo"("id") ON DELETE CASCADE,
  "data" TEXT NOT NULL,
  "valor" DOUBLE PRECISION NOT NULL,
  "tipo" "TipoEvento" NOT NULL DEFAULT 'NORMAL',
  "estornoDe" TEXT,
  "motivo" TEXT,
  "observacao" TEXT,
  "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "PagamentoCusto_custoId_idx" ON "PagamentoCusto"("custoId");

CREATE TABLE IF NOT EXISTS "Medicao" (
  "id" TEXT PRIMARY KEY,
  "clienteId" TEXT NOT NULL REFERENCES "Cliente"("id"),
  "identificador" TEXT NOT NULL,
  "competencia" TEXT NOT NULL,
  "periodoInicio" TEXT NOT NULL,
  "periodoFim" TEXT NOT NULL,
  "valorPrevisto" DOUBLE PRECISION NOT NULL,
  "valorMedido" DOUBLE PRECISION,
  "dataMedicao" TEXT,
  "previsaoRecebimento" TEXT,
  "status" TEXT NOT NULL DEFAULT 'A_MEDIR',
  "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Medicao_competencia_idx" ON "Medicao"("competencia");
CREATE INDEX IF NOT EXISTS "Medicao_clienteId_idx" ON "Medicao"("clienteId");

CREATE TABLE IF NOT EXISTS "NotaFiscal" (
  "id" TEXT PRIMARY KEY,
  "clienteId" TEXT NOT NULL REFERENCES "Cliente"("id"),
  "medicaoId" TEXT REFERENCES "Medicao"("id"),
  "numero" TEXT NOT NULL,
  "competencia" TEXT NOT NULL,
  "dataEmissao" TEXT,
  "valorPrevisto" DOUBLE PRECISION NOT NULL,
  "valorNota" DOUBLE PRECISION NOT NULL,
  "previsaoRecebimento" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PREVISTA',
  "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "NotaFiscal_competencia_idx" ON "NotaFiscal"("competencia");
CREATE INDEX IF NOT EXISTS "NotaFiscal_clienteId_idx" ON "NotaFiscal"("clienteId");

CREATE TABLE IF NOT EXISTS "RecebimentoNota" (
  "id" TEXT PRIMARY KEY,
  "notaId" TEXT NOT NULL REFERENCES "NotaFiscal"("id") ON DELETE CASCADE,
  "data" TEXT NOT NULL,
  "valor" DOUBLE PRECISION NOT NULL,
  "tipo" "TipoEvento" NOT NULL DEFAULT 'NORMAL',
  "estornoDe" TEXT,
  "motivo" TEXT,
  "observacao" TEXT,
  "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "RecebimentoNota_notaId_idx" ON "RecebimentoNota"("notaId");

CREATE TABLE IF NOT EXISTS "Recibo" (
  "id" TEXT PRIMARY KEY,
  "clienteId" TEXT NOT NULL REFERENCES "Cliente"("id"),
  "medicaoId" TEXT REFERENCES "Medicao"("id"),
  "identificador" TEXT NOT NULL,
  "descricao" TEXT NOT NULL,
  "origem" TEXT NOT NULL DEFAULT 'AVULSO',
  "competencia" TEXT NOT NULL,
  "dataEmissao" TEXT,
  "valorPrevisto" DOUBLE PRECISION NOT NULL,
  "valorRecibo" DOUBLE PRECISION NOT NULL,
  "previsaoRecebimento" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PREVISTO',
  "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Recibo_competencia_idx" ON "Recibo"("competencia");
CREATE INDEX IF NOT EXISTS "Recibo_clienteId_idx" ON "Recibo"("clienteId");

CREATE TABLE IF NOT EXISTS "RecebimentoRecibo" (
  "id" TEXT PRIMARY KEY,
  "reciboId" TEXT NOT NULL REFERENCES "Recibo"("id") ON DELETE CASCADE,
  "data" TEXT NOT NULL,
  "valor" DOUBLE PRECISION NOT NULL,
  "tipo" "TipoEvento" NOT NULL DEFAULT 'NORMAL',
  "estornoDe" TEXT,
  "motivo" TEXT,
  "observacao" TEXT,
  "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "RecebimentoRecibo_reciboId_idx" ON "RecebimentoRecibo"("reciboId");

CREATE TABLE IF NOT EXISTS "SaldoCaixa" (
  "id" TEXT PRIMARY KEY,
  "valor" DOUBLE PRECISION NOT NULL,
  "dataReferencia" TEXT NOT NULL,
  "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Preferências individuais de alertas e notificações por e-mail.
CREATE TABLE IF NOT EXISTS "PreferenciaNotificacao" (
  "id" TEXT PRIMARY KEY,
  "usuarioId" TEXT NOT NULL UNIQUE REFERENCES "Usuario"("id") ON DELETE CASCADE,
  "emailNotificacao" TEXT,
  "receberEmail" BOOLEAN NOT NULL DEFAULT FALSE,
  "notificarPagar" BOOLEAN NOT NULL DEFAULT TRUE,
  "notificarReceber" BOOLEAN NOT NULL DEFAULT TRUE,
  "notificarVencidos" BOOLEAN NOT NULL DEFAULT TRUE,
  "criadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "PreferenciaNotificacao_usuarioId_idx" ON "PreferenciaNotificacao"("usuarioId");
