import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";
import { podeGravar } from "@/lib/auth/guarda";
import { saldoAFaturarDaMedicao } from "@/lib/financeiro/motor";

const DATA = /^\d{4}-\d{2}-\d{2}$/;

interface Ctx {
  params: Promise<{ id: string }>;
}

const entrada = z.object({
  motivo: z.string().trim().min(5, "Informe o motivo da substituição."),
  descricao: z.string().trim().min(2, "Informe a descrição."),
  dataEmissao: z.string().regex(DATA, "Data de emissão inválida."),
  valorRecibo: z.number().positive("O valor do recibo deve ser maior que zero."),
  previsaoRecebimento: z.string().regex(DATA, "Previsão de recebimento inválida.").optional().nullable(),
});

export async function POST(req: Request, { params }: Ctx) {
  const guarda = await podeGravar();
  if (guarda.erro) return guarda.erro;

  const { id } = await params;
  const dados = entrada.safeParse(await req.json().catch(() => null));

  if (!dados.success) {
    return NextResponse.json(
      { erro: dados.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 }
    );
  }

  const atual = await prisma.recibo.findUnique({
    where: { id },
    include: {
      recebimentos: { select: { id: true } },
      substituidoPor: { select: { id: true, identificador: true } },
    },
  });

  if (!atual) {
    return NextResponse.json({ erro: "Recibo não encontrado." }, { status: 404 });
  }

  if (!atual.dataEmissao) {
    return NextResponse.json(
      { erro: "Somente um recibo já emitido pode ser substituído." },
      { status: 409 }
    );
  }

  if (atual.substituidoPor) {
    return NextResponse.json(
      { erro: `Este recibo já foi substituído por ${atual.substituidoPor.identificador}.` },
      { status: 409 }
    );
  }

  if (atual.recebimentos.length > 0) {
    return NextResponse.json(
      { erro: "Recibo com histórico de recebimento não pode ser substituído." },
      { status: 409 }
    );
  }

  let valorFinal = dados.data.valorRecibo;
  let previsaoFinal = dados.data.previsaoRecebimento || null;

  if (atual.medicaoId) {
    const medicao = await prisma.medicao.findUnique({
      where: { id: atual.medicaoId },
      include: {
        recibos: {
          where: {
            substituidoPor: null,
            id: { not: atual.id },
          },
          select: { valorRecibo: true, valorPrevisto: true, dataEmissao: true },
        },
        notasFiscais: { select: { valorNota: true, valorPrevisto: true, dataEmissao: true } },
      },
    });

    if (!medicao || !medicao.valorMedido) {
      return NextResponse.json(
        { erro: "A medição vinculada não está disponível para substituição." },
        { status: 409 }
      );
    }

    const disponivel = saldoAFaturarDaMedicao(
      medicao.valorMedido,
      [
        ...medicao.notasFiscais.map((n) => ({ valor: n.dataEmissao ? n.valorNota : n.valorPrevisto })),
        ...medicao.recibos.map((r) => ({ valor: r.dataEmissao ? r.valorRecibo : r.valorPrevisto })),
      ]
    );

    if (atual.valorRecibo > disponivel + 0.005) {
      return NextResponse.json(
        { erro: "O valor do recibo ultrapassa o saldo disponível da medição." },
        { status: 409 }
      );
    }

    valorFinal = atual.valorRecibo;
    previsaoFinal = atual.previsaoRecebimento;
  }

  const base = atual.identificador.replace(/-S\d+$/, "");
  const versao = atual.versaoSubstituicao + 1;
  const identificador = `${base}-S${versao}`;

  const existente = await prisma.recibo.findUnique({
    where: { identificador },
  });

  if (existente) {
    return NextResponse.json(
      { erro: `O identificador ${identificador} já existe.` },
      { status: 409 }
    );
  }

  const agora = new Date();

  const novo = await prisma.$transaction(async (tx) => {
    await tx.recibo.update({
      where: { id: atual.id },
      data: {
        status: "SUBSTITUIDO",
        substituidoEm: agora,
      },
    });

    return tx.recibo.create({
      data: {
        clienteId: atual.clienteId,
        medicaoId: atual.medicaoId,
        origem: atual.origem,
        identificador,
        descricao: dados.data.descricao,
        competencia: dados.data.dataEmissao.slice(0, 7),
        dataEmissao: dados.data.dataEmissao,
        valorPrevisto: valorFinal,
        valorRecibo: valorFinal,
        previsaoRecebimento: previsaoFinal,
        status: "EMITIDO",
        substituiReciboId: atual.id,
        versaoSubstituicao: versao,
        motivoSubstituicao: dados.data.motivo,
      },
    });
  });

  await registrarAuditoria({
    sessao: guarda.sessao, modulo: "Recibos", acao: "substituir", registroId: novo.id,
    descricao: `Recibo ${atual.identificador} substituído por ${novo.identificador}.`,
    antes: { id: atual.id, identificador: atual.identificador, status: atual.status, valorRecibo: atual.valorRecibo },
    depois: { id: novo.id, identificador: novo.identificador, status: novo.status, valorRecibo: novo.valorRecibo, substituiReciboId: atual.id, motivoSubstituicao: novo.motivoSubstituicao },
  });

  return NextResponse.json({
    ok: true,
    recibo: novo,
    substituido: atual.identificador,
  });
}