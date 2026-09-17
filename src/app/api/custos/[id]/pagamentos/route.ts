import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";
import { exigirSessao, podeGravar } from "@/lib/auth/guarda";
import { financeiroDoCusto } from "@/lib/financeiro/motor";
import { historico, paraEventos, validarLancamento, liquidoCom } from "@/lib/financeiro/eventos";

interface Ctx { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const guarda = await exigirSessao();
  if (guarda.erro) return guarda.erro;

  const { id } = await params;
  const pagamentos = await prisma.pagamentoCusto.findMany({
    where: { custoId: id },
    orderBy: { criadoEm: "asc" },
  });
  return NextResponse.json({ eventos: historico(pagamentos) });
}

export async function POST(req: Request, { params }: Ctx) {
  const guarda = await podeGravar();
  if (guarda.erro) return guarda.erro;

  const { id } = await params;
  const custo = await prisma.custo.findUnique({
    where: { id },
    include: { pagamentos: true },
  });
  if (!custo) return NextResponse.json({ erro: "Custo não encontrado." }, { status: 404 });

  const f = financeiroDoCusto({
    id: custo.id, descricao: custo.descricao, tipo: custo.tipo,
    competencia: custo.competencia, vencimento: custo.vencimento,
    valorPrevisto: custo.valorPrevisto, pagamentos: paraEventos(custo.pagamentos),
  });

  // Mesmo um custo totalmente pago precisa aceitar ESTORNO de um pagamento
  // existente. A própria validação abaixo impede um NOVO pagamento quando o
  // saldo está zerado, mas permite neutralizar um lançamento anterior.
  const analise = validarLancamento(
    await req.json().catch(() => null),
    custo.pagamentos,
    f.saldo,
    "saldo em aberto"
  );
  if (analise.erro) return analise.erro;
  const d = analise.dados;

  const evento = await prisma.pagamentoCusto.create({
    data: {
      custoId: id,
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
    modulo: "Custos",
    acao: d.estornoDe ? "estornar" : "registrar-pagamento",
    registroId: id,
    descricao: d.estornoDe
      ? `Custo ${custo.descricao}: estorno de R$ ${d.valor.toFixed(2)} registrado.`
      : `Custo ${custo.descricao}: movimento de R$ ${d.valor.toFixed(2)} registrado.`,
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
    pago: liquidoCom(custo.pagamentos, evento),
  });
}
