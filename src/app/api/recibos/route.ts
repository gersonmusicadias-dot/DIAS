import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { mensagemDeValidacao } from "@/lib/validacao";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";
import { exigirSessao, podeGravar } from "@/lib/auth/guarda";
import { financeiroDoRecibo, saldoAFaturarDaMedicao } from "@/lib/financeiro/motor";
import { paraEventos } from "@/lib/financeiro/eventos";

const COMPETENCIA = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATA = /^\d{4}-\d{2}-\d{2}$/;
async function proximoIdentificadorRecibo(ano: string) {
  const prefixo = `REC-${ano}-`;
  const existentes = await prisma.recibo.findMany({
    where: { identificador: { startsWith: prefixo } },
    select: { identificador: true },
  });

  const maior = existentes.reduce((atual, r) => {
    const sufixo = r.identificador.slice(prefixo.length);
    return /^\d+$/.test(sufixo) ? Math.max(atual, Number(sufixo)) : atual;
  }, 0);

  return `${prefixo}${String(maior + 1).padStart(4, "0")}`;
}

async function comIdentificadorOficial<T>(
  ano: string,
  acao: (identificador: string) => Promise<T>
) {
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const identificador = await proximoIdentificadorRecibo(ano);
    try {
      return await acao(identificador);
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") continue;
      throw erro;
    }
  }

  throw new Error("Não foi possível gerar um identificador único para o recibo.");
}

export async function GET() {
  const guarda = await exigirSessao();
  if (guarda.erro) return guarda.erro;

  const recibos = await prisma.recibo.findMany({
    include: {
      cliente: { select: { nomeFantasia: true } },
      medicao: { select: { identificador: true } },
      recebimentos: true,
      substitui: { select: { identificador: true } },
      substituidoPor: { select: { identificador: true } },
      anexos: { select: { id: true, nomeArquivo: true, tamanhoBytes: true, mimeType: true }, orderBy: { criadoEm: "asc" } },
    },
    orderBy: [{ competencia: "desc" }, { identificador: "asc" }],
  });

  return NextResponse.json({
    recibos: recibos.map((r) => {
      const f = financeiroDoRecibo({
        id: r.id, identificador: r.identificador, competencia: r.competencia,
        dataEmissao: r.dataEmissao, valorPrevisto: r.valorPrevisto,
        valorRecibo: r.valorRecibo, previsaoRecebimento: r.previsaoRecebimento,
        recebimentos: paraEventos(r.recebimentos),
      });
      return {
        id: r.id,
        identificador: r.identificador,
        descricao: r.descricao,
        cliente: r.cliente.nomeFantasia,
        medicao: r.medicao?.identificador ?? null,
        origem: r.origem,
        competencia: r.competencia,
        dataEmissao: r.dataEmissao,
        previsaoRecebimento: r.previsaoRecebimento,
        valorPrevisto: r.valorPrevisto,
        emitido: f.emitido,
        recebido: f.recebido,
        saldo: f.saldo,
        foiEmitido: f.foiEmitido,
        situacao: r.substituidoPor
          ? "SUBSTITUÍDO"
          : !f.foiEmitido
          ? "PREVISTO"
          : f.recebido <= 0
            ? "EMITIDO"
            : f.saldo > 0
              ? "PARCIALMENTE RECEBIDO"
              : "RECEBIDO",
        substitui: r.substitui?.identificador ?? null,
        substituidoPor: r.substituidoPor?.identificador ?? null,
        versaoSubstituicao: r.versaoSubstituicao,
        motivoSubstituicao: r.motivoSubstituicao,
        substituidoEm: r.substituidoEm,
        temMovimento: r.recebimentos.length > 0,
        anexos: r.anexos,
      };
    }),
  });
}

