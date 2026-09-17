import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirAdmin } from "@/lib/auth/guarda";

export async function GET() {
  const guarda = await exigirAdmin();
  if (guarda.erro) return guarda.erro;

  const [acessos, auditorias] = await Promise.all([
    prisma.registroAcesso.findMany({
      orderBy: { criadoEm: "desc" },
      take: 250,
    }),
    prisma.logAuditoria.findMany({
      orderBy: { criadoEm: "desc" },
      take: 250,
    }),
  ]);

  const eventos = [
    ...acessos.map((item) => ({
      id: `acesso-${item.id}`,
      tipo: "acesso",
      criadoEm: item.criadoEm,
      usuario: item.email,
      email: item.email,
      modulo: "Acesso",
      acao: item.acao,
      sucesso: item.sucesso,
      descricao: item.detalhe,
      registroId: null,
      antes: null,
      depois: null,
      ip: item.ip,
    })),
    ...auditorias.map((item) => ({
      id: `auditoria-${item.id}`,
      tipo: "auditoria",
      criadoEm: item.criadoEm,
      usuario: item.usuarioNome ?? item.usuarioEmail ?? "Usuário não identificado",
      email: item.usuarioEmail,
      modulo: item.modulo,
      acao: item.acao,
      sucesso: true,
      descricao: item.descricao,
      registroId: item.registroId,
      antes: item.antes,
      depois: item.depois,
      ip: item.ip,
    })),
  ].sort((a, b) => b.criadoEm.getTime() - a.criadoEm.getTime());

  return NextResponse.json({ eventos: eventos.slice(0, 250) });
}
