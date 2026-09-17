import { NextResponse } from "next/server";
import { z } from "zod";
import { liquido, type Evento } from "./motor";
import { mensagemDeValidacao } from "@/lib/validacao";

/**
 * Regras de lançamento e estorno, escritas UMA vez.
 *
 * Custo, Nota Fiscal e Recibo têm o mesmo comportamento financeiro: um
 * documento com valor, uma pilha de eventos append-only, e um saldo que é a
 * diferença. Triplicar essa lógica seria triplicar a chance de as três
 * divergirem com o tempo.
 */

const DATA = /^\d{4}-\d{2}-\d{2}$/;

export const esquemaLancamento = z.object({
  data: z.string().regex(DATA, "Data inválida."),
  valor: z.number().positive("O valor deve ser maior que zero."),
  observacao: z.string().optional(),
  /// Preenchido só quando o lançamento é um estorno.
  estornoDe: z.string().optional(),
  motivo: z.string().optional(),
});

export type Lancamento = z.infer<typeof esquemaLancamento>;

export interface EventoGravado {
  id: string;
  data: string;
  valor: number;
  tipo: string;
  estornoDe?: string | null;
  motivo?: string | null;
  observacao?: string | null;
}

export function paraEventos(gravados: EventoGravado[]): Evento[] {
  return gravados.map((e) => ({
    id: e.id,
    data: e.data,
    valor: e.valor,
    tipo: e.tipo === "REVERSAL" ? "REVERSAL" : "NORMAL",
  }));
}

/** Histórico pronto para a tela, já dizendo o que ainda pode ser estornado. */
export function historico(gravados: EventoGravado[]) {
  const jaEstornados = new Set(
    gravados.filter((e) => e.estornoDe).map((e) => e.estornoDe as string)
  );
  return gravados.map((e) => ({
    id: e.id,
    data: e.data,
    valor: e.valor,
    tipo: e.tipo,
    motivo: e.motivo ?? null,
    observacao: e.observacao ?? null,
    estornado: jaEstornados.has(e.id),
    podeEstornar: e.tipo === "NORMAL" && !jaEstornados.has(e.id),
  }));
}

type Recusa = { erro: NextResponse };
type Aprovado = { erro?: never; dados: Lancamento };

/**
 * Valida o lançamento contra o estado atual do documento.
 *
 * Devolve a recusa pronta ou os dados aprovados. Quem chama só precisa
 * gravar — as três regras que protegem o histórico ficam aqui:
 *   - não receber/pagar mais que o saldo em aberto;
 *   - não estornar duas vezes o mesmo lançamento;
 *   - não estornar mais do que o lançamento original.
 */
export function validarLancamento(
  entrada: unknown,
  gravados: EventoGravado[],
  saldoEmAberto: number,
  rotuloValor = "saldo em aberto"
): Recusa | Aprovado {
  const analise = esquemaLancamento.safeParse(entrada);
  if (!analise.success) {
    return {
      erro: NextResponse.json(
        { erro: mensagemDeValidacao(analise.error) },
        { status: 400 }
      ),
    };
  }
  const dados = analise.data;

  if (dados.estornoDe) {
    const original = gravados.find((e) => e.id === dados.estornoDe);
    if (!original || original.tipo !== "NORMAL") {
      return { erro: NextResponse.json({ erro: "Lançamento original inválido." }, { status: 400 }) };
    }
    if (gravados.some((e) => e.estornoDe === original.id)) {
      return { erro: NextResponse.json({ erro: "Este lançamento já foi estornado." }, { status: 409 }) };
    }
    if (dados.valor > original.valor) {
      return {
        erro: NextResponse.json(
          { erro: "O estorno não pode ser maior que o lançamento original." },
          { status: 400 }
        ),
      };
    }
    if (!dados.motivo?.trim()) {
      return { erro: NextResponse.json({ erro: "Informe o motivo do estorno." }, { status: 400 }) };
    }
    return { dados };
  }

  if (dados.valor > saldoEmAberto + 0.005) {
    return {
      erro: NextResponse.json(
        { erro: `O valor excede o ${rotuloValor} (${saldoEmAberto.toFixed(2)}).` },
        { status: 400 }
      ),
    };
  }

  return { dados };
}

/** Líquido depois de incluir um evento novo — para devolver na resposta. */
export function liquidoCom(gravados: EventoGravado[], novo: EventoGravado): number {
  return liquido(paraEventos([...gravados, novo]));
}
