import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";
import { exigirSessao, podeGravar } from "@/lib/auth/guarda";
import { financeiroDaNota } from "@/lib/financeiro/motor";
import { historico, paraEventos, validarLancamento, liquidoCom } from "@/lib/financeiro/eventos";

interface Ctx { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const guarda = await exigirSessao();
  if (guarda.erro) return guarda.erro;

  const { id } = await params;
  const recebimentos = await prisma.recebimentoNota.findMany({
    where: { notaId: id },
    orderBy: { criadoEm: "asc" },
  });
  return NextResponse.json({ eventos: historico(recebimentos) });
}

export async function POST(req: Request, { params }: Ctx) {
  const guarda = await podeGravar();
  if (guarda.erro) return guarda.erro;

  const { id } = await params;
  const nota = await prisma.notaFiscal.findUnique({
    where: { id },
    include: { recebimentos: true },
  });
  if (!nota) return NextResponse.json({ erro: "Nota não encontrada." }, { status: 404 });

  const f = financeiroDaNota({
    id: nota.id, numero: nota.numero, competencia: nota.competencia,
    dataEmissao: nota.dataEmissao, status: nota.status,
    valorPrevisto: nota.valorPrevisto, valorNota: nota.valorNota,
    recebimentos: paraEventos(nota.recebimentos),
  });

  // Nota que ainda não foi emitida não tem o que receber: receber antes de
  // faturar inverteria a ordem que o sistema inteiro assume.
  if (!f.emitida) {
    return NextResponse.json(
      { erro: "Emita a nota antes de registrar recebimento." },
      { status: 400 }
    );
  }

  const analise = validarLancamento(
    await req.json().catch(() => null),
    nota.recebimentos,
    f.saldo,
    "saldo a receber"
  );
  if (analise.erro) return analise.erro;
  const d = analise.dados;

  const evento = await prisma.recebimentoNota.create({
    data: {
      notaId: id,
      data: d.data,
      valor: d.valor,
      tipo: d.estornoDe ? "REVERSAL" : "NORMAL",
      estornoDe: d.estornoDe ?? null,
      motivo: d.motivo?.trim() || null,
      observacao: d.observacao?.trim() || null,
    },
  });

  await registrarAuditoria({
    sessao: guarda.sessao,
    modulo: "Notas Fiscais",
    acao: d.estornoDe ? "estornar" : "registrar-recebimento",
    registroId: id,
    descricao: d.estornoDe
      ? `Nota ${nota.numero}: estorno de R$ ${d.valor.toFixed(2)} registrado.`
      : `Nota ${nota.numero}: movimento de R$ ${d.valor.toFixed(2)} registrado.`,
    depois: {
      eventoId: evento.id,
      data: evento.data,
      valor: evento.valor,
      tipo: evento.tipo,
      estornoDe: evento.estornoDe,
      motivo: evento.motivo,
      observacao: evento.observacao,
    },
  });

  return NextResponse.json({
    ok: true,
    evento,
    recebido: liquidoCom(nota.recebimentos, evento),
  });
}
