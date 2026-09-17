import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";
import { exigirSessao, podeGravar } from "@/lib/auth/guarda";
import { financeiroDoRecibo } from "@/lib/financeiro/motor";
import { historico, paraEventos, validarLancamento, liquidoCom } from "@/lib/financeiro/eventos";

interface Ctx { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const guarda = await exigirSessao();
  if (guarda.erro) return guarda.erro;

  const { id } = await params;
  const recebimentos = await prisma.recebimentoRecibo.findMany({
    where: { reciboId: id },
    orderBy: { criadoEm: "asc" },
  });
  return NextResponse.json({ eventos: historico(recebimentos) });
}

export async function POST(req: Request, { params }: Ctx) {
  const guarda = await podeGravar();
  if (guarda.erro) return guarda.erro;

  const { id } = await params;
  const recibo = await prisma.recibo.findUnique({
    where: { id },
    include: { recebimentos: true, substituidoPor: { select: { id: true } } },
  });
  if (!recibo) return NextResponse.json({ erro: "Recibo não encontrado." }, { status: 404 });

  if (recibo.status === "SUBSTITUIDO" || recibo.substituidoPor) {
return NextResponse.json(
{ erro: "Este recibo foi substituído e não pode receber novos movimentos." },
{ status: 409 }
);
}

const f = financeiroDoRecibo({
    id: recibo.id, identificador: recibo.identificador, competencia: recibo.competencia,
    dataEmissao: recibo.dataEmissao, valorPrevisto: recibo.valorPrevisto,
    valorRecibo: recibo.valorRecibo, recebimentos: paraEventos(recibo.recebimentos),
  });

  if (!f.foiEmitido) {
    return NextResponse.json(
      { erro: "Emita o recibo antes de registrar recebimento." },
      { status: 400 }
    );
  }

  const analise = validarLancamento(
    await req.json().catch(() => null),
    recibo.recebimentos,
    f.saldo,
    "saldo a receber"
  );
  if (analise.erro) return analise.erro;
  const d = analise.dados;

  const evento = await prisma.recebimentoRecibo.create({
    data: {
      reciboId: id,
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
    modulo: "Recibos",
    acao: d.estornoDe ? "estornar" : "registrar-recebimento",
    registroId: id,
    descricao: d.estornoDe
      ? `Recibo ${recibo.identificador}: estorno de R$ ${d.valor.toFixed(2)} registrado.`
      : `Recibo ${recibo.identificador}: movimento de R$ ${d.valor.toFixed(2)} registrado.`,
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
    recebido: liquidoCom(recibo.recebimentos, evento),
  });
}
