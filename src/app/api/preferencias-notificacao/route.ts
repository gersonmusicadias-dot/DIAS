import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sessaoAtual } from "@/lib/auth/sessao";

const entrada = z.object({
  receberEmail: z.boolean(),
  notificarPagar: z.boolean(),
  notificarReceber: z.boolean(),
  notificarVencidos: z.boolean(),
});

export async function GET() {
  const sessao = await sessaoAtual();
  if (!sessao) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });

  const pref = await prisma.preferenciaNotificacao.findUnique({
    where: { usuarioId: sessao.sub },
  });

  return NextResponse.json({
    email: pref?.emailNotificacao || sessao.email,
    receberEmail: pref?.receberEmail ?? false,
    notificarPagar: pref?.notificarPagar ?? true,
    notificarReceber: pref?.notificarReceber ?? true,
    notificarVencidos: pref?.notificarVencidos ?? true,
  });
}

export async function PUT(req: Request) {
  const sessao = await sessaoAtual();
  if (!sessao) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });

  const dados = entrada.safeParse(await req.json().catch(() => null));
  if (!dados.success) return NextResponse.json({ erro: "Preferências inválidas." }, { status: 400 });

  const pref = await prisma.preferenciaNotificacao.upsert({
    where: { usuarioId: sessao.sub },
    create: {
      usuarioId: sessao.sub,
      emailNotificacao: sessao.email,
      ...dados.data,
    },
    update: {
      emailNotificacao: sessao.email,
      ...dados.data,
    },
  });

  return NextResponse.json({ ok: true, preferencias: pref });
}
