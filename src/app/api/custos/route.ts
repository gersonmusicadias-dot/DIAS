import { NextResponse } from "next/server";
import { z } from "zod";
import { TIPOS_CUSTO } from "@/lib/financeiro/constantes";
import { mensagemDeValidacao } from "@/lib/validacao";
import { prisma } from "@/lib/prisma";
import { exigirSessao } from "@/lib/auth/guarda";
import { financeiroDoCusto } from "@/lib/financeiro/motor";
import { registrarAuditoria } from "@/lib/auditoria";

const COMPETENCIA = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

export async function GET() {
  const guarda = await exigirSessao();
  if (guarda.erro) return guarda.erro;

  const custos = await prisma.custo.findMany({
    include: {
      categoria: { select: { id: true, nome: true } },
      pagamentos: true,
      anexos: { select: { id: true, nomeArquivo: true, tamanhoBytes: true, mimeType: true }, orderBy: { criadoEm: "asc" } },
    },
    orderBy: [{ competencia: "desc" }, { vencimento: "asc" }],
  });

  return NextResponse.json({
    custos: custos.map((c) => {
      const f = financeiroDoCusto({
        id: c.id, descricao: c.descricao, tipo: c.tipo,
        competencia: c.competencia, vencimento: c.vencimento,
        valorPrevisto: c.valorPrevisto, categoriaNome: c.categoria?.nome,
        pagamentos: c.pagamentos.map((p) => ({
          id: p.id, data: p.data, valor: p.valor,
          tipo: p.tipo === "REVERSAL" ? "REVERSAL" : "NORMAL",
        })),
      });
      return {
        id: c.id, descricao: c.descricao, tipo: c.tipo,
        categoria: c.categoria?.nome ?? null,
        categoriaId: c.categoriaId,
        competencia: c.competencia, vencimento: c.vencimento,
        observacoes: c.observacoes,
        previsto: f.previsto, pago: f.pago, saldo: f.saldo,
        // Situação é derivada, nunca gravada: assim não há como o status
        // gravado divergir dos eventos.
        situacao: f.pago <= 0 ? "PREVISTO" : f.saldo > 0 ? "PARCIAL" : "PAGO",
        temMovimento: c.pagamentos.length > 0,
        anexos: c.anexos,
      };
    }),
  });
}

const novoCusto = z.object({
  descricao: z.string().min(2, "Informe a descrição."),
  tipo: z.enum(TIPOS_CUSTO),
  categoriaId: z.string().optional().nullable(),
  competencia: z.string().regex(COMPETENCIA, "Competência inválida (AAAA-MM)."),
  vencimento: z.string().regex(DATA, "Vencimento inválido (AAAA-MM-DD)."),
  valorPrevisto: z.number().positive("O valor previsto deve ser maior que zero."),
  observacoes: z.string().max(1000, "A observação pode ter no máximo 1000 caracteres.").optional().nullable(),
});

const criarCusto = novoCusto.extend({
  recorrente: z.boolean().optional().default(false),
  mesesRecorrencia: z.number().int().min(2).max(60).optional(),
});

