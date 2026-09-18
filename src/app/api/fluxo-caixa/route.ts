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

  // Valor bruto gravado no registro único de saldo — o que o POST realmente
  // soma. Diferente de visao.saldoInicial, que é ajustado ao período filtrado
  // e confundia quem via "Acrescentar saldo" com um número que não é o somado.
  return NextResponse.json({ visao, saldoInicialConfigurado: base.saldo?.valor ?? 0 });
}

const saldoNovo = z.object({
  valor: z.number(),
  dataReferencia: z.string().regex(DATA, "Data de referência inválida."),
});

const saldoAcrescimo = z.object({
  valor: z.number(),
});

/**
 * Saldo inicial: definido uma única vez. Depois de configurado, o valor
 * enviado é ACRESCENTADO ao existente — nunca substitui a data nem o valor
 * já gravados, para que um novo lançamento não apague o saldo anterior.
 */
export async function POST(req: Request) {
  const guarda = await podeGravar();
  if (guarda.erro) return guarda.erro;

  const corpo = await req.json().catch(() => null);
  const existente = await prisma.saldoCaixa.findFirst({ orderBy: { criadoEm: "asc" } });

  if (!existente) {
    const dados = saldoNovo.safeParse(corpo);
    if (!dados.success) {
      return NextResponse.json(
        { erro: mensagemDeValidacao(dados.error) },
        { status: 400 }
      );
    }

    const registro = await prisma.saldoCaixa.create({ data: dados.data });

    await registrarAuditoria({
      sessao: guarda.sessao,
      modulo: "Fluxo de Caixa",
      acao: "definir-saldo-inicial",
      registroId: registro.id,
      descricao: "Saldo inicial do caixa configurado.",
      depois: { valor: registro.valor, dataReferencia: registro.dataReferencia },
    });

    return NextResponse.json({ ok: true, saldo: registro });
  }

  const dados = saldoAcrescimo.safeParse(corpo);
  if (!dados.success) {
    return NextResponse.json(
      { erro: mensagemDeValidacao(dados.error) },
      { status: 400 }
    );
  }

  const valorAnterior = existente.valor;
  const registro = await prisma.saldoCaixa.update({
    where: { id: existente.id },
    data: { valor: valorAnterior + dados.data.valor },
  });

  await registrarAuditoria({
    sessao: guarda.sessao,
    modulo: "Fluxo de Caixa",
    acao: "acrescentar-saldo-inicial",
    registroId: registro.id,
    descricao: `Saldo inicial acrescido em ${dados.data.valor}.`,
    antes: { valor: valorAnterior, dataReferencia: existente.dataReferencia },
    depois: { valor: registro.valor, dataReferencia: registro.dataReferencia },
  });

  return NextResponse.json({ ok: true, saldo: registro });
}
