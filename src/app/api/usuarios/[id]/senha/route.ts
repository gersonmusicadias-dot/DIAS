import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";
import { exigirAdmin } from "@/lib/auth/guarda";
import { gerarHash, gerarSenhaProvisoria } from "@/lib/auth/senha";
import { revogarSessoesDoUsuario } from "@/lib/auth/sessao";
import { enviarEmail, emailDeNovaSenhaProvisoria } from "@/lib/email";

/**
 * Reemite a senha provisória de alguém que perdeu a sua.
 *
 * A senha antiga deixa de valer no mesmo instante, e todas as sessões
 * abertas caem — inclusive a de quem porventura estivesse usando a conta
 * indevidamente. É essa a razão de existir do botão.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guarda = await exigirAdmin();
  if (guarda.erro) return guarda.erro;

  const { id } = await ctx.params;
  const alvo = await prisma.usuario.findUnique({ where: { id } });
  if (!alvo) return NextResponse.json({ erro: "Usuário não encontrado." }, { status: 404 });

  if (alvo.id === guarda.sessao.sub) {
    return NextResponse.json(
      { erro: "Para trocar a sua própria senha use a tela de senha, não a redefinição." },
      { status: 400 }
    );
  }
  if (!alvo.ativo) {
    return NextResponse.json(
      { erro: "Conta inativa. Reative antes de enviar uma nova senha." },
      { status: 400 }
    );
  }

  const senhaProvisoria = gerarSenhaProvisoria();
  await prisma.usuario.update({
    where: { id },
    data: { senhaHash: await gerarHash(senhaProvisoria), trocarSenha: true },
  });
  await revogarSessoesDoUsuario(alvo.id);

  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3100";
  const envio = await enviarEmail(
    alvo.email,
    "Nova senha provisória — FluxoMed Maricá",
    emailDeNovaSenhaProvisoria(
      alvo.nome,
      senhaProvisoria,
      `${base}/login?email=${encodeURIComponent(alvo.email)}`
    )
  );

  await prisma.registroAcesso.create({
    data: {
      email: alvo.email,
      acao: "senha-redefinida",
      sucesso: true,
      detalhe: `por ${guarda.sessao.email}${envio.enviado ? "; e-mail enviado" : "; " + (envio.motivo ?? "e-mail não enviado")}`,
    },
  });

  await registrarAuditoria({
    sessao: guarda.sessao, modulo: "Usuários", acao: "redefinir-senha", registroId: alvo.id,
    descricao: `Nova senha provisória gerada para ${alvo.nome}.`,
    depois: { id: alvo.id, nome: alvo.nome, email: alvo.email, trocarSenha: true, emailEnviado: envio.enviado },
  });

  return NextResponse.json({
    ok: true,
    emailEnviado: envio.enviado,
    motivoEmail: envio.motivo,
    // Só volta quando o envio não aconteceu, para o administrador repassar.
    senhaProvisoria: envio.enviado ? undefined : senhaProvisoria,
  });
}
