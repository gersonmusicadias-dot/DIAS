import {
  financeiroDoCusto, financeiroDaNota, financeiroDoRecibo,
  type BaseFinanceira,
} from "./motor";

/**
 * O que precisa de atenção hoje.
 *
 * Tudo aqui é DERIVADO do que já está lançado — nenhum alerta é gravado,
 * marcado como lido ou agendado, porque nada disso existiria de verdade.
 * O que a tela mostra é o resultado de uma conta feita na hora sobre os
 * mesmos dados do Balancete: se um custo venceu e ainda tem saldo, ele
 * aparece; quando for pago, some sozinho.
 *
 * A régua é sempre o SALDO EM ABERTO, nunca o valor do documento. Um custo
 * de 8.000 já pago não está vencido, e um pago pela metade está vencido
 * pelos 4.000 que faltam — não pelos 8.000.
 */

export type Gravidade = "vencido" | "proximo";

export interface Alerta {
  id: string;
  gravidade: Gravidade;
  /** "pagar" sai da empresa; "receber" entra. */
  direcao: "pagar" | "receber";
  titulo: string;
  detalhe: string;
  data: string;
  /** Dias até a data. Negativo quando já passou. */
  dias: number;
  valor: number;
  destino: string;
}

export interface Alertas {
  vencidos: Alerta[];
  proximos: Alerta[];
  aPagarVencido: number;
  aReceberVencido: number;
}

/** Diferença em dias entre duas datas ISO, sem envolver fuso horário. */
function diasEntre(de: string, ate: string): number {
  const [a1, m1, d1] = de.split("-").map(Number);
  const [a2, m2, d2] = ate.split("-").map(Number);
  const um = Date.UTC(a1, m1 - 1, d1);
  const dois = Date.UTC(a2, m2 - 1, d2);
  return Math.round((dois - um) / 86400000);
}

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @param hoje data de referência em ISO. Vem de fora para que a função seja
 *   determinística — um alerta que depende do relógio não dá para testar.
 * @param janela quantos dias à frente contam como "está chegando".
 */
export function alertasDaBase(
  base: BaseFinanceira,
  hoje: string,
  janela = 7
): Alertas {
  const achados: Alerta[] = [];

  for (const custo of base.custos) {
    const { saldo } = financeiroDoCusto(custo);
    if (saldo <= 0 || !DATA_ISO.test(custo.vencimento)) continue;

    const dias = diasEntre(hoje, custo.vencimento);
    if (dias > janela) continue;

    achados.push({
      id: "custo:" + custo.id,
      gravidade: dias < 0 ? "vencido" : "proximo",
      direcao: "pagar",
      titulo: custo.descricao,
      detalhe: custo.categoriaNome ?? custo.tipo,
      data: custo.vencimento,
      dias,
      valor: saldo,
      destino: "/custos",
    });
  }

  for (const nota of base.notas) {
    const { saldo } = financeiroDaNota(nota);
    // Nota ainda não emitida não tem o que cobrar de ninguém.
    if (saldo <= 0 || !nota.dataEmissao) continue;
    if (!nota.previsaoRecebimento || !DATA_ISO.test(nota.previsaoRecebimento)) continue;

    const dias = diasEntre(hoje, nota.previsaoRecebimento);
    if (dias > janela) continue;

    achados.push({
      id: "nota:" + nota.id,
      gravidade: dias < 0 ? "vencido" : "proximo",
      direcao: "receber",
      titulo: "NF " + nota.numero,
      detalhe: nota.clienteNome ?? "Sem cliente",
      data: nota.previsaoRecebimento,
      dias,
      valor: saldo,
      destino: "/notas-fiscais",
    });
  }

  for (const recibo of base.recibos) {
    // Recibo substituído é histórico: não pode voltar como cobrança/vencido.
    if (recibo.substituido) continue;
    const { saldo } = financeiroDoRecibo(recibo);
    if (saldo <= 0 || !recibo.dataEmissao) continue;
    if (!recibo.previsaoRecebimento || !DATA_ISO.test(recibo.previsaoRecebimento)) continue;

    const dias = diasEntre(hoje, recibo.previsaoRecebimento);
    if (dias > janela) continue;

    achados.push({
      id: "recibo:" + recibo.id,
      gravidade: dias < 0 ? "vencido" : "proximo",
      direcao: "receber",
      titulo: recibo.identificador,
      detalhe: recibo.clienteNome ?? "Sem cliente",
      data: recibo.previsaoRecebimento,
      dias,
      valor: saldo,
      destino: "/recibos",
    });
  }

  // O mais atrasado primeiro; empate desempata pelo maior valor.
  const ordenar = (a: Alerta, b: Alerta) => a.dias - b.dias || b.valor - a.valor;

  const vencidos = achados.filter((a) => a.gravidade === "vencido").sort(ordenar);
  const proximos = achados.filter((a) => a.gravidade === "proximo").sort(ordenar);

  const somar = (lista: Alerta[], direcao: Alerta["direcao"]) =>
    lista.filter((a) => a.direcao === direcao).reduce((s, a) => s + a.valor, 0);

  return {
    vencidos,
    proximos,
    aPagarVencido: somar(vencidos, "pagar"),
    aReceberVencido: somar(vencidos, "receber"),
  };
}

/** "há 3 dias", "hoje", "em 5 dias" — do jeito que se fala. */
export function comoDizerOPrazo(dias: number): string {
  if (dias === 0) return "vence hoje";
  if (dias === 1) return "vence amanhã";
  if (dias === -1) return "venceu ontem";
  if (dias > 1) return `vence em ${dias} dias`;
  return `venceu há ${Math.abs(dias)} dias`;
}
