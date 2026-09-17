import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirSessao } from "@/lib/auth/guarda";

export const dynamic = "force-dynamic";

export async function GET() {
  const guarda = await exigirSessao();
  if (guarda.erro) return guarda.erro;

  const [notificacoes, naoLidas] = await Promise.all([
    prisma.notificacaoFinanceira.findMany({
      where: { usuarioId: guarda.sessao.sub },
      orderBy: { criadoEm: "desc" },
      take: 50,
    }),
    prisma.notificacaoFinanceira.count({ where: { usuarioId: guarda.sessao.sub, lidaEm: null } }),
  ]);

  return NextResponse.json({ notificacoes, naoLidas });
}

const marcar = z.object({ id: z.string().optional(), todos: z.boolean().optional() }).refine((d) => Boolean(d.id || d.todos));

export async function PATCH(req: Request) {
  const guarda = await exigirSessao();
  if (guarda.erro) return guarda.erro;
  const dados = marcar.safeParse(await req.json().catch(() => null));
  if (!dados.success) return NextResponse.json({ erro: "Solicitação inválida." }, { status: 400 });

  const agora = new Date();
  if (dados.data.todos) {
    await prisma.notificacaoFinanceira.updateMany({ where: { usuarioId: guarda.sessao.sub, lidaEm: null }, data: { lidaEm: agora } });
  } else {
    await prisma.notificacaoFinanceira.updateMany({ where: { id: dados.data.id, usuarioId: guarda.sessao.sub }, data: { lidaEm: agora } });
  }
  return NextResponse.json({ ok: true });
}
