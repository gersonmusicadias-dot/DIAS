import { NextResponse } from "next/server";
import { z } from "zod";
import { TIPOS_CUSTO } from "@/lib/financeiro/constantes";
import { mensagemDeValidacao } from "@/lib/validacao";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";
import { exigirSessao, podeGravar } from "@/lib/auth/guarda";

export async function GET() {
  const guarda = await exigirSessao();
  if (guarda.erro) return guarda.erro;

  const categorias = await prisma.categoria.findMany({
    orderBy: [{ ativa: "desc" }, { nome: "asc" }],
    include: { _count: { select: { custos: true } } },
  });

  return NextResponse.json({
    categorias: categorias.map((c) => ({
      id: c.id,
      nome: c.nome,
      tipo: c.tipo,
      ativa: c.ativa,
      custosVinculados: c._count.custos,
    })),
  });
}

const nova = z.object({
  nome: z.string().min(2, "Informe o nome da categoria."),
  tipo: z.enum(TIPOS_CUSTO),
});

export async function POST(req: Request) {
  const guarda = await podeGravar();
  if (guarda.erro) return guarda.erro;

  const dados = nova.safeParse(await req.json().catch(() => null));
  if (!dados.success) {
    return NextResponse.json(
      { erro: mensagemDeValidacao(dados.error) },
      { status: 400 }
    );
  }

  const nome = dados.data.nome.trim();

  const existente = await prisma.categoria.findFirst({
    where: { nome, tipo: dados.data.tipo },
  });

  if (existente) {
    return NextResponse.json(
      { erro: "Já existe uma categoria com este nome para este tipo." },
      { status: 409 }
    );
  }

  const categoria = await prisma.categoria.create({
    data: { nome, tipo: dados.data.tipo },
  });

  await registrarAuditoria({
    sessao: guarda.sessao,
    modulo: "Categorias",
    acao: "criar",
    registroId: categoria.id,
    descricao: `Categoria ${categoria.nome} cadastrada.`,
    depois: categoria,
  });

  return NextResponse.json({ ok: true, categoria });
}

const alteracao = z.object({
  id: z.string(),
  ativa: z.boolean().optional(),
  nome: z.string().min(2, "Informe o nome da categoria.").optional(),
  tipo: z.enum(TIPOS_CUSTO).optional(),
});

export async function PATCH(req: Request) {
  const guarda = await podeGravar();
  if (guarda.erro) return guarda.erro;

  const dados = alteracao.safeParse(await req.json().catch(() => null));
  if (!dados.success) {
    return NextResponse.json(
      { erro: mensagemDeValidacao(dados.error) },
      { status: 400 }
    );
  }

  const antes = await prisma.categoria.findUnique({
    where: { id: dados.data.id },
  });

  if (!antes) {
    return NextResponse.json(
      { erro: "Categoria não encontrada." },
      { status: 404 }
    );
  }

  const editandoCadastro =
    dados.data.nome !== undefined || dados.data.tipo !== undefined;

  if (editandoCadastro) {
    const nome = (dados.data.nome ?? antes.nome).trim();
    const tipo = dados.data.tipo ?? antes.tipo;

    const existente = await prisma.categoria.findFirst({
      where: {
        nome,
        tipo,
        NOT: { id: antes.id },
      },
    });

    if (existente) {
      return NextResponse.json(
        { erro: "Já existe uma categoria com este nome para este tipo." },
        { status: 409 }
      );
    }

    const categoria = await prisma.categoria.update({
      where: { id: antes.id },
      data: { nome, tipo },
    });

    await registrarAuditoria({
      sessao: guarda.sessao,
      modulo: "Categorias",
      acao: "editar",
      registroId: categoria.id,
      descricao: `Categoria ${antes.nome} alterada para ${categoria.nome}.`,
      antes,
      depois: categoria,
    });

    return NextResponse.json({ ok: true, categoria });
  }

  if (dados.data.ativa === undefined) {
    return NextResponse.json(
      { erro: "Nenhuma alteração foi informada." },
      { status: 400 }
    );
  }

  const categoria = await prisma.categoria.update({
    where: { id: antes.id },
    data: { ativa: dados.data.ativa },
  });

  await registrarAuditoria({
    sessao: guarda.sessao,
    modulo: "Categorias",
    acao: categoria.ativa ? "ativar" : "inativar",
    registroId: categoria.id,
    descricao: `Categoria ${categoria.nome} ${categoria.ativa ? "ativada" : "inativada"}.`,
    antes,
    depois: categoria,
  });

  return NextResponse.json({ ok: true, categoria });
}

const exclusao = z.object({
  id: z.string(),
});

export async function DELETE(req: Request) {
  const guarda = await podeGravar();
  if (guarda.erro) return guarda.erro;

  const dados = exclusao.safeParse(await req.json().catch(() => null));
  if (!dados.success) {
    return NextResponse.json(
      { erro: "Categoria inválida." },
      { status: 400 }
    );
  }

  const categoria = await prisma.categoria.findUnique({
    where: { id: dados.data.id },
    include: { _count: { select: { custos: true } } },
  });

  if (!categoria) {
    return NextResponse.json(
      { erro: "Categoria não encontrada." },
      { status: 404 }
    );
  }

  if (categoria._count.custos > 0) {
    return NextResponse.json(
      {
        erro: `Não é possível excluir esta categoria porque existem ${categoria._count.custos} custo(s) vinculado(s). Você pode inativá-la para impedir novos lançamentos.`,
      },
      { status: 409 }
    );
  }

  await prisma.categoria.delete({
    where: { id: categoria.id },
  });

  await registrarAuditoria({
    sessao: guarda.sessao,
    modulo: "Categorias",
    acao: "excluir",
    registroId: categoria.id,
    descricao: `Categoria ${categoria.nome} excluída.`,
    antes: categoria,
  });

  return NextResponse.json({ ok: true });
}