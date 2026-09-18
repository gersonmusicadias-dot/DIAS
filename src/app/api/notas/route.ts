import { NextResponse } from "next/server";
import { z } from "zod";
import { mensagemDeValidacao } from "@/lib/validacao";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";
import { exigirSessao, podeGravar } from "@/lib/auth/guarda";
import { financeiroDaNota, saldoAFaturarDaMedicao } from "@/lib/financeiro/motor";
import { paraEventos } from "@/lib/financeiro/eventos";

const COMPETENCIA = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

export async function GET() {
  const guarda = await exigirSessao();
  if (guarda.erro) return guarda.erro;

  const notas = await prisma.notaFiscal.findMany({
    include: {
      cliente: { select: { nomeFantasia: true } },
      medicao: { select: { identificador: true } },
      recebimentos: true,
      anexos: { select: { id: true, nomeArquivo: true, tamanhoBytes: true, mimeType: true }, orderBy: { criadoEm: "asc" } },
    },
    orderBy: [{ competencia: "desc" }, { numero: "asc" }],
  });

  return NextResponse.json({
    notas: notas.map((n) => {
      const f = financeiroDaNota({
        id: n.id, numero: n.numero, competencia: n.competencia,
        dataEmissao: n.dataEmissao, status: n.status,
        valorPrevisto: n.valorPrevisto, valorNota: n.valorNota,
        previsaoRecebimento: n.previsaoRecebimento,
        recebimentos: paraEventos(n.recebimentos),
      });
      return {
        id: n.id,
        clienteId: n.clienteId,
        medicaoId: n.medicaoId,
        numero: n.numero,
        cliente: n.cliente.nomeFantasia,
        medicao: n.medicao?.identificador ?? null,
        competencia: n.competencia,
        dataEmissao: n.dataEmissao,
        previsaoRecebimento: n.previsaoRecebimento,
        valorPrevisto: n.valorPrevisto,
        faturado: f.faturado,
        recebido: f.recebido,
        saldo: f.saldo,
        emitida: f.emitida,
        // Situação derivada dos eventos, nunca gravada.
        situacao: !f.emitida
          ? "PREVISTA"
          : f.recebido <= 0
            ? "EMITIDA"
            : f.saldo > 0
              ? "PARCIALMENTE RECEBIDA"
              : "RECEBIDA",
        temMovimento: n.recebimentos.length > 0,
        anexos: n.anexos,
      };
    }),
  });
}

const nova = z.object({
  clienteId: z.string().min(1, "Selecione o cliente."),
  medicaoId: z.string().optional().nullable(),
  numero: z.string().min(1, "Informe o número da nota."),
  dataEmissao: z.string().regex(DATA, "Data de emissão inválida."),
  valorNota: z.number().positive("O valor da nota deve ser maior que zero."),
  previsaoRecebimento: z.string().regex(DATA).optional().nullable(),
});

async function validarMedicao(clienteId: string, medicaoId: string | null | undefined, valor: number, ignorarNotaId?: string) {
  if (!medicaoId) return null;
  const medicao = await prisma.medicao.findUnique({
    where: { id: medicaoId },
    include: {
      notasFiscais: { where: ignorarNotaId ? { id: { not: ignorarNotaId } } : undefined, select: { valorNota: true } },
      recibos: { where: { substituidoPor: null }, select: { valorRecibo: true, valorPrevisto: true, dataEmissao: true } },
    },
  });
  if (!medicao || medicao.clienteId !== clienteId) return "A medição selecionada não pertence a este cliente.";
  if (medicao.status !== "MEDIDA" || !medicao.valorMedido) return "Só é possível vincular uma medição já emitida.";
  const aFaturar = saldoAFaturarDaMedicao(medicao.valorMedido, [
    ...medicao.notasFiscais.map((n) => ({ valor: n.valorNota })),
    ...medicao.recibos.map((r) => ({ valor: r.dataEmissao ? r.valorRecibo : r.valorPrevisto })),
  ]);
  return valor > aFaturar + 0.005 ? `A medição só tem R$ ${aFaturar.toFixed(2)} disponível para faturar.` : null;
}

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

  const cliente = await prisma.cliente.findUnique({ where: { id: d.clienteId } });
  if (!cliente || !cliente.ativo) {
    return NextResponse.json({ erro: "Selecione um cliente ativo." }, { status: 400 });
  }

  const repetida = await prisma.notaFiscal.findFirst({
    where: { clienteId: d.clienteId, numero: d.numero.trim() },
  });
  if (repetida) {
    return NextResponse.json(
      { erro: "Já existe uma nota com este número para este cliente." },
      { status: 409 }
    );
  }

  const erroMedicao = await validarMedicao(d.clienteId, d.medicaoId, d.valorNota);
  if (erroMedicao) return NextResponse.json({ erro: erroMedicao }, { status: 400 });


  const nota = await prisma.notaFiscal.create({
    data: {
      clienteId: d.clienteId,
      medicaoId: d.medicaoId || null,
      numero: d.numero.trim(),
      competencia: d.dataEmissao.slice(0, 7),
      dataEmissao: d.dataEmissao,
      valorPrevisto: d.valorNota,
      valorNota: d.valorNota,
      previsaoRecebimento: d.previsaoRecebimento || null,
      status: "EMITIDA",
    },
  });

  await registrarAuditoria({ sessao: guarda.sessao, modulo: "Notas Fiscais", acao: "criar", registroId: nota.id, descricao: `Nota fiscal ${nota.numero} cadastrada.`, depois: nota });

  return NextResponse.json({ ok: true, nota });
}
const editar = nova.extend({
  id: z.string().min(1),
  acao: z.literal("editar"),
});

