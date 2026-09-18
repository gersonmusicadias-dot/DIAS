import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirSessao } from "@/lib/auth/guarda";
import { enviarEmail } from "@/lib/email";

export const runtime = "nodejs";

// Envia um e-mail de teste só para o endereço de notificação do próprio
// usuário logado, para conferir na prática se o SMTP de produção funciona.
export async function POST() {
  const guarda = await exigirSessao();
  if (guarda.erro) return guarda.erro;
  const sessao = guarda.sessao;

  const pref = await prisma.preferenciaNotificacao.findUnique({ where: { usuarioId: sessao.sub } });
  const para = pref?.emailNotificacao || sessao.email;

  const html = `
  <div style="font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#0d2440;font-size:14px;line-height:1.6;max-width:520px">
    <p><strong>FluxoMed Maricá</strong></p>
    <p>Este é um e-mail de teste. Se você o recebeu, o envio automático de avisos de vencimento está funcionando para este endereço.</p>
    <p style="color:#6b8299;font-size:12px">Mensagem automática, não responda a este e-mail.</p>
  </div>`;

  const envio = await enviarEmail(para, "[FluxoMed] E-mail de teste", html);
  if (!envio.enviado) {
    return NextResponse.json({ ok: false, para, erro: envio.motivo ?? "Falha no envio." }, { status: 502 });
  }
  return NextResponse.json({ ok: true, para });
}
