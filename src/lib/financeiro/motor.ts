/**
 * MOTOR FINANCEIRO
 *
 * Porte fiel das regras homologadas do fluxomed_v2.html. Nada foi
 * "melhorado" aqui: onde o original decidia de um jeito, este código decide
 * igual. O que existe de novo é só a tipagem.
 *
 * Funções puras: recebem os dados já lidos do banco e devolvem números.
 * Não conhecem Prisma, não fazem I/O e por isso podem ser testadas
 * diretamente contra os mesmos cenários que validaram o original.
 */

export type TipoEvento = "NORMAL" | "REVERSAL";

export interface Evento {
  id: string;
  data: string;
  valor: number;
  tipo: TipoEvento;
  estornoDe?: string | null;
}

export interface CustoEntrada {
  id: string;
  descricao: string;
  tipo: string;
  competencia: string;
  vencimento: string;
  valorPrevisto: number;
  categoriaNome?: string | null;
  pagamentos: Evento[];
}

export interface NotaEntrada {
  id: string;
  numero: string;
  competencia: string;
  dataEmissao?: string | null;
  status: string;
  valorPrevisto: number;
  valorNota: number;
  previsaoRecebimento?: string | null;
  clienteNome?: string | null;
  medicaoId?: string | null;
  recebimentos: Evento[];
}

export interface ReciboEntrada {
  id: string;
  identificador: string;
  competencia: string;
  dataEmissao?: string | null;
  valorPrevisto: number;
  valorRecibo: number;
  previsaoRecebimento?: string | null;
  clienteNome?: string | null;
  medicaoId?: string | null;
  origem?: string | null;
  recebimentos: Evento[];
  substituido?: boolean;
}

export interface SaldoEntrada {
  valor: number;
  dataReferencia: string;
}

export interface BaseFinanceira {
  custos: CustoEntrada[];
  notas: NotaEntrada[];
  recibos: ReciboEntrada[];
  saldo: SaldoEntrada | null;
}

// ------------------------------------------------------------------
// Soma líquida de uma pilha de eventos.
//
// REVERSAL não subtrai do valor original nem o apaga: ele neutraliza. O
// líquido é o total NORMAL menos o total REVERSAL, e nunca fica negativo —
// não existe "recebeu menos que zero".
// ------------------------------------------------------------------
export function liquido(eventos: Evento[]): number {
  const normal = eventos
    .filter((e) => e.tipo !== "REVERSAL")
    .reduce((soma, e) => soma + Math.max(0, e.valor), 0);
  const estornado = eventos
    .filter((e) => e.tipo === "REVERSAL")
    .reduce((soma, e) => soma + Math.max(0, e.valor), 0);
  return Math.max(0, normal - estornado);
}

// ------------------------------------------------------------------
// Financeiro de cada documento
// ------------------------------------------------------------------

export function financeiroDoCusto(custo: CustoEntrada) {
  const previsto = Math.max(0, custo.valorPrevisto || 0);
  const pago = liquido(custo.pagamentos);
  return { previsto, pago, saldo: Math.max(0, previsto - pago) };
}

export function financeiroDaNota(nota: NotaEntrada) {
  // Nota apenas prevista não faturou nada ainda: o "faturado" é zero e o
  // valor esperado entra como previsto.
  const emitida = nota.status !== "PREVISTA" && Boolean(nota.dataEmissao);
  const faturado = emitida ? Math.max(0, nota.valorNota || 0) : 0;
  const recebido = liquido(nota.recebimentos);
  return { faturado, recebido, saldo: Math.max(0, faturado - recebido), emitida };
}

export function financeiroDoRecibo(recibo: ReciboEntrada) {
  const emitido = Boolean(recibo.dataEmissao);
  const emitidoValor = emitido ? Math.max(0, recibo.valorRecibo || 0) : 0;
  const recebido = liquido(recibo.recebimentos);
  return { emitido: emitidoValor, recebido, saldo: Math.max(0, emitidoValor - recebido), foiEmitido: emitido };
}

// ------------------------------------------------------------------
// Resultado por competência — a mesma conta do Balancete
// ------------------------------------------------------------------

export interface LinhaReceita {
  origem: "Nota Fiscal" | "Recibo";
  documento: string;
  cliente: string;
  realizado: number;
  previsto: number;
}

export interface LinhaDespesa {
  descricao: string;
  categoria: string;
  tipo: string;
  realizado: number;
  previsto: number;
}

export interface Economia {
  competencia: string;
  receitas: LinhaReceita[];
  despesas: LinhaDespesa[];
  receitasRealizadas: number;
  receitasPrevistas: number;
  despesasRealizadas: number;
  despesasPrevistas: number;
  resultadoRealizado: number;
  resultadoProjetado: number;
  composicao: { origem: string; realizado: number; previsto: number }[];
}

