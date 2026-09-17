import { NextResponse } from "next/server";
import { z } from "zod";
import { mensagemDeValidacao } from "@/lib/validacao";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";
import { exigirSessao, podeGravar } from "@/lib/auth/guarda";
import { saldoAFaturarDaMedicao } from "@/lib/financeiro/motor";

const COMPETENCIA = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

export async function GET() {
  const guarda = await exigirSessao();
  if (guarda.erro) return guarda.erro;

  const medicoes = await prisma.medicao.findMany({
    include: {
      cliente: { select: { nomeFantasia: true } },
      recibos: {
        where: { substituidoPor: null },
        select: { id: true, identificador: true, valorRecibo: true, valorPrevisto: true, dataEmissao: true },
      },
      // Compatibilidade com medições antigas que ainda possam ter NF vinculada.
      // O fluxo atual de NF é independente, mas esses vínculos históricos não
      // podem ser ignorados no saldo a faturar.
      notasFiscais: {
        select: { id: true, numero: true, valorNota: true, valorPrevisto: true, dataEmissao: true },
      },
    },
    orderBy: [{ competencia: "desc" }, { identificador: "asc" }],
  });

  return NextResponse.json({
    medicoes: medicoes.map((m) => {
      const documentos = [
        ...m.notasFiscais.map((n) => ({ valor: n.dataEmissao ? n.valorNota : n.valorPrevisto })),
        ...m.recibos.map((r) => ({ valor: r.dataEmissao ? r.valorRecibo : r.valorPrevisto })),
      ];
      return {
        id: m.id,
        cliente: m.cliente.nomeFantasia,
        clienteId: m.clienteId,
        identificador: m.identificador,
        competencia: m.competencia,
        periodoInicio: m.periodoInicio,
        periodoFim: m.periodoFim,
        descricaoServicos: m.descricaoServicos,
        valorPrevisto: m.valorPrevisto,
        valorMedido: m.valorMedido,
        dataMedicao: m.dataMedicao,
        previsaoRecebimento: m.previsaoRecebimento,
        status: m.status,
        diferenca: (m.valorMedido ?? 0) - m.valorPrevisto,
        // Medição não recebe diretamente. Documentos já emitidos ou apenas
        // previstos reservam o respectivo valor para impedir faturamento duplo.
        aFaturar: m.valorMedido ? saldoAFaturarDaMedicao(m.valorMedido, documentos) : 0,
        documentos: [
          ...m.notasFiscais.map((n) => ({ tipo: "NF", rotulo: n.numero })),
          ...m.recibos.map((r) => ({ tipo: "RECIBO", rotulo: r.identificador })),
        ],
        temDocumento: documentos.length > 0,
      };
    }),
  });
}

