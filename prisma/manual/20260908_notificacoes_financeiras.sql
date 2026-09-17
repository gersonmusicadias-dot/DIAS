CREATE TABLE IF NOT EXISTS "NotificacaoFinanceira" (
  "id" TEXT NOT NULL,
  "chave" TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "direcao" TEXT NOT NULL,
  "origem" TEXT NOT NULL,
  "registroId" TEXT NOT NULL,
  "titulo" TEXT NOT NULL,
  "mensagem" TEXT NOT NULL,
  "vencimento" TEXT NOT NULL,
  "diasAntecedencia" INTEGER NOT NULL,
  "valor" DOUBLE PRECISION NOT NULL,
  "destino" TEXT NOT NULL,
  "lidaEm" TIMESTAMP(3),
  "emailEnviadoEm" TIMESTAMP(3),
  "emailErro" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificacaoFinanceira_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NotificacaoFinanceira_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "NotificacaoFinanceira_chave_key" ON "NotificacaoFinanceira"("chave");
CREATE INDEX IF NOT EXISTS "NotificacaoFinanceira_usuarioId_criadoEm_idx" ON "NotificacaoFinanceira"("usuarioId", "criadoEm");
CREATE INDEX IF NOT EXISTS "NotificacaoFinanceira_usuarioId_lidaEm_idx" ON "NotificacaoFinanceira"("usuarioId", "lidaEm");
CREATE INDEX IF NOT EXISTS "NotificacaoFinanceira_vencimento_idx" ON "NotificacaoFinanceira"("vencimento");