export function economiaDaCompetencia(base: BaseFinanceira, competencia: string): Economia {
  const receitas: LinhaReceita[] = [];
  const despesas: LinhaDespesa[] = [];

  base.notas
    .filter((n) => n.competencia === competencia)
    .forEach((nota) => {
      const f = financeiroDaNota(nota);
      receitas.push({
        origem: "Nota Fiscal",
        documento: `NF ${nota.numero || "—"}`,
        cliente: nota.clienteNome ?? "—",
        realizado: f.recebido,
        // Emitida: o que falta receber. Prevista: o valor esperado inteiro.
        previsto: f.emitida ? f.saldo : Math.max(0, nota.valorPrevisto || 0),
      });
    });

  base.recibos
    .filter((r) => r.competencia === competencia && !r.substituido)
    .forEach((recibo) => {
      const f = financeiroDoRecibo(recibo);
      receitas.push({
        origem: "Recibo",
        documento: recibo.identificador || "—",
        cliente: recibo.clienteNome ?? "—",
        realizado: f.recebido,
        previsto: f.foiEmitido ? f.saldo : Math.max(0, recibo.valorPrevisto || 0),
      });
    });

  base.custos
    .filter((c) => c.competencia === competencia)
    .forEach((custo) => {
      const f = financeiroDoCusto(custo);
      despesas.push({
        descricao: custo.descricao || "—",
        categoria: custo.categoriaNome ?? "Sem categoria",
        tipo: custo.tipo || "—",
        realizado: f.pago,
        previsto: f.saldo,
      });
    });

  const soma = <T>(lista: T[], campo: (item: T) => number) =>
    lista.reduce((total, item) => total + campo(item), 0);

  const receitasRealizadas = soma(receitas, (r) => r.realizado);
  const receitasPrevistas = soma(receitas, (r) => r.previsto);
  const despesasRealizadas = soma(despesas, (d) => d.realizado);
  const despesasPrevistas = soma(despesas, (d) => d.previsto);

  const porOrigem = (origem: string, campo: "realizado" | "previsto") =>
    soma(receitas.filter((r) => r.origem === origem), (r) => r[campo]);

  return {
    competencia,
    receitas,
    despesas,
    receitasRealizadas,
    receitasPrevistas,
    despesasRealizadas,
    despesasPrevistas,
    resultadoRealizado: receitasRealizadas - despesasRealizadas,
    resultadoProjetado:
      receitasRealizadas + receitasPrevistas - despesasRealizadas - despesasPrevistas,
    composicao: [
      { origem: "Notas Fiscais", realizado: porOrigem("Nota Fiscal", "realizado"), previsto: porOrigem("Nota Fiscal", "previsto") },
      { origem: "Recibos", realizado: porOrigem("Recibo", "realizado"), previsto: porOrigem("Recibo", "previsto") },
      { origem: "Custos", realizado: despesasRealizadas, previsto: despesasPrevistas },
    ],
  };
}

// ------------------------------------------------------------------
// Caixa
//
// A distinção que não pode ser perdida: o Fluxo de Caixa classifica pela
// DIREÇÃO DO DINHEIRO, e não pela natureza econômica. Estorno de pagamento
// de custo é dinheiro VOLTANDO — entra no caixa, ainda que no Balancete
// reduza despesa.
// ------------------------------------------------------------------

export interface Movimento {
  id: string;
  data: string;
  tipo: string;
  documento: string;
  descricao: string;
  valor: number;
  previsto: boolean;
  estornoDe?: string | null;
}

export function movimentosDeCaixa(base: BaseFinanceira): Movimento[] {
  const movimentos: Movimento[] = [];

  base.notas.forEach((nota) => {
    nota.recebimentos.forEach((e) => {
      const estorno = e.tipo === "REVERSAL";
      const valor = Math.max(0, e.valor);
      movimentos.push({
        id: e.id,
        data: e.data,
        tipo: estorno ? "Estorno de recebimento de Nota Fiscal" : "Recebimento de Nota Fiscal",
        documento: `NF ${nota.numero}`,
        descricao: nota.clienteNome ?? "—",
        valor: estorno ? -valor : valor,
        previsto: false,
        estornoDe: e.estornoDe ?? null,
      });
    });
  });

  base.recibos.filter((r) => !r.substituido).forEach((recibo) => {
    recibo.recebimentos.forEach((e) => {
      const estorno = e.tipo === "REVERSAL";
      const valor = Math.max(0, e.valor);
      movimentos.push({
        id: e.id,
        data: e.data,
        tipo: estorno ? "Estorno de recebimento de Recibo" : "Recebimento de Recibo",
        documento: recibo.identificador,
        descricao: recibo.clienteNome ?? "—",
        valor: estorno ? -valor : valor,
        previsto: false,
        estornoDe: e.estornoDe ?? null,
      });
    });
  });

  base.custos.forEach((custo) => {
    custo.pagamentos.forEach((e) => {
      const estorno = e.tipo === "REVERSAL";
      const valor = Math.max(0, e.valor);
      movimentos.push({
        id: e.id,
        data: e.data,
        tipo: estorno ? "Estorno de pagamento de Custo" : "Pagamento de Custo",
        documento: custo.descricao,
        descricao: "—",
        // Pagamento sai; o estorno do pagamento entra.
        valor: estorno ? valor : -valor,
        previsto: false,
        estornoDe: e.estornoDe ?? null,
      });
    });
  });

  return movimentos;
}