const nova = z.object({
  clienteId: z.string().min(1, "Selecione o cliente."),
  identificador: z.string().min(1, "Informe o identificador."),
  competencia: z.string().regex(COMPETENCIA, "Competência inválida."),
  periodoInicio: z.string().regex(DATA, "Período inicial inválido."),
  periodoFim: z.string().regex(DATA, "Período final inválido."),
  descricaoServicos: z.string().trim().min(10, "Descreva os serviços executados."),
  valorPrevisto: z.number().positive("O valor previsto deve ser maior que zero."),
  previsaoRecebimento: z.string().regex(DATA).optional().nullable(),
  medirAgora: z.boolean().optional(),
  valorMedido: z.number().positive().optional().nullable(),
  dataMedicao: z.string().regex(DATA).optional().nullable(),
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
  const d = dados.data;

  if (d.periodoFim < d.periodoInicio) {
    return NextResponse.json(
      { erro: "O período final não pode ser anterior ao inicial." },
      { status: 400 }
    );
  }

  const cliente = await prisma.cliente.findUnique({ where: { id: d.clienteId } });
  if (!cliente || !cliente.ativo) {
    return NextResponse.json({ erro: "Selecione um cliente ativo." }, { status: 400 });
  }

  // Identificador é único por cliente: dois "MED-01" do mesmo cliente
  // tornariam impossível saber a qual documento a nota se refere.
  const repetido = await prisma.medicao.findFirst({
    where: { clienteId: d.clienteId, identificador: d.identificador.trim() },
  });
  if (repetido) {
    return NextResponse.json(
      { erro: "Já existe uma medição com este identificador para este cliente." },
      { status: 409 }
    );
  }

  const medindo = Boolean(d.medirAgora && d.valorMedido);
  if (d.medirAgora && !d.valorMedido) {
    return NextResponse.json({ erro: "Informe o valor medido." }, { status: 400 });
  }
  if (medindo && !d.dataMedicao) {
    return NextResponse.json({ erro: "Informe a data da medição." }, { status: 400 });
  }

  const medicao = await prisma.medicao.create({
    data: {
      clienteId: d.clienteId,
      identificador: d.identificador.trim(),
      competencia: d.competencia,
      periodoInicio: d.periodoInicio,
      periodoFim: d.periodoFim,
      descricaoServicos: d.descricaoServicos.trim(),
      valorPrevisto: d.valorPrevisto,
      valorMedido: medindo ? d.valorMedido : null,
      dataMedicao: medindo ? d.dataMedicao : null,
      previsaoRecebimento: d.previsaoRecebimento || null,
      status: medindo ? "MEDIDA" : "A_MEDIR",
    },
  });

  await registrarAuditoria({ sessao: guarda.sessao, modulo: "Medições", acao: "criar", registroId: medicao.id, descricao: `Medição ${medicao.identificador} cadastrada.`, depois: medicao });

  return NextResponse.json({ ok: true, medicao });
}

const medir = z.object({
  id: z.string(),
  valorMedido: z.number().positive("O valor medido deve ser maior que zero."),
  dataMedicao: z.string().regex(DATA, "Data da medição inválida."),
});

const editar = nova.omit({ medirAgora: true }).extend({
  id: z.string(),
});

export async function PATCH(req: Request) {
  const guarda = await podeGravar();
  if (guarda.erro) return guarda.erro;

  const corpo = await req.json().catch(() => null) as Record<string, unknown> | null;
  const edicaoCompleta = corpo?.acao === "editar";

  if (edicaoCompleta) {
    const dados = editar.safeParse(corpo);
    if (!dados.success) {
      return NextResponse.json(
        { erro: mensagemDeValidacao(dados.error) },
        { status: 400 }
      );
    }

    const d = dados.data;
    if (d.periodoFim < d.periodoInicio) {
      return NextResponse.json(
        { erro: "O período final não pode ser anterior ao inicial." },
        { status: 400 }
      );
    }

    const medicao = await prisma.medicao.findUnique({
      where: { id: d.id },
      include: {
        recibos: {
          where: { substituidoPor: null },
          select: { valorRecibo: true, valorPrevisto: true, dataEmissao: true },
        },
        notasFiscais: {
          select: { valorNota: true, valorPrevisto: true, dataEmissao: true },
        },
      },
    });
    if (!medicao) {
      return NextResponse.json({ erro: "Medição não encontrada." }, { status: 404 });
    }

    const cliente = await prisma.cliente.findUnique({ where: { id: d.clienteId } });
    if (!cliente || !cliente.ativo) {
      return NextResponse.json({ erro: "Selecione um cliente ativo." }, { status: 400 });
    }

    const repetido = await prisma.medicao.findFirst({
      where: {
        clienteId: d.clienteId,
        identificador: d.identificador.trim(),
        id: { not: d.id },
      },
      select: { id: true },
    });
    if (repetido) {
      return NextResponse.json(
        { erro: "Já existe uma medição com este identificador para este cliente." },
        { status: 409 }
      );
    }

    const temDocumentos = medicao.recibos.length > 0 || medicao.notasFiscais.length > 0;
    const valorMedidoFinal = d.valorMedido ?? medicao.valorMedido;
    const dataMedicaoFinal = d.dataMedicao ?? medicao.dataMedicao;

    if (temDocumentos) {
      if (!valorMedidoFinal || !dataMedicaoFinal) {
        return NextResponse.json(
          { erro: "Uma medição com documentos vinculados deve permanecer como medida." },
          { status: 409 }
        );
      }

      if (d.clienteId !== medicao.clienteId) {
        return NextResponse.json(
          { erro: "O cliente não pode ser alterado enquanto existirem documentos vinculados à medição." },
          { status: 409 }
        );
      }

      const comprometido =
        medicao.notasFiscais.reduce(
          (total, n) => total + (n.dataEmissao ? n.valorNota : n.valorPrevisto),
          0
        ) +
        medicao.recibos.reduce(
          (total, r) => total + (r.dataEmissao ? r.valorRecibo : r.valorPrevisto),
          0
        );

      if (valorMedidoFinal + 0.005 < comprometido) {
        return NextResponse.json(
          {
            erro: `O valor medido não pode ser inferior a R$ ${comprometido.toFixed(2)} porque esse valor já está comprometido em documentos vinculados.`,
          },
          { status: 409 }
        );
      }
    }

    const medida = Boolean(valorMedidoFinal && dataMedicaoFinal);
    const atualizada = await prisma.medicao.update({
      where: { id: d.id },
      data: {
        clienteId: d.clienteId,
        identificador: d.identificador.trim(),
        competencia: d.competencia,
        periodoInicio: d.periodoInicio,
        periodoFim: d.periodoFim,
        descricaoServicos: d.descricaoServicos.trim(),
        valorPrevisto: d.valorPrevisto,
        previsaoRecebimento: d.previsaoRecebimento || null,
        valorMedido: medida ? valorMedidoFinal : null,
        dataMedicao: medida ? dataMedicaoFinal : null,
        status: medida ? "MEDIDA" : "A_MEDIR",
      },
    });

    await registrarAuditoria({
      sessao: guarda.sessao,
      modulo: "Medições",
      acao: "editar",
      registroId: atualizada.id,
      descricao: `Medição ${atualizada.identificador} corrigida.`,
      antes: medicao,
      depois: atualizada,
    });

    return NextResponse.json({ ok: true, medicao: atualizada });
  }

  const dados = medir.safeParse(corpo);
  if (!dados.success) {
    return NextResponse.json(
      { erro: mensagemDeValidacao(dados.error) },
      { status: 400 }
    );
  }

  const medicao = await prisma.medicao.findUnique({
    where: { id: dados.data.id },
    include: { recibos: true, notasFiscais: true },
  });
  if (!medicao) {
    return NextResponse.json({ erro: "Medição não encontrada." }, { status: 404 });
  }

  if (medicao.recibos.length || medicao.notasFiscais.length) {
    return NextResponse.json(
      { erro: "Esta medição já possui documentos vinculados. Utilize a opção Editar para fazer uma correção controlada." },
      { status: 409 }
    );
  }

  const atualizada = await prisma.medicao.update({
    where: { id: dados.data.id },
    data: {
      valorMedido: dados.data.valorMedido,
      dataMedicao: dados.data.dataMedicao,
      status: "MEDIDA",
    },
  });

  await registrarAuditoria({
    sessao: guarda.sessao,
    modulo: "Medições",
    acao: "medir",
    registroId: atualizada.id,
    descricao: `Medição ${atualizada.identificador} realizada.`,
    antes: medicao,
    depois: atualizada,
  });

  return NextResponse.json({ ok: true, medicao: atualizada });
}
export async function DELETE(req: Request) {
  const guarda = await podeGravar();
  if (guarda.erro) return guarda.erro;

  const corpo = await req.json().catch(() => null) as { id?: unknown } | null;
  const id = typeof corpo?.id === "string" ? corpo.id : "";

  if (!id) {
    return NextResponse.json({ erro: "Medição inválida." }, { status: 400 });
  }

  const medicao = await prisma.medicao.findUnique({
    where: { id },
    include: {
      recibos: { select: { id: true } },
      notasFiscais: { select: { id: true } },
    },
  });

  if (!medicao) {
    return NextResponse.json({ erro: "Medição não encontrada." }, { status: 404 });
  }

  if (medicao.status !== "A_MEDIR" || medicao.valorMedido !== null) {
    return NextResponse.json(
      { erro: "Uma medição já realizada não pode ser excluída." },
      { status: 409 }
    );
  }

  if (medicao.recibos.length || medicao.notasFiscais.length) {
    return NextResponse.json(
      { erro: "Esta medição possui documentos vinculados e não pode ser excluída." },
      { status: 409 }
    );
  }

  await prisma.medicao.delete({ where: { id } });
  await registrarAuditoria({ sessao: guarda.sessao, modulo: "Medições", acao: "excluir", registroId: medicao.id, descricao: `Medição ${medicao.identificador} excluída.`, antes: medicao });

  return NextResponse.json({ ok: true });
}