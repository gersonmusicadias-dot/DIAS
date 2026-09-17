import { prisma } from "@/lib/prisma";
import type { Sessao } from "@/lib/auth/sessao";

type DadosAuditoria = {
  sessao: Sessao;
  modulo: string;
  acao: string;
  registroId?: string | null;
  descricao?: string | null;
  antes?: unknown;
  depois?: unknown;
  ip?: string | null;
};

function serializar(valor: unknown): string | undefined {
  if (valor === undefined || valor === null) return undefined;

  try {
    return JSON.stringify(valor);
  } catch {
    return String(valor);
  }
}

/**
 * Registra uma alteração relevante sem guardar senhas ou outros segredos.
 *
 * A auditoria é complementar à operação principal. Caso o registro do log
 * falhe por indisponibilidade momentânea, a alteração de negócio que já foi
 * concluída não deve ser revertida nem responder como se tivesse falhado.
 */
export async function registrarAuditoria({
  sessao,
  modulo,
  acao,
  registroId,
  descricao,
  antes,
  depois,
  ip,
}: DadosAuditoria): Promise<void> {
  try {
    await prisma.logAuditoria.create({
      data: {
        usuarioId: sessao.sub,
        usuarioNome: sessao.nome,
        usuarioEmail: sessao.email,
        modulo,
        acao,
        registroId: registroId ?? undefined,
        descricao: descricao ?? undefined,
        antes: serializar(antes),
        depois: serializar(depois),
        ip: ip ?? undefined,
      },
    });
  } catch (erro) {
    console.error("Falha ao registrar auditoria:", erro);
  }
}