/**
 * Previsões. Nunca são gravadas: nascem dos documentos em aberto a cada
 * consulta. Id determinístico para não duplicar entre recálculos.
 */
export function previsoesDeCaixa(base: BaseFinanceira): Movimento[] {
  const previstos: Movimento[] = [];

  base.custos.forEach((custo) => {
    const saldo = financeiroDoCusto(custo).saldo;
    if (saldo <= 0) return;
    previstos.push({
      id: `PREVISAO:CUSTO:${custo.id}`,
      data: custo.vencimento,
      tipo: "Previsão de pagamento de Custo",
      documento: custo.descricao,
      descricao: "—",
      valor: -saldo,
      previsto: true,
    });
  });

  base.notas.forEach((nota) => {
    const f = financeiroDaNota(nota);
    const saldo = f.emitida ? f.saldo : Math.max(0, nota.valorPrevisto || 0);
    if (saldo <= 0) return;
    previstos.push({
      id: `PREVISAO:NOTA:${nota.id}`,
      data: nota.previsaoRecebimento ?? "",
      tipo: "Previsão de recebimento de Nota Fiscal",
      documento: `NF ${nota.numero}`,
      descricao: nota.clienteNome ?? "—",
      valor: saldo,
      previsto: true,
    });
  });

  base.recibos.filter((r) => !r.substituido).forEach((recibo) => {
    const f = financeiroDoRecibo(recibo);
    const saldo = f.foiEmitido ? f.saldo : Math.max(0, recibo.valorPrevisto || 0);
    if (saldo <= 0) return;
    previstos.push({
      id: `PREVISAO:RECIBO:${recibo.id}`,
      data: recibo.previsaoRecebimento ?? "",
      tipo: "Previsão de recebimento de Recibo",
      documento: recibo.identificador,
      descricao: recibo.clienteNome ?? "—",
      valor: saldo,
      previsto: true,
    });
  });

  return previstos;
}

export type ModoCaixa = "REALIZADO" | "PREVISTO" | "CONSOLIDADO";

export interface VisaoCaixa {
  modo: ModoCaixa;
  configurado: boolean;
  saldoInicial: number;
  entradas: number;
  saidas: number;
  estornos: number;
  saldoFinal: number;
  /// Previsões sem data não entram na conta cronológica, mas continuam visíveis.
  semData: Movimento[];
  linhas: (Movimento & { saldo: number })[];
}

function ordenar(lista: Movimento[]): Movimento[] {
  return [...lista].sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
}

export function visaoDeCaixa(
  base: BaseFinanceira,
  modo: ModoCaixa = "REALIZADO",
  inicio?: string,
  fim?: string
): VisaoCaixa {
  const dataReferencia = base.saldo?.dataReferencia;
  const inicioEfetivo = inicio ?? dataReferencia;

  const noPeriodo = (m: Movimento) =>
    (!inicioEfetivo || m.data >= inicioEfetivo) && (!fim || m.data <= fim);

  const realizados = movimentosDeCaixa(base);
  const antesDoPeriodo = inicioEfetivo
    ? realizados.filter((m) => m.data < inicioEfetivo)
    : [];
  const antesDaReferencia = dataReferencia
    ? realizados.filter((m) => m.data < dataReferencia)
    : [];
  const realizadosNoPeriodo = realizados.filter(noPeriodo);

  const saldoInicial =
    (base.saldo ? base.saldo.valor : 0) +
    antesDoPeriodo.reduce((soma, m) => soma + m.valor, 0) -
    antesDaReferencia.reduce((soma, m) => soma + m.valor, 0);

  const todasPrevisoes = modo === "REALIZADO" ? [] : previsoesDeCaixa(base);
  const semData = todasPrevisoes.filter((m) => !m.data);
  const previsoesNoPeriodo = todasPrevisoes.filter((m) => m.data).filter(noPeriodo);

  const escolhidos =
    modo === "PREVISTO"
      ? previsoesNoPeriodo
      : modo === "CONSOLIDADO"
        ? realizadosNoPeriodo.concat(previsoesNoPeriodo)
        : realizadosNoPeriodo;

  const ordenados = ordenar(escolhidos);
  // Caixa é direção de dinheiro. Um estorno de pagamento devolve dinheiro
  // (entrada) e um estorno de recebimento retira dinheiro (saída). Não
  // compensamos o evento original aqui: ele pode estar fora do período
  // filtrado e o saldo precisa continuar reconciliando linha a linha.
  const estornos = ordenados.reduce((s, m) => s + (m.estornoDe ? Math.abs(m.valor) : 0), 0);
  const entradas = ordenados.reduce((s, m) => s + (m.valor > 0 ? m.valor : 0), 0);
  const saidas = ordenados.reduce((s, m) => s + (m.valor < 0 ? Math.abs(m.valor) : 0), 0);

  let corrente = saldoInicial;
  const linhas = ordenados.map((m) => {
    corrente += m.valor;
    return { ...m, saldo: corrente };
  });

  return {
    modo,
    configurado: Boolean(base.saldo),
    saldoInicial,
    entradas,
    saidas,
    estornos,
    saldoFinal: corrente,
    semData,
    linhas,
  };
}

