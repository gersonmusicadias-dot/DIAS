import { NextResponse } from "next/server";
import { z } from "zod";
import { mensagemDeValidacao } from "@/lib/validacao";
import { prisma } from "@/lib/prisma";
import { exigirSessao, podeGravar } from "@/lib/auth/guarda";
import { registrarAuditoria } from "@/lib/auditoria";

export async function GET() {
  const guarda = await exigirSessao();
  if (guarda.erro) return guarda.erro;

  const clientes = await prisma.cliente.findMany({
    orderBy: [{ ativo: "desc" }, { nomeFantasia: "asc" }],
    include: {
      _count: { select: { medicoes: true, notasFiscais: true, recibos: true } },
    },
  });

  return NextResponse.json({
    clientes: clientes.map((c) => ({
      id: c.id,
      razaoSocial: c.razaoSocial,
      nomeFantasia: c.nomeFantasia,
      cnpj: c.cnpj,
      ativo: c.ativo,
      // Cliente com documento não pode ser apagado sem levar histórico junto.
      temVinculos:
        c._count.medicoes + c._count.notasFiscais + c._count.recibos > 0,
    })),
  });
}

const novo = z.object({
  razaoSocial: z.string().min(2, "Informe a razão social."),
  nomeFantasia: z.string().min(2, "Informe o nome fantasia."),
  cnpj: z.string().optional(),
});

export async function POST(req: Request) {
  const guarda = await podeGravar();
  if (guarda.erro) return guarda.erro;

  const dados = novo.safeParse(await req.json().catch(() => null));
  if (!dados.success) {
    return NextResponse.json(
      { erro: mensagemDeValidacao(dados.error) },
      { status: 400 }
    );
  }

  const cnpj = dados.data.cnpj?.replace(/\D/g, "") || null;
  if (cnpj) {
    const existente = await prisma.cliente.findFirst({ where: { cnpj } });
    if (existente) {
      return NextResponse.json({ erro: "Já existe um cliente com este CNPJ." }, { status: 409 });
    }
  }

  const cliente = await prisma.cliente.create({
    data: {
      razaoSocial: dados.data.razaoSocial.trim(),
      nomeFantasia: dados.data.nomeFantasia.trim(),
      cnpj,
    },
  });

  await registrarAuditoria({
    sessao: guarda.sessao,
    modulo: "Clientes",
    acao: "criar",
    registroId: cliente.id,
    descricao: `Cliente ${cliente.nomeFantasia} cadastrado.`,
    depois: cliente,
  });

  return NextResponse.json({ ok: true, cliente });
}

const alteracao = z.object({ id: z.string(), ativo: z.boolean() });

/** Ativar/inativar. Nunca apaga: o histórico financeiro depende do cliente. */
export async function PATCH(req: Request) {
  const guarda = await podeGravar();
  if (guarda.erro) return guarda.erro;

  const dados = alteracao.safeParse(await req.json().catch(() => null));
  if (!dados.success) return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });

  const antes = await prisma.cliente.findUnique({
    where: { id: dados.data.id },
  });
  if (!antes) {
    return NextResponse.json({ erro: "Cliente não encontrado." }, { status: 404 });
  }

  const cliente = await prisma.cliente.update({
    where: { id: dados.data.id },
    data: { ativo: dados.data.ativo },
  });

  await registrarAuditoria({
    sessao: guarda.sessao,
    modulo: "Clientes",
    acao: dados.data.ativo ? "ativar" : "inativar",
    registroId: cliente.id,
    descricao: `Cliente ${cliente.nomeFantasia} ${dados.data.ativo ? "ativado" : "inativado"}.`,
    antes,
    depois: cliente,
  });

  return NextResponse.json({ ok: true, cliente });
}
