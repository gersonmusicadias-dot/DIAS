import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { conferirSenha } from "@/lib/auth/senha";
import { abrirSessao } from "@/lib/auth/sessao";

const entrada = z.object({
  email: z.string().email(),
  senha: z.string().min(1),
});

/** Guarda o que aconteceu sem nunca guardar a senha. */
async function registrar(email: string, acao: string, sucesso: boolean, detalhe?: string, ip?: string) {
  await prisma.registroAcesso.create({ data: { email, acao, sucesso, detalhe, ip } });
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") ?? undefined;
  const corpo = await req.json().catch(() => null);
  const dados = entrada.safeParse(corpo);

  // Mensagem única para e-mail inexistente, senha errada e conta inativa:
  // dizer qual dos três falhou entrega informação a quem está tentando adivinhar.
  const recusa = NextResponse.json(
    { erro: "E-mail ou senha inválidos." },
    { status: 401 }
  );

  if (!dados.success) return recusa;

  const email = dados.data.email.toLowerCase().trim();
  const usuario = await prisma.usuario.findUnique({ where: { email } });

  if (!usuario) {
    await registrar(email, "login", false, "usuário inexistente", ip);
    return recusa;
  }
  if (!usuario.ativo) {
    await registrar(email, "login", false, "conta inativa", ip);
    return recusa;
  }

  const confere = await conferirSenha(dados.data.senha, usuario.senhaHash);
  if (!confere) {
    await registrar(email, "login", false, "senha incorreta", ip);
    return recusa;
  }

  await abrirSessao(usuario, {
    navegador: req.headers.get("user-agent") ?? undefined,
    ip,
  });

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { ultimoAcesso: new Date() },
  });
  await registrar(email, "login", true, undefined, ip);

  return NextResponse.json({
    ok: true,
    // Quem entrou com senha provisória vai direto para a troca.
    proximo: usuario.trocarSenha ? "/primeiro-acesso" : "/painel",
  });
}