/** Os quatro números de caixa do painel. */
export function resumoDeCaixa(base: BaseFinanceira) {
  const realizado = visaoDeCaixa(base, "REALIZADO");
  const consolidado = visaoDeCaixa(base, "CONSOLIDADO");
  return {
    configurado: realizado.configurado,
    saldoAtual: realizado.saldoFinal,
    entradas: realizado.entradas,
    saidas: realizado.saidas,
    saldoProjetado: consolidado.saldoFinal,
  };
}

/** Competência atual e aritmética de competências. */
export function competenciaAtual(): string {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
}

export function deslocarCompetencia(competencia: string, meses: number): string {
  if (!/^\d{4}-\d{2}$/.test(competencia)) return competencia;
  const [ano, mes] = competencia.split("-").map(Number);
  const total = ano * 12 + (mes - 1) + meses;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

// ------------------------------------------------------------------
// Visão anual — os doze meses do ano, com o total
// ------------------------------------------------------------------

export interface MesDoAno {
  mes: number;
  nome: string;
  competencia: string;
  receitasRealizadas: number;
  receitasPrevistas: number;
  despesasRealizadas: number;
  despesasPrevistas: number;
  resultadoRealizado: number;
  resultadoProjetado: number;
}

export const MESES_DO_ANO = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function economiaDoAno(base: BaseFinanceira, ano: number) {
  const meses: MesDoAno[] = MESES_DO_ANO.map((nome, indice) => {
    const competencia = `${ano}-${String(indice + 1).padStart(2, "0")}`;
    const eco = economiaDaCompetencia(base, competencia);
    return {
      mes: indice + 1,
      nome,
      competencia,
      receitasRealizadas: eco.receitasRealizadas,
      receitasPrevistas: eco.receitasPrevistas,
      despesasRealizadas: eco.despesasRealizadas,
      despesasPrevistas: eco.despesasPrevistas,
      resultadoRealizado: eco.resultadoRealizado,
      resultadoProjetado: eco.resultadoProjetado,
    };
  });

  const somar = (campo: keyof Omit<MesDoAno, "mes" | "nome" | "competencia">) =>
    meses.reduce((total, m) => total + m[campo], 0);

  const total = {
    receitasRealizadas: somar("receitasRealizadas"),
    receitasPrevistas: somar("receitasPrevistas"),
    despesasRealizadas: somar("despesasRealizadas"),
    despesasPrevistas: somar("despesasPrevistas"),
    resultadoRealizado: somar("resultadoRealizado"),
    resultadoProjetado: somar("resultadoProjetado"),
  };

  // Composição anual: a soma das composições mensais, origem por origem.
  const composicao = ["Notas Fiscais", "Recibos", "Custos"].map((origem) => {
    let realizado = 0;
    let previsto = 0;
    meses.forEach((m) => {
      const linha = economiaDaCompetencia(base, m.competencia).composicao
        .find((c) => c.origem === origem);
      if (linha) { realizado += linha.realizado; previsto += linha.previsto; }
    });
    return { origem, realizado, previsto };
  });

  return { ano, meses, total, composicao };
}

/**
 * Quanto de uma medição ainda pode virar documento.
 *
 * Medição NÃO gera entrada de caixa: ela vira Nota Fiscal ou Recibo, e é o
 * documento que recebe. Isto aqui só diz quanto ainda falta faturar, para a
 * tela não deixar emitir além do medido.
 */
export function saldoAFaturarDaMedicao(
  valorMedido: number,
  documentos: { valor: number }[]
): number {
  const jaFaturado = documentos.reduce((soma, d) => soma + Math.max(0, d.valor || 0), 0);
  return Math.max(0, Math.max(0, valorMedido || 0) - jaFaturado);
}
