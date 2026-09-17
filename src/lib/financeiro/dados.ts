import { prisma } from "@/lib/prisma";
import type { BaseFinanceira, Evento } from "./motor";

/**
 * Lê o banco e monta a base que o motor consome.
 *
 * Uma consulta por tabela, com os eventos vindo juntos. O motor não sabe
 * que Prisma existe — é o que permite testá-lo sem banco nenhum.
 */

const paraEvento = (e: { id: string; data: string; valor: number; tipo: string; estornoDe?: string | null }): Evento => ({
  id: e.id,
  data: e.data,
  valor: e.valor,
  tipo: e.tipo === "REVERSAL" ? "REVERSAL" : "NORMAL",
  estornoDe: e.estornoDe ?? null,
});

export async function carregarBase(): Promise<BaseFinanceira> {
  const [custos, notas, recibos, saldo] = await Promise.all([
    prisma.custo.findMany({
      include: { categoria: { select: { nome: true } }, pagamentos: true },
    }),
    prisma.notaFiscal.findMany({
      include: { cliente: { select: { nomeFantasia: true } }, recebimentos: true },
    }),
    prisma.recibo.findMany({
      include: { cliente: { select: { nomeFantasia: true } }, recebimentos: true, substituidoPor: { select: { id: true } } },
    }),
    prisma.saldoCaixa.findFirst({ orderBy: { criadoEm: "asc" } }),
  ]);

  return {
    custos: custos.map((c) => ({
      id: c.id,
      descricao: c.descricao,
      tipo: c.tipo,
      competencia: c.competencia,
      vencimento: c.vencimento,
      valorPrevisto: c.valorPrevisto,
      categoriaNome: c.categoria?.nome ?? null,
      pagamentos: c.pagamentos.map(paraEvento),
    })),
    notas: notas.map((n) => ({
      id: n.id,
      numero: n.numero,
      competencia: n.competencia,
      dataEmissao: n.dataEmissao,
      status: n.status,
      valorPrevisto: n.valorPrevisto,
      valorNota: n.valorNota,
      previsaoRecebimento: n.previsaoRecebimento,
      clienteNome: n.cliente?.nomeFantasia ?? null,
      medicaoId: n.medicaoId,
      recebimentos: n.recebimentos.map(paraEvento),
    })),
    recibos: recibos.map((r) => ({
      id: r.id,
      identificador: r.identificador,
      competencia: r.competencia,
      dataEmissao: r.dataEmissao,
      valorPrevisto: r.valorPrevisto,
      valorRecibo: r.valorRecibo,
      previsaoRecebimento: r.previsaoRecebimento,
      clienteNome: r.cliente?.nomeFantasia ?? null,
      medicaoId: r.medicaoId,
      origem: r.origem,
      recebimentos: r.recebimentos.map(paraEvento),
      substituido: Boolean(r.substituidoPor),
    })),
    saldo: saldo ? { valor: saldo.valor, dataReferencia: saldo.dataReferencia } : null,
  };
}

export function formatarReal(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

export function formatarCompetencia(competencia: string): string {
  if (!/^\d{4}-\d{2}$/.test(competencia)) return "—";
  const [ano, mes] = competencia.split("-");
  return `${mes}/${ano}`;
}

export function formatarData(data?: string | null): string {
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return "—";
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}
