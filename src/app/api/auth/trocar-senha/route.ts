import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { conferirSenha, gerarHash, validarForcaDaSenha } from "@/lib/auth/senha";
import { renovarSessao, revogarSessoesDoUsuario, sessaoAtual } from "@/lib/auth/sessao";

const entrada = z.object({
  senhaAtual: z.string().min(1),
  novaSenha: z.string().min(1),
});

export async function POST(req: Request) {
  const sessao = await sessaoAtual();
  if (!sessao) return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });

  const dados = entrada.safeParse(await req.json().catch(() => null));
  if (!dados.success) {
    return NextResponse.json({ erro: "Preencha os dois campos." }, { status: 400 });
  }

  const usuario = await prisma.usuario.findUnique({ where: { id: sessao.sub } });
  if (!usuario || !usuario.ativo) {
    return NextResponse.json({ erro: "Conta indisponível." }, { status: 401 });
  }

  // Exigir a senha atual impede que uma sessão sequestrada troque a senha e
  // tranque o dono para fora.
  const confere = await conferirSenha(dados.data.senhaAtual, usuario.senhaHash);
  if (!confere) {
    await prisma.registroAcesso.create({
      data: { email: usuario.email, acao: "trocar-senha", sucesso: false, detalhe: "senha atual incorreta" },
    });
    return NextResponse.json({ erro: "A senha atual não confere." }, { status: 400 });
  }

  const problema = validarForcaDaSenha(dados.data.novaSenha);
  if (problema) return NextResponse.json({ erro: problema }, { status: 400 });

  if (await conferirSenha(dados.data.novaSenha, usuario.senhaHash)) {
    return NextResponse.json(
      { erro: "A nova senha precisa ser diferente da atual." },
      { status: 400 }
    );
  }

  const atualizado = await prisma.usuario.update({
    where: { id: usuario.id },
    data: { senhaHash: await gerarHash(dados.data.novaSenha), trocarSenha: false },
  });

  // Derruba as OUTRAS sessões: se a senha provisória circulou por e-mail e
  // alguém mais entrou com ela, esse alguém perde o acesso agora. A sessão
  // de quem está trocando é poupada e reemitida logo abaixo.
  await revogarSessoesDoUsuario(usuario.id, sessao.sid);
  await renovarSessao(sessao.sid, atualizado);

  await prisma.registroAcesso.create({
    data: { email: usuario.email, acao: "trocar-senha", sucesso: true },
  });

  return NextResponse.json({ ok: true, proximo: "/painel" });
}
