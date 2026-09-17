import { NextResponse } from "next/server";
import { z } from "zod";
import { mensagemDeValidacao } from "@/lib/validacao";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";
import { exigirSessao, podeGravar } from "@/lib/auth/guarda";
import { carregarBase } from "@/lib/financeiro/dados";
import { visaoDeCaixa, type ModoCaixa } from "@/lib/financeiro/motor";

const DATA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * O Fluxo de Caixa é DERIVADO. Não existe tabela de lançamento de caixa:
 * cada linha nasce de um pagamento, recebimento ou previsão que já está
 * registrado no documento de origem. É isso que impede dupla contagem.
 */
export async function GET(req: Request) {
  const guarda = await exigirSessao();
  if (guarda.erro) return guarda.erro;

  const url = new URL(req.url);
  const pedido = (url.searchParams.get("modo") ?? "REALIZADO").toUpperCase();
  const modo: ModoCaixa =
    pedido === "PREVISTO" || pedido === "CONSOLIDADO" ? (pedido as ModoCaixa) : "REALIZADO";

  const inicio = url.searchParams.get("inicio") ?? undefined;
  const fim = url.searchParams.get("fim") ?? undefined;

  const base = await carregarBase();
  const visao = visaoDeCaixa(
    base,
    modo,
    inicio && DATA.test(inicio) ? inicio : undefined,
    fim && DATA.test(fim) ? fim : undefined
  );

  return NextResponse.json({ visao });
}

const saldo = z.object({
  valor: z.number(),
  dataReferencia: z.string().regex(DATA, "Data de referência inválida."),
});

/** Saldo inicial: registro único. Definir de novo substitui o anterior. */
export async function POST(req: Request) {
  const guarda = await podeGravar();
  if (guarda.erro) return guarda.erro;

  const dados = saldo.safeParse(await req.json().catch(() => null));
  if (!dados.success) {
    return NextResponse.json(
      { erro: mensagemDeValidacao(dados.error) },
      { status: 400 }
    );
  }

  const existente = await prisma.saldoCaixa.findFirst({ orderBy: { criadoEm: "asc" } });
  const registro = existente
    ? await prisma.saldoCaixa.update({
        where: { id: existente.id },
        data: { valor: dados.data.valor, dataReferencia: dados.data.dataReferencia },
      })
    : await prisma.saldoCaixa.create({ data: dados.data });

  await registrarAuditoria({
  sessao: guarda.sessao,
  modulo: "Fluxo de Caixa",
  acao: existente ? "alterar-saldo-inicial" : "definir-saldo-inicial",
  registroId: registro.id,
  descricao: existente
    ? "Saldo inicial do caixa alterado."
    : "Saldo inicial do caixa configurado.",
  antes: existente
    ? {
        valor: existente.valor,
        dataReferencia: existente.dataReferencia,
      }
    : undefined,
  depois: {
    valor: registro.valor,
    dataReferencia: registro.dataReferencia,
  },
});

return NextResponse.json({ ok: true, saldo: registro });
}
