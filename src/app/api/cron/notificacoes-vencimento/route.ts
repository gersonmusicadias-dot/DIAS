import { NextResponse } from "next/server";
import { processarNotificacoesVencimento } from "@/lib/notificacoes-vencimento";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return NextResponse.json({ erro: "CRON_SECRET não configurado." }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }
  const resultado = await processarNotificacoesVencimento();
  return NextResponse.json({ ok: true, ...resultado });
}
