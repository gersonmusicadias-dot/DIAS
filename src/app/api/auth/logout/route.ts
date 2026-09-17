import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { limparCookie, revogarSessao, sessaoAtual } from "@/lib/auth/sessao";

export async function POST() {
  const sessao = await sessaoAtual();
  if (sessao) {
    // Revoga ESTA sessão, não todas: sair no computador do escritório não
    // deve derrubar a sessão do celular.
    await revogarSessao(sessao.sid);
    await prisma.registroAcesso.create({
      data: { email: sessao.email, acao: "logout", sucesso: true },
    });
  }
  await limparCookie();
  return NextResponse.json({ ok: true });
}