function adicionarMes(competencia: string, meses: number) {
  const [ano, mes] = competencia.split("-").map(Number);
  const total = ano * 12 + (mes - 1) + meses;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

function adicionarMesNaData(data: string, meses: number) {
  const [ano, mes, diaOriginal] = data.split("-").map(Number);
  const total = ano * 12 + (mes - 1) + meses;
  const novoAno = Math.floor(total / 12);
  const novoMes = (total % 12) + 1;
  const ultimoDia = new Date(Date.UTC(novoAno, novoMes, 0)).getUTCDate();
  const dia = Math.min(diaOriginal, ultimoDia);
  return `${novoAno}-${String(novoMes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

export async function POST(req: Request) {
  const guarda = await exigirSessao();
  if (guarda.erro) return guarda.erro;
  if (guarda.sessao.papel === "LEITURA") {
    return NextResponse.json({ erro: "Seu perfil é somente leitura." }, { status: 403 });
  }

  const dados = criarCusto.safeParse(await req.json().catch(() => null));
  if (!dados.success) {
    return NextResponse.json(
      { erro: mensagemDeValidacao(dados.error) },
      { status: 400 }
    );
  }

  const quantidade =
    dados.data.recorrente ? (dados.data.mesesRecorrencia ?? 12) : 1;

  const custos = await prisma.$transaction(
    Array.from({ length: quantidade }, (_, indice) => {
      const competencia = adicionarMes(dados.data.competencia, indice);
      return prisma.custo.create({
        data: {
          descricao: dados.data.descricao.trim(),
          tipo: dados.data.tipo,
          categoriaId: dados.data.categoriaId || null,
          competencia,
          vencimento: adicionarMesNaData(dados.data.vencimento, indice),
          valorPrevisto: dados.data.valorPrevisto,
          observacoes: dados.data.observacoes?.trim() || null,
        },
      });
    })
  );

  const custo = custos[0];

  await registrarAuditoria({
    sessao: guarda.sessao,
    modulo: "Custos",
    acao: dados.data.recorrente ? "criar-recorrencia" : "criar",
    registroId: custo.id,
    descricao: dados.data.recorrente
      ? `Custo ${custo.descricao} cadastrado com recorrência de ${quantidade} competências.`
      : `Custo ${custo.descricao} cadastrado.`,
    depois: dados.data.recorrente
      ? {
          recorrente: true,
          quantidade,
          primeiroCustoId: custo.id,
          custos: custos.map((item) => ({
            id: item.id,
            competencia: item.competencia,
            vencimento: item.vencimento,
            valorPrevisto: item.valorPrevisto,
          })),
        }
      : custo,
  });

  return NextResponse.json({
    ok: true,
    custo,
    custosCriados: custos.length,
  });
}

export async function PATCH(req: Request) {
  const guarda = await exigirSessao();
  if (guarda.erro) return guarda.erro;

  if (guarda.sessao.papel === "LEITURA") {
    return NextResponse.json(
      { erro: "Seu perfil \u00e9 somente leitura." },
      { status: 403 }
    );
  }

  const editarCusto = novoCusto.extend({
    id: z.string().min(1),
  });

  const dados = editarCusto.safeParse(
    await req.json().catch(() => null)
  );

  if (!dados.success) {
    return NextResponse.json(
      { erro: mensagemDeValidacao(dados.error) },
      { status: 400 }
    );
  }

  const atual = await prisma.custo.findUnique({
    where: { id: dados.data.id },
    include: { pagamentos: true },
  });

  if (!atual) {
    return NextResponse.json(
      { erro: "Custo n\u00e3o encontrado." },
      { status: 404 }
    );
  }

  const financeiro = financeiroDoCusto({
    id: atual.id,
    descricao: atual.descricao,
    tipo: atual.tipo,
    competencia: atual.competencia,
    vencimento: atual.vencimento,
    valorPrevisto: atual.valorPrevisto,
    pagamentos: atual.pagamentos.map((p) => ({
      id: p.id,
      data: p.data,
      valor: p.valor,
      tipo: p.tipo === "REVERSAL" ? "REVERSAL" : "NORMAL",
    })),
  });

  // Mesma regra j\u00e1 aplicada a Notas Fiscais e Recibos: editar n\u00e3o exige
  // estornar primeiro, mas o valor previsto n\u00e3o pode cair abaixo do que j\u00e1
  // foi pago \u2014 isso deixaria o custo com saldo negativo.
  if (dados.data.valorPrevisto + 0.005 < financeiro.pago) {
    return NextResponse.json(
      {
        erro: `O valor previsto n\u00e3o pode ser inferior a R$ ${financeiro.pago.toFixed(2)} porque esse valor j\u00e1 foi pago. Estorne primeiro o pagamento excedente.`,
      },
      { status: 409 }
    );
  }

  const custo = await prisma.custo.update({
    where: { id: dados.data.id },
    data: {
      descricao: dados.data.descricao.trim(),
      tipo: dados.data.tipo,
      categoriaId: dados.data.categoriaId || null,
      competencia: dados.data.competencia,
      vencimento: dados.data.vencimento,
      valorPrevisto: dados.data.valorPrevisto,
      observacoes: dados.data.observacoes?.trim() || null,
    },
  });

  await registrarAuditoria({
    sessao: guarda.sessao,
    modulo: "Custos",
    acao: "editar",
    registroId: custo.id,
    descricao: `Custo ${custo.descricao} alterado.`,
    antes: atual,
    depois: custo,
  });

  return NextResponse.json({ ok: true, custo });
}
export async function DELETE(req: Request) {
  const guarda = await exigirSessao();
  if (guarda.erro) return guarda.erro;

  if (guarda.sessao.papel === "LEITURA") {
    return NextResponse.json(
      { erro: "Seu perfil é somente leitura." },
      { status: 403 }
    );
  }

  const dados = z.object({
    id: z.string().min(1),
  }).safeParse(await req.json().catch(() => null));

  if (!dados.success) {
    return NextResponse.json(
      { erro: "Custo inválido." },
      { status: 400 }
    );
  }

  const custo = await prisma.custo.findUnique({
    where: { id: dados.data.id },
    include: { pagamentos: true },
  });

  if (!custo) {
    return NextResponse.json(
      { erro: "Custo não encontrado." },
      { status: 404 }
    );
  }

  if (custo.pagamentos.length > 0) {
    return NextResponse.json(
      {
        erro:
          "Este custo possui histórico financeiro e não pode ser excluído. Preserve o lançamento para manter a rastreabilidade.",
      },
      { status: 409 }
    );
  }

  await prisma.custo.delete({
    where: { id: custo.id },
  });

  await registrarAuditoria({
    sessao: guarda.sessao,
    modulo: "Custos",
    acao: "excluir",
    registroId: custo.id,
    descricao: `Custo ${custo.descricao} excluído.`,
    antes: custo,
  });

  return NextResponse.json({ ok: true });
}