export async function PATCH(req: Request) {
  const guarda = await podeGravar();
  if (guarda.erro) return guarda.erro;

  const dados = editar.safeParse(await req.json().catch(() => null));
  if (!dados.success) {
    return NextResponse.json(
      { erro: mensagemDeValidacao(dados.error) },
      { status: 400 }
    );
  }
  const d = dados.data;

  const nota = await prisma.notaFiscal.findUnique({
    where: { id: d.id },
    include: { recebimentos: true },
  });
  if (!nota) {
    return NextResponse.json({ erro: "Nota fiscal não encontrada." }, { status: 404 });
  }

  const cliente = await prisma.cliente.findUnique({
    where: { id: d.clienteId },
  });
  if (!cliente || !cliente.ativo) {
    return NextResponse.json({ erro: "Selecione um cliente ativo." }, { status: 400 });
  }

  const repetida = await prisma.notaFiscal.findFirst({
    where: {
      clienteId: d.clienteId,
      numero: d.numero.trim(),
      id: { not: d.id },
    },
    select: { id: true },
  });
  if (repetida) {
    return NextResponse.json(
      { erro: "Já existe uma nota com este número para este cliente." },
      { status: 409 }
    );
  }

  const erroMedicao = await validarMedicao(d.clienteId, d.medicaoId, d.valorNota, d.id);
  if (erroMedicao) return NextResponse.json({ erro: erroMedicao }, { status: 400 });

  const financeiro = financeiroDaNota({
    id: nota.id,
    numero: nota.numero,
    competencia: nota.competencia,
    dataEmissao: nota.dataEmissao,
    status: nota.status,
    valorPrevisto: nota.valorPrevisto,
    valorNota: nota.valorNota,
    previsaoRecebimento: nota.previsaoRecebimento,
    recebimentos: paraEventos(nota.recebimentos),
  });

  if (d.valorNota + 0.005 < financeiro.recebido) {
    return NextResponse.json(
      {
        erro: `O valor da nota não pode ser inferior a R$ ${financeiro.recebido.toFixed(2)} porque esse valor já foi recebido. Estorne primeiro o recebimento excedente.`,
      },
      { status: 409 }
    );
  }

  const atualizada = await prisma.notaFiscal.update({
    where: { id: d.id },
    data: {
      clienteId: d.clienteId,
      medicaoId: d.medicaoId || null,
      numero: d.numero.trim(),
      competencia: d.dataEmissao.slice(0, 7),
      dataEmissao: d.dataEmissao,
      valorPrevisto: d.valorNota,
      valorNota: d.valorNota,
      previsaoRecebimento: d.previsaoRecebimento || null,
      status: "EMITIDA",
    },
  });

  await registrarAuditoria({
    sessao: guarda.sessao,
    modulo: "Notas Fiscais",
    acao: "editar",
    registroId: atualizada.id,
    descricao: `Nota fiscal ${atualizada.numero} corrigida.`,
    antes: nota,
    depois: atualizada,
  });

  return NextResponse.json({ ok: true, nota: atualizada });
}
export async function DELETE(req: Request) {
  const guarda = await podeGravar();
  if (guarda.erro) return guarda.erro;

  const corpo = await req.json().catch(() => null) as { id?: unknown } | null;
  const id = typeof corpo?.id === "string" ? corpo.id : "";

  if (!id) {
    return NextResponse.json({ erro: "Nota fiscal inválida." }, { status: 400 });
  }

  const nota = await prisma.notaFiscal.findUnique({
    where: { id },
    include: { recebimentos: { select: { id: true } } },
  });

  if (!nota) {
    return NextResponse.json({ erro: "Nota fiscal não encontrada." }, { status: 404 });
  }


  if (nota.recebimentos.length) {
    return NextResponse.json(
      { erro: "Esta nota fiscal possui histórico financeiro e não pode ser excluída." },
      { status: 409 }
    );
  }

  await prisma.notaFiscal.delete({ where: { id } });
  await registrarAuditoria({ sessao: guarda.sessao, modulo: "Notas Fiscais", acao: "excluir", registroId: nota.id, descricao: `Nota fiscal ${nota.numero} excluída.`, antes: nota });

  return NextResponse.json({ ok: true });
}
