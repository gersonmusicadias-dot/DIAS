import { NextResponse } from "next/server";
import { z } from "zod";
import { mensagemDeValidacao } from "@/lib/validacao";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";
import { exigirAdmin } from "@/lib/auth/guarda";
import { gerarHash, gerarSenhaProvisoria } from "@/lib/auth/senha";
import { enviarEmail, emailDeConvite } from "@/lib/email";

export async function GET() {
  const guarda = await exigirAdmin();
  if (guarda.erro) return guarda.erro;

  const usuarios = await prisma.usuario.findMany({
    orderBy: [{ ativo: "desc" }, { nome: "asc" }],
    // O hash da senha nunca sai do servidor.
    select: {
      id: true, nome: true, email: true, papel: true, ativo: true,
      trocarSenha: true, ultimoAcesso: true, convidadoEm: true, criadoEm: true,
    },
  });
  return NextResponse.json({ usuarios });
}

const convite = z.object({
  nome: z.string().min(2, "Informe o nome completo."),
  email: z.string().email("E-mail inválido."),
  papel: z.enum(["ADMIN", "OPERADOR", "LEITURA"]).default("OPERADOR"),
});

export async function POST(req: Request) {
  const guarda = await exigirAdmin();
  if (guarda.erro) return guarda.erro;

  const dados = convite.safeParse(await req.json().catch(() => null));
  if (!dados.success) {
    return NextResponse.json(
      { erro: mensagemDeValidacao(dados.error) },
      { status: 400 }
    );
  }

  const email = dados.data.email.toLowerCase().trim();
  if (await prisma.usuario.findUnique({ where: { email } })) {
    return NextResponse.json({ erro: "Já existe um usuário com este e-mail." }, { status: 409 });
  }

  // A senha provisória existe em texto claro só dentro desta função: vai
  // para o e-mail e para a resposta, e o que fica no banco é o hash.
  const senhaProvisoria = gerarSenhaProvisoria();

  const usuario = await prisma.usuario.create({
    data: {
      nome: dados.data.nome.trim(),
      email,
      senhaHash: await gerarHash(senhaProvisoria),
      papel: dados.data.papel,
      trocarSenha: true,
      convidadoEm: new Date(),
      convidadoPor: guarda.sessao.email,
    },
    select: { id: true, nome: true, email: true, papel: true, ativo: true, criadoEm: true },
  });

  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3100";
  const envio = await enviarEmail(
    email,
    "Seu acesso ao FluxoMed Maricá",
    emailDeConvite(usuario.nome, senhaProvisoria, `${base}/login?email=${encodeURIComponent(email)}`)
  );

  await prisma.registroAcesso.create({
    data: {
      email,
      acao: "convite",
      sucesso: envio.enviado,
      detalhe: envio.enviado ? "e-mail enviado" : envio.motivo,
    },
  });

  await registrarAuditoria({
    sessao: guarda.sessao, modulo: "Usuários", acao: "criar", registroId: usuario.id,
    descricao: `Usuário ${usuario.nome} cadastrado com perfil ${usuario.papel}.`,
    depois: { id: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel, ativo: usuario.ativo },
  });

  return NextResponse.json({
    ok: true,
    usuario,
    emailEnviado: envio.enviado,
    motivoEmail: envio.motivo,
    // Devolvida para o administrador poder repassar quando o envio não
    // aconteceu. Não fica gravada em lugar nenhum.
    senhaProvisoria: envio.enviado ? undefined : senhaProvisoria,
  });
}