const novo = z.object({
  clienteId: z.string().min(1, "Selecione o cliente."),
  medicaoId: z.string().optional().nullable(),
  origem: z.enum(["AVULSO", "MEDICAO"]).default("AVULSO"),
  descricao: z.string().min(2, "Informe a descrição."),
  competencia: z.string().regex(COMPETENCIA, "Competência inválida."),
  valorPrevisto: z.number().positive("O valor previsto deve ser maior que zero."),
  emitido: z.boolean().optional(),
  dataEmissao: z.string().regex(DATA).optional().nullable(),
  valorRecibo: z.number().positive().optional().nullable(),
  previsaoRecebimento: z.string().regex(DATA).optional().nullable(),
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
  const d = dados.data;

  const cliente = await prisma.cliente.findUnique({ where: { id: d.clienteId } });
  if (!cliente || !cliente.ativo) {
    return NextResponse.json({ erro: "Selecione um cliente ativo." }, { status: 400 });
  }

  if (d.emitido && !d.dataEmissao) {
    return NextResponse.json({ erro: "Informe a data de emissão." }, { status: 400 });
  }
  if (d.emitido && !d.valorRecibo) {
    return NextResponse.json({ erro: "Informe o valor do recibo." }, { status: 400 });
  }

  let competenciaFinal = d.emitido ? d.dataEmissao!.slice(0, 7) : d.competencia;
  let valorPrevistoFinal = d.valorPrevisto;
  let previsaoRecebimentoFinal = d.previsaoRecebimento || null;
  let valorReciboFinal = d.emitido ? d.valorRecibo! : 0;

  if (d.origem === "MEDICAO") {
    if (!d.medicaoId) {
      return NextResponse.json({ erro: "Selecione a medição de origem." }, { status: 400 });
    }
    const medicao = await prisma.medicao.findUnique({
      where: { id: d.medicaoId },
      include: {
        recibos: {
          where: { substituidoPor: null },
          select: { valorRecibo: true, valorPrevisto: true, dataEmissao: true },
        },
        notasFiscais: { select: { valorNota: true, valorPrevisto: true, dataEmissao: true } },
      },
    });
    if (!medicao || medicao.clienteId !== d.clienteId) {
      return NextResponse.json(
        { erro: "A medição selecionada não pertence a este cliente." },
        { status: 400 }
      );
    }
    if (medicao.status !== "MEDIDA" || !medicao.valorMedido) {
      return NextResponse.json(
        { erro: "Só é possível faturar uma medição já medida." },
        { status: 400 }
      );
    }
    const documentosComprometidos = [
      ...medicao.notasFiscais.map((n) => ({ valor: n.dataEmissao ? n.valorNota : n.valorPrevisto })),
      ...medicao.recibos.map((r) => ({ valor: r.dataEmissao ? r.valorRecibo : r.valorPrevisto })),
    ];
    const aFaturar = saldoAFaturarDaMedicao(medicao.valorMedido, documentosComprometidos);
    if (aFaturar <= 0.005) {
      return NextResponse.json({ erro: "Esta medição não possui saldo disponível para gerar recibo." }, { status: 409 });
    }

    valorPrevistoFinal = aFaturar;
    previsaoRecebimentoFinal = medicao.previsaoRecebimento;
    valorReciboFinal = d.emitido ? aFaturar : 0;

    const valorDocumento = d.emitido ? valorReciboFinal : valorPrevistoFinal;
    if (valorDocumento > aFaturar + 0.005) {
      return NextResponse.json(
        { erro: `A medição só tem ${aFaturar.toFixed(2)} a faturar.` },
        { status: 400 }
      );
    }
  }

  const criarRecibo = (identificador: string) =>
    prisma.recibo.create({
      data: {
        clienteId: d.clienteId,
        medicaoId: d.origem === "MEDICAO" ? d.medicaoId! : null,
        origem: d.origem,
        identificador,
        descricao: d.descricao.trim(),
        competencia: competenciaFinal,
        dataEmissao: d.emitido ? d.dataEmissao! : null,
        valorPrevisto: valorPrevistoFinal,
        valorRecibo: valorReciboFinal,
        previsaoRecebimento: previsaoRecebimentoFinal,
        status: d.emitido ? "EMITIDO" : "PREVISTO",
      },
    });

  const recibo = d.emitido
    ? await comIdentificadorOficial(d.dataEmissao!.slice(0, 4), criarRecibo)
    : await criarRecibo(`PREV-${randomUUID()}`);

  await registrarAuditoria({ sessao: guarda.sessao, modulo: "Recibos", acao: "criar", registroId: recibo.id, descricao: `Recibo ${recibo.identificador} cadastrado.`, depois: recibo });

  return NextResponse.json({ ok: true, recibo });
}

const emitir = z.object({
  id: z.string(),
  dataEmissao: z.string().regex(DATA, "Data de emissão inválida."),
  valorRecibo: z.number().positive("O valor do recibo deve ser maior que zero."),
});

const editar = novo.extend({
  id: z.string().min(1),
  acao: z.literal("editar"),
});

export async function PATCH(req: Request) {
  const guarda = await podeGravar();
  if (guarda.erro) return guarda.erro;

  const corpo = await req.json().catch(() => null) as Record<string, unknown> | null;

  if (corpo?.acao === "editar") {
    const dados = editar.safeParse(corpo);
    if (!dados.success) {
      return NextResponse.json(
        { erro: mensagemDeValidacao(dados.error) },
        { status: 400 }
      );
    }
    const d = dados.data;

    const recibo = await prisma.recibo.findUnique({
      where: { id: d.id },
      include: { recebimentos: true, substituidoPor: { select: { id: true } } },
    });
    if (!recibo) {
      return NextResponse.json({ erro: "Recibo não encontrado." }, { status: 404 });
    }

    if (recibo.substituidoPor) {
      return NextResponse.json(
        { erro: "Este recibo foi substituído e permanece preservado no histórico. Edite a versão atual." },
        { status: 409 }
      );
    }

    const cliente = await prisma.cliente.findUnique({
      where: { id: d.clienteId },
    });
    if (!cliente || !cliente.ativo) {
      return NextResponse.json({ erro: "Selecione um cliente ativo." }, { status: 400 });
    }

    const estavaEmitido = Boolean(recibo.dataEmissao);
    const permaneceraEmitido = estavaEmitido;

    if (estavaEmitido && (!d.dataEmissao || !d.valorRecibo)) {
      return NextResponse.json(
        { erro: "Um recibo já emitido deve permanecer com data e valor de emissão." },
        { status: 409 }
      );
    }

    if (permaneceraEmitido && !d.dataEmissao) {
      return NextResponse.json({ erro: "Informe a data de emissão." }, { status: 400 });
    }
    if (permaneceraEmitido && !d.valorRecibo) {
      return NextResponse.json({ erro: "Informe o valor do recibo." }, { status: 400 });
    }

    const financeiro = financeiroDoRecibo({
      id: recibo.id,
      identificador: recibo.identificador,
      competencia: recibo.competencia,
      dataEmissao: recibo.dataEmissao,
      valorPrevisto: recibo.valorPrevisto,
      valorRecibo: recibo.valorRecibo,
      previsaoRecebimento: recibo.previsaoRecebimento,
      recebimentos: paraEventos(recibo.recebimentos),
    });

    const novoValorDocumento = permaneceraEmitido ? d.valorRecibo! : d.valorPrevisto;
    if (novoValorDocumento + 0.005 < financeiro.recebido) {
      return NextResponse.json(
        {
          erro: `O valor do recibo não pode ser inferior a R$ ${financeiro.recebido.toFixed(2)} porque esse valor já foi recebido. Estorne primeiro o recebimento excedente.`,
        },
        { status: 409 }
      );
    }

    let medicaoIdFinal: string | null = null;
    let origemFinal: "AVULSO" | "MEDICAO" = d.origem;
    let competenciaFinal = permaneceraEmitido
      ? d.dataEmissao!.slice(0, 7)
      : d.competencia;
    let valorPrevistoFinal = permaneceraEmitido ? d.valorRecibo! : d.valorPrevisto;
    let previsaoFinal = d.previsaoRecebimento || null;
    let valorReciboFinal = permaneceraEmitido ? d.valorRecibo! : 0;

    if (d.origem === "MEDICAO") {
      if (!d.medicaoId) {
        return NextResponse.json({ erro: "Selecione a medição de origem." }, { status: 400 });
      }

      if (recibo.medicaoId && recibo.medicaoId !== d.medicaoId) {
        return NextResponse.json(
          { erro: "A medição de origem de um recibo já vinculado não pode ser trocada. Corrija primeiro os documentos relacionados." },
          { status: 409 }
        );
      }

      const medicao = await prisma.medicao.findUnique({
        where: { id: d.medicaoId },
        include: {
          recibos: {
            where: { substituidoPor: null, id: { not: recibo.id } },
            select: { valorRecibo: true, valorPrevisto: true, dataEmissao: true },
          },
          notasFiscais: {
            select: { valorNota: true, valorPrevisto: true, dataEmissao: true },
          },
        },
      });

      if (!medicao || medicao.clienteId !== d.clienteId) {
        return NextResponse.json(
          { erro: "A medição selecionada não pertence a este cliente." },
          { status: 400 }
        );
      }
      if (medicao.status !== "MEDIDA" || !medicao.valorMedido) {
        return NextResponse.json(
          { erro: "Só é possível vincular o recibo a uma medição já medida." },
          { status: 409 }
        );
      }

      const comprometidos = [
        ...medicao.notasFiscais.map((n) => ({
          valor: n.dataEmissao ? n.valorNota : n.valorPrevisto,
        })),
        ...medicao.recibos.map((r) => ({
          valor: r.dataEmissao ? r.valorRecibo : r.valorPrevisto,
        })),
      ];
      const disponivel = saldoAFaturarDaMedicao(medicao.valorMedido, comprometidos);

      if (novoValorDocumento > disponivel + 0.005) {
        return NextResponse.json(
          { erro: `A medição só possui ${disponivel.toFixed(2)} disponível para este recibo.` },
          { status: 409 }
        );
      }

      medicaoIdFinal = d.medicaoId;
      origemFinal = "MEDICAO";
    } else if (recibo.medicaoId) {
      return NextResponse.json(
        { erro: "Um recibo originado de medição não pode ser transformado em avulso durante a correção." },
        { status: 409 }
      );
    }

    const atualizado = await prisma.recibo.update({
      where: { id: d.id },
      data: {
        clienteId: d.clienteId,
        medicaoId: medicaoIdFinal,
        origem: origemFinal,
        descricao: d.descricao.trim(),
        competencia: competenciaFinal,
        dataEmissao: permaneceraEmitido ? d.dataEmissao! : null,
        valorPrevisto: valorPrevistoFinal,
        valorRecibo: valorReciboFinal,
        previsaoRecebimento: previsaoFinal,
        status: permaneceraEmitido ? "EMITIDO" : "PREVISTO",
      },
    });

    await registrarAuditoria({
      sessao: guarda.sessao,
      modulo: "Recibos",
      acao: "editar",
      registroId: atualizado.id,
      descricao: `Recibo ${atualizado.identificador} corrigido.`,
      antes: recibo,
      depois: atualizado,
    });

    return NextResponse.json({ ok: true, recibo: atualizado });
  }

  const dados = emitir.safeParse(corpo);
  if (!dados.success) {
    return NextResponse.json(
      { erro: mensagemDeValidacao(dados.error) },
      { status: 400 }
    );
  }

  const recibo = await prisma.recibo.findUnique({ where: { id: dados.data.id } });
  if (!recibo) return NextResponse.json({ erro: "Recibo não encontrado." }, { status: 404 });
  if (recibo.dataEmissao) {
    return NextResponse.json({ erro: "Este recibo já foi emitido." }, { status: 409 });
  }

  if (recibo.medicaoId) {
    const medicao = await prisma.medicao.findUnique({
      where: { id: recibo.medicaoId },
      include: {
        recibos: {
          where: { substituidoPor: null, id: { not: recibo.id } },
          select: { valorRecibo: true, valorPrevisto: true, dataEmissao: true },
        },
        notasFiscais: { select: { valorNota: true, valorPrevisto: true, dataEmissao: true } },
      },
    });
    if (!medicao?.valorMedido) {
      return NextResponse.json({ erro: "A medição vinculada não está disponível para emissão." }, { status: 409 });
    }
    const comprometidos = [
      ...medicao.notasFiscais.map((n) => ({ valor: n.dataEmissao ? n.valorNota : n.valorPrevisto })),
      ...medicao.recibos.map((r) => ({ valor: r.dataEmissao ? r.valorRecibo : r.valorPrevisto })),
    ];
    const disponivel = saldoAFaturarDaMedicao(medicao.valorMedido, comprometidos);
    if (dados.data.valorRecibo > disponivel + 0.005) {
      return NextResponse.json(
        { erro: `A medição só possui ${disponivel.toFixed(2)} disponível para este recibo.` },
        { status: 409 }
      );
    }
  }

  const atualizado = await comIdentificadorOficial(
    dados.data.dataEmissao.slice(0, 4),
    (identificador) =>
      prisma.recibo.update({
        where: { id: dados.data.id },
        data: {
          identificador,
          dataEmissao: dados.data.dataEmissao,
          valorRecibo: dados.data.valorRecibo,
          status: "EMITIDO",
        },
      })
  );

  await registrarAuditoria({
    sessao: guarda.sessao,
    modulo: "Recibos",
    acao: "emitir",
    registroId: atualizado.id,
    descricao: `Recibo ${atualizado.identificador} emitido.`,
    antes: recibo,
    depois: atualizado,
  });

  return NextResponse.json({ ok: true, recibo: atualizado });
}
export async function DELETE(req: Request) {
  const guarda = await podeGravar();
  if (guarda.erro) return guarda.erro;

  const corpo = await req.json().catch(() => null) as { id?: unknown } | null;
  const id = typeof corpo?.id === "string" ? corpo.id : "";

  if (!id) {
    return NextResponse.json({ erro: "Recibo inválido." }, { status: 400 });
  }

  const recibo = await prisma.recibo.findUnique({
    where: { id },
    include: { recebimentos: { select: { id: true } } },
  });

  if (!recibo) {
    return NextResponse.json({ erro: "Recibo não encontrado." }, { status: 404 });
  }

  if (recibo.status !== "PREVISTO" || recibo.dataEmissao) {
    return NextResponse.json(
      { erro: "Um recibo já emitido não pode ser excluído." },
      { status: 409 }
    );
  }

  if (recibo.recebimentos.length) {
    return NextResponse.json(
      { erro: "Este recibo possui histórico financeiro e não pode ser excluído." },
      { status: 409 }
    );
  }

  await prisma.recibo.delete({ where: { id } });
  await registrarAuditoria({ sessao: guarda.sessao, modulo: "Recibos", acao: "excluir", registroId: recibo.id, descricao: `Recibo ${recibo.identificador} excluído.`, antes: recibo });

  return NextResponse.json({ ok: true });
}