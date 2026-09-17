import { NextResponse } from "next/server";
import { exigirAdmin } from "@/lib/auth/guarda";
import { processarNotificacoesVencimento } from "@/lib/notificacoes-vencimento";

export async function POST() {
  const guarda = await exigirAdmin();
  if (guarda.erro) return guarda.erro;
  const resultado = await processarNotificacoesVencimento();
  return NextResponse.json({ ok: true, ...resultado });
}
