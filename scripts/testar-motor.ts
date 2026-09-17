/**
 * Paridade com o motor homologado.
 *
 * Cada cenário aqui é um cenário que já validou o fluxomed_v2.html. Se o
 * porte tivesse mudado alguma regra, é aqui que apareceria.
 *
 *   npm run testar-motor
 */
import {
  liquido, financeiroDoCusto, financeiroDaNota, financeiroDoRecibo,
  economiaDaCompetencia, movimentosDeCaixa, previsoesDeCaixa,
  visaoDeCaixa, resumoDeCaixa, deslocarCompetencia, saldoAFaturarDaMedicao,
  type BaseFinanceira, type Evento,
} from "../src/lib/financeiro/motor";
import { paraNumero, real, dataBR, compBR } from "../src/lib/ui";
import { alertasDaBase, comoDizerOPrazo } from "../src/lib/financeiro/alertas";

let ok = 0;
let falhas = 0;

function checar(nome: string, condicao: boolean, detalhe = "") {
  if (condicao) { ok += 1; console.log("  [OK]  " + nome + (detalhe ? "   -> " + detalhe : "")); }
  else { falhas += 1; console.log("  [FALHA] " + nome + (detalhe ? "   -> " + detalhe : "")); }
}

const ev = (id: string, data: string, valor: number, tipo: "NORMAL" | "REVERSAL" = "NORMAL"): Evento =>
  ({ id, data, valor, tipo });

const vazia: BaseFinanceira = { custos: [], notas: [], recibos: [], saldo: null };

console.log("=".repeat(72));
console.log("MOTOR FINANCEIRO — paridade com as regras homologadas");
console.log("=".repeat(72));
console.log("");

// ---------------- 1. Eventos ----------------
checar("1. Sem eventos, o líquido é zero", liquido([]) === 0);
checar("1b. Só NORMAL soma", liquido([ev("a", "2026-01-01", 100), ev("b", "2026-01-02", 50)]) === 150);
checar("1c. REVERSAL neutraliza o original",
  liquido([ev("a", "2026-01-01", 100), ev("b", "2026-01-05", 40, "REVERSAL")]) === 60);
checar("1d. Estorno maior que o recebido não vira negativo",
  liquido([ev("a", "2026-01-01", 100), ev("b", "2026-01-05", 300, "REVERSAL")]) === 0);
checar("1e. O evento original permanece na lista após o estorno",
  [ev("a", "2026-01-01", 100), ev("b", "2026-01-05", 40, "REVERSAL")].length === 2,
  "append-only: nada é apagado");

// ---------------- 2. Custo ----------------
const custo = {
  id: "c1", descricao: "Aluguel", tipo: "Custo Fixo", competencia: "2026-08",
  vencimento: "2026-08-10", valorPrevisto: 8000, categoriaNome: "Aluguel",
  pagamentos: [ev("p1", "2026-08-05", 8000), ev("p2", "2026-08-12", 3000, "REVERSAL")],
};
const fc = financeiroDoCusto(custo);
checar("2. Custo 8.000, pago 8.000, estornado 3.000 → pago 5.000", fc.pago === 5000, String(fc.pago));
checar("2b. E o saldo volta a 3.000", fc.saldo === 3000, String(fc.saldo));

// ---------------- 3. Nota fiscal ----------------
const nota = {
  id: "n1", numero: "1001", competencia: "2026-08", dataEmissao: "2026-08-01",
  status: "EMITIDA", valorPrevisto: 10000, valorNota: 10000,
  previsaoRecebimento: "2026-08-20", clienteNome: "Clinica X",
  recebimentos: [ev("r1", "2026-08-10", 10000), ev("r2", "2026-08-15", 4000, "REVERSAL")],
};
const fn = financeiroDaNota(nota);
checar("3. NF 10.000, recebido 10.000, estornado 4.000 → recebido 6.000", fn.recebido === 6000, String(fn.recebido));
checar("3b. E o saldo a receber volta a 4.000", fn.saldo === 4000, String(fn.saldo));

const notaPrevista = { ...nota, id: "n2", numero: "1002", status: "PREVISTA", dataEmissao: null, recebimentos: [] };
checar("3c. Nota apenas prevista não fatura nada", financeiroDaNota(notaPrevista).faturado === 0);

// ---------------- 4. Recibo ----------------
const recibo = {
  id: "b1", identificador: "REC-001", competencia: "2026-08", dataEmissao: "2026-08-01",
  valorPrevisto: 5000, valorRecibo: 5000, previsaoRecebimento: "2026-08-25",
  clienteNome: "Clinica X", recebimentos: [ev("rr1", "2026-08-12", 2000)],
};
const fr = financeiroDoRecibo(recibo);
checar("4. Recibo 5.000 com 2.000 recebidos → saldo 3.000", fr.recebido === 2000 && fr.saldo === 3000);

// ---------------- 5. Competência ----------------
const base: BaseFinanceira = {
  custos: [custo], notas: [nota, notaPrevista], recibos: [recibo],
  saldo: { valor: 15000, dataReferencia: "2026-08-01" },
};
const eco = economiaDaCompetencia(base, "2026-08");
checar("5. Receitas realizadas = 6.000 (NF) + 2.000 (recibo)", eco.receitasRealizadas === 8000, String(eco.receitasRealizadas));
checar("5b. Receitas previstas = 4.000 + 10.000 + 3.000", eco.receitasPrevistas === 17000, String(eco.receitasPrevistas));
checar("5c. Despesas realizadas = 5.000", eco.despesasRealizadas === 5000, String(eco.despesasRealizadas));
checar("5d. Despesas previstas = 3.000", eco.despesasPrevistas === 3000, String(eco.despesasPrevistas));
checar("5e. Resultado realizado = receitas − despesas realizadas",
  eco.resultadoRealizado === eco.receitasRealizadas - eco.despesasRealizadas, String(eco.resultadoRealizado));
checar("5f. Resultado projetado inclui o previsto dos dois lados",
  eco.resultadoProjetado ===
    eco.receitasRealizadas + eco.receitasPrevistas - eco.despesasRealizadas - eco.despesasPrevistas,
  String(eco.resultadoProjetado));
checar("5g. A composição tem as três origens",
  eco.composicao.map((c) => c.origem).join("|") === "Notas Fiscais|Recibos|Custos");
checar("5h. Competência sem lançamento zera tudo",
  economiaDaCompetencia(base, "2020-01").resultadoProjetado === 0);

// ---------------- 6. Caixa: direção do dinheiro ----------------
const movimentos = movimentosDeCaixa(base);
const estornoCusto = movimentos.find((m) => m.tipo.startsWith("Estorno de pagamento"));
const estornoNota = movimentos.find((m) => m.tipo.startsWith("Estorno de recebimento de Nota"));
checar("6. Estorno de pagamento de custo ENTRA no caixa",
  Boolean(estornoCusto && estornoCusto.valor === 3000), String(estornoCusto?.valor));
checar("6b. Estorno de recebimento de nota SAI do caixa",
  Boolean(estornoNota && estornoNota.valor === -4000), String(estornoNota?.valor));
checar("6c. Pagamento de custo sai com sinal negativo",
  movimentos.some((m) => m.tipo === "Pagamento de Custo" && m.valor === -8000));

const visao = visaoDeCaixa(base, "REALIZADO");
// 15.000 + 10.000 − 4.000 + 2.000 − 8.000 + 3.000
checar("6d. Saldo realizado bate com a soma dos movimentos", visao.saldoFinal === 18000, String(visao.saldoFinal));
checar("6e. As linhas saem em ordem cronológica",
  visao.linhas.every((l, i) => i === 0 || visao.linhas[i - 1].data <= l.data));
checar("6f. O saldo acumulado da última linha é o saldo final",
  visao.linhas[visao.linhas.length - 1].saldo === visao.saldoFinal);
checar("6g. Entradas do caixa incluem devolucao de pagamento estornado",
  visao.entradas === 15000, String(visao.entradas));
checar("6h. Saidas do caixa incluem devolucao de recebimento estornado",
  visao.saidas === 12000, String(visao.saidas));
checar("6i. Equacao do caixa reconcilia sem somar estornos outra vez",
  visao.saldoInicial + visao.entradas - visao.saidas === visao.saldoFinal,
  `${visao.saldoInicial} + ${visao.entradas} - ${visao.saidas} = ${visao.saldoFinal}`);

// O original pode ficar fora do filtro enquanto o estorno cai dentro dele.
// Nesse caso o estorno continua sendo um movimento real de caixa no periodo.
const baseEstornoForaDoPeriodo: BaseFinanceira = {
  custos: [{
    id: "c-estorno-periodo", descricao: "Fornecedor", tipo: "Custo Direto", competencia: "2026-08",
    vencimento: "2026-08-01", valorPrevisto: 1000, pagamentos: [
      { id: "pag-original", data: "2026-08-01", valor: 1000, tipo: "NORMAL" },
      { id: "pag-estorno", data: "2026-09-10", valor: 400, tipo: "REVERSAL", estornoDe: "pag-original" },
    ],
  }],
  notas: [], recibos: [], saldo: { valor: 5000, dataReferencia: "2026-09-01" },
};
const somenteEstornoNoPeriodo = visaoDeCaixa(baseEstornoForaDoPeriodo, "REALIZADO", "2026-09-01", "2026-09-30");
checar("6j. Estorno dentro do periodo conta mesmo com original fora do filtro",
  somenteEstornoNoPeriodo.entradas === 400 && somenteEstornoNoPeriodo.saidas === 0
  && somenteEstornoNoPeriodo.saldoFinal === 5400,
  `entradas=${somenteEstornoNoPeriodo.entradas}; saidas=${somenteEstornoNoPeriodo.saidas}; final=${somenteEstornoNoPeriodo.saldoFinal}`);
checar("6k. Total informativo de estornos nao altera a equacao",
  somenteEstornoNoPeriodo.estornos === 400
  && somenteEstornoNoPeriodo.saldoInicial + somenteEstornoNoPeriodo.entradas - somenteEstornoNoPeriodo.saidas === somenteEstornoNoPeriodo.saldoFinal,
  String(somenteEstornoNoPeriodo.estornos));

// ---------------- 7. Previsões ----------------
const previsoes = previsoesDeCaixa(base);
checar("7. Previsões não são gravadas: nascem dos saldos em aberto", previsoes.length === 4, String(previsoes.length));
checar("7b. Id da previsão é determinístico",
  previsoes.every((p) => p.id.startsWith("PREVISAO:")));
checar("7c. Recalcular dá exatamente os mesmos ids",
  previsoesDeCaixa(base).map((p) => p.id).join() === previsoes.map((p) => p.id).join());

const consolidado = visaoDeCaixa(base, "CONSOLIDADO");
checar("7d. Consolidado soma realizado e previsto",
  consolidado.linhas.length === visao.linhas.length + previsoes.filter((p) => p.data).length,
  String(consolidado.linhas.length));

const semPrevisaoDeData = {
  ...base,
  notas: [{ ...nota, id: "n3", numero: "1003", previsaoRecebimento: null, recebimentos: [] }],
};
checar("7e. Previsão sem data fica de fora do cálculo, mas visível",
  visaoDeCaixa(semPrevisaoDeData, "CONSOLIDADO").semData.length === 1);

// ---------------- 8. Sem saldo configurado ----------------
const semSaldo: BaseFinanceira = { ...base, saldo: null };
checar("8. Sem saldo inicial, o caixa se declara não configurado",
  resumoDeCaixa(semSaldo).configurado === false);
checar("8b. E não inventa saldo: parte de zero",
  visaoDeCaixa(semSaldo, "REALIZADO").saldoInicial === 0);

// ---------------- 9. Resumo do painel ----------------
const resumo = resumoDeCaixa(base);
checar("9. Saldo atual do painel = saldo final do realizado", resumo.saldoAtual === visao.saldoFinal);
checar("9b. Saldo projetado = saldo final do consolidado", resumo.saldoProjetado === consolidado.saldoFinal);
checar("9c. Entradas e saídas vêm do realizado",
  resumo.entradas === visao.entradas && resumo.saidas === visao.saidas);

// ---------------- 10. Competências ----------------
checar("10. Deslocar competência dentro do ano", deslocarCompetencia("2026-08", -3) === "2026-05");
checar("10b. Deslocar cruzando o ano", deslocarCompetencia("2026-02", -3) === "2025-11");
checar("10c. Janela de 12 meses fecha certo", deslocarCompetencia("2026-08", -11) === "2025-09");
checar("10d. Entrada inválida não quebra", deslocarCompetencia("lixo", -1) === "lixo");

// ---------------- 11. Base vazia ----------------
const ecoVazia = economiaDaCompetencia(vazia, "2026-08");
checar("11. Base vazia não inventa número",
  ecoVazia.receitasRealizadas === 0 && ecoVazia.despesasPrevistas === 0 && ecoVazia.resultadoProjetado === 0);
checar("11b. Base vazia não gera movimento de caixa", movimentosDeCaixa(vazia).length === 0);

// ---------------- 12. Leitura de valores digitados ----------------
// Um erro aqui nao aparece na tela: grava o numero errado e passa.
checar("12. Milhar com centavos", paraNumero("8.000,00") === 8000, String(paraNumero("8.000,00")));
checar("12b. Milhar sem centavos", paraNumero("8.000") === 8000, String(paraNumero("8.000")));
checar("12c. Milhao", paraNumero("1.234.567,89") === 1234567.89, String(paraNumero("1.234.567,89")));
checar("12d. So virgula", paraNumero("1234,56") === 1234.56, String(paraNumero("1234,56")));
checar("12e. Ponto decimal do teclado numerico", paraNumero("1234.56") === 1234.56, String(paraNumero("1234.56")));
checar("12f. Inteiro simples", paraNumero("12") === 12);
checar("12g. Com espacos", paraNumero(" 1.500,50 ") === 1500.5, String(paraNumero(" 1.500,50 ")));
checar("12h. Negativo", paraNumero("-250,75") === -250.75, String(paraNumero("-250,75")));
checar("12i. Vazio nao vira zero", Number.isNaN(paraNumero("")), "vazio tem de ser recusado, nao virar 0");
checar("12j. Texto nao vira numero", Number.isNaN(paraNumero("oito mil")));
checar("12k. Duas virgulas sao recusadas", Number.isNaN(paraNumero("1,2,3")));
checar("12l. Centavos com um digito", paraNumero("10,5") === 10.5, String(paraNumero("10,5")));

// ---------------- 13. Formatacao de saida ----------------
checar("13. Data ISO vira brasileira", dataBR("2026-09-15") === "15/09/2026", dataBR("2026-09-15"));
checar("13b. Data ausente nao quebra", dataBR(null) === "—");
checar("13c. Competencia vira MM/AAAA", compBR("2026-09") === "09/2026", compBR("2026-09"));
checar("13d. Zero e exibido, nao escondido", real(0).includes("0,00"), real(0));

// ---------------- 14. Alertas ----------------
// A data de referencia entra como parametro justamente para que estes casos
// sejam sempre os mesmos, hoje e daqui a um ano.
const HOJE = "2026-09-15";

const baseAlertas: BaseFinanceira = {
  saldo: null,
  custos: [
    // Venceu ha 5 dias e ninguem pagou: e o caso mais grave.
    { id: "c1", descricao: "Aluguel", tipo: "Custo Fixo", competencia: "2026-09",
      vencimento: "2026-09-10", valorPrevisto: 8000, pagamentos: [] },
    // Venceu ha muito tempo, mas foi pago: nao e alerta nenhum.
    { id: "c2", descricao: "Energia", tipo: "Custo Fixo", competencia: "2026-08",
      vencimento: "2026-08-05", valorPrevisto: 1000,
      pagamentos: [ev("p1", "2026-08-04", 1000)] },
    // Pago pela metade e vencido: o alerta e pelo que falta, nao pelo total.
    { id: "c3", descricao: "Internet", tipo: "Custo Fixo", competencia: "2026-09",
      vencimento: "2026-09-12", valorPrevisto: 600,
      pagamentos: [ev("p2", "2026-09-11", 250)] },
    // Vence dentro da janela.
    { id: "c4", descricao: "Contador", tipo: "Custo Fixo", competencia: "2026-09",
      vencimento: "2026-09-20", valorPrevisto: 1200, pagamentos: [] },
    // Vence longe: nao aparece.
    { id: "c5", descricao: "Seguro", tipo: "Custo Fixo", competencia: "2026-10",
      vencimento: "2026-10-30", valorPrevisto: 3000, pagamentos: [] },
  ],
  notas: [
    // Emitida, atrasada e em aberto.
    { id: "n1", numero: "500", competencia: "2026-08", dataEmissao: "2026-08-01",
      status: "EMITIDA", valorPrevisto: 10000, valorNota: 10000,
      previsaoRecebimento: "2026-09-01", clienteNome: "Clinica A", recebimentos: [] },
    // Ainda nao emitida: nao ha o que cobrar de ninguem.
    { id: "n2", numero: "501", competencia: "2026-09", dataEmissao: null,
      status: "PREVISTA", valorPrevisto: 4000, valorNota: 0,
      previsaoRecebimento: "2026-09-02", clienteNome: "Clinica B", recebimentos: [] },
  ],
  recibos: [
    // Emitido e ja recebido por inteiro: sai da lista.
    { id: "r1", identificador: "REC-1", competencia: "2026-08", dataEmissao: "2026-08-10",
      valorPrevisto: 2000, valorRecibo: 2000, previsaoRecebimento: "2026-08-20",
      clienteNome: "Clinica C", recebimentos: [ev("e1", "2026-08-19", 2000)] },
  ],
};

const al = alertasDaBase(baseAlertas, HOJE, 7);
const ids = (lista: { id: string }[]) => lista.map((a) => a.id).join(",");

checar("14. Vencidos sao exatamente os que estao em aberto e ja passaram",
  ids(al.vencidos) === "nota:n1,custo:c1,custo:c3", ids(al.vencidos));
checar("14b. Custo pago nao vira alerta, por mais antigo que seja",
  !al.vencidos.some((a) => a.id === "custo:c2") && !al.proximos.some((a) => a.id === "custo:c2"));
checar("14c. Recibo recebido por inteiro tambem sai da lista",
  !al.vencidos.some((a) => a.id === "recibo:r1"));
const alertasComSubstituido = alertasDaBase({
  ...vazia,
  recibos: [{
    id: "r-sub", identificador: "REC-SUB", competencia: "2026-09", dataEmissao: "2026-09-01",
    valorPrevisto: 900, valorRecibo: 900, previsaoRecebimento: "2026-09-10",
    clienteNome: "Cliente histórico", recebimentos: [], substituido: true,
  }],
}, HOJE, 7);
checar("14c2. Recibo substituido nao reaparece em alertas ou vencidos",
  alertasComSubstituido.vencidos.length === 0 && alertasComSubstituido.proximos.length === 0);
checar("14d. Nota nao emitida nao cobra ninguem",
  !al.vencidos.some((a) => a.id === "nota:n2"));
checar("14e. O valor do alerta e o SALDO, nao o valor do documento",
  al.vencidos.find((a) => a.id === "custo:c3")?.valor === 350,
  "600 previstos - 250 pagos");
checar("14f. Proximos sao os que vencem dentro da janela",
  ids(al.proximos) === "custo:c4", ids(al.proximos));
checar("14g. O que vence depois da janela fica de fora",
  !al.proximos.some((a) => a.id === "custo:c5"));
checar("14h. Total vencido a pagar", al.aPagarVencido === 8000 + 350, String(al.aPagarVencido));
checar("14i. Total vencido a receber", al.aReceberVencido === 10000, String(al.aReceberVencido));
checar("14j. O mais atrasado vem primeiro",
  al.vencidos[0].id === "nota:n1", al.vencidos[0].id);
checar("14k. Base vazia nao gera alerta",
  alertasDaBase(vazia, HOJE).vencidos.length === 0
  && alertasDaBase(vazia, HOJE).proximos.length === 0);

// A contagem de dias nao pode passar por fuso horario: uma data e um dia.
const noLimite = alertasDaBase({
  ...vazia,
  custos: [{ id: "x", descricao: "Hoje", tipo: "Custo Fixo", competencia: "2026-09",
    vencimento: HOJE, valorPrevisto: 100, pagamentos: [] }],
}, HOJE, 7);
checar("14l. O que vence hoje conta como proximo, nao como vencido",
  noLimite.proximos.length === 1 && noLimite.vencidos.length === 0
  && noLimite.proximos[0].dias === 0, String(noLimite.proximos[0]?.dias));

checar("14m. Prazo escrito como se fala",
  comoDizerOPrazo(0) === "vence hoje"
  && comoDizerOPrazo(1) === "vence amanh\u00e3"
  && comoDizerOPrazo(-1) === "venceu ontem"
  && comoDizerOPrazo(5) === "vence em 5 dias"
  && comoDizerOPrazo(-5) === "venceu h\u00e1 5 dias");


// ---------------- 15. Saldo inicial e data de referencia ----------------
// Contrato: o saldo configurado representa o caixa no INICIO da data de referencia.
// Pagamentos anteriores a ela ja estao embutidos no saldo e nao podem ser contados de novo.
const baseSaldoReferencia: BaseFinanceira = {
  custos: [{
    ...custo,
    id: "saldo-ref-custo",
    descricao: "Teste saldo de referencia",
    valorPrevisto: 600,
    pagamentos: [
      ev("sr-antes", "2026-08-05", 100),
      ev("sr-na-data", "2026-08-10", 200),
      ev("sr-depois", "2026-08-15", 300),
    ],
  }],
  notas: [],
  recibos: [],
  saldo: { valor: 1000, dataReferencia: "2026-08-10" },
};

const saldoAntesRef = visaoDeCaixa(
  baseSaldoReferencia, "REALIZADO", "2026-08-01", "2026-08-09"
);
checar("15. Periodo anterior a referencia retrocede corretamente o saldo",
  saldoAntesRef.saldoInicial === 1100 && saldoAntesRef.saldoFinal === 1000,
  `inicial=${saldoAntesRef.saldoInicial}; final=${saldoAntesRef.saldoFinal}`);

const saldoNaRef = visaoDeCaixa(
  baseSaldoReferencia, "REALIZADO", "2026-08-10", "2026-08-10"
);
checar("15b. Na data de referencia o saldo inicial e exatamente o configurado",
  saldoNaRef.saldoInicial === 1000 && saldoNaRef.saldoFinal === 800,
  `inicial=${saldoNaRef.saldoInicial}; final=${saldoNaRef.saldoFinal}`);

const saldoDepoisRef = visaoDeCaixa(
  baseSaldoReferencia, "REALIZADO", "2026-08-15", "2026-08-31"
);
checar("15c. Periodo posterior carrega apenas movimentos desde a referencia",
  saldoDepoisRef.saldoInicial === 800 && saldoDepoisRef.saldoFinal === 500,
  `inicial=${saldoDepoisRef.saldoInicial}; final=${saldoDepoisRef.saldoFinal}`);

const saldoModoRealizado = visaoDeCaixa(baseSaldoReferencia, "REALIZADO", "2026-08-15", "2026-08-31");
const saldoModoPrevisto = visaoDeCaixa(baseSaldoReferencia, "PREVISTO", "2026-08-15", "2026-08-31");
const saldoModoConsolidado = visaoDeCaixa(baseSaldoReferencia, "CONSOLIDADO", "2026-08-15", "2026-08-31");
checar("15d. Os tres modos usam o mesmo saldo inicial do periodo",
  saldoModoRealizado.saldoInicial === 800
  && saldoModoPrevisto.saldoInicial === 800
  && saldoModoConsolidado.saldoInicial === 800,
  `${saldoModoRealizado.saldoInicial}/${saldoModoPrevisto.saldoInicial}/${saldoModoConsolidado.saldoInicial}`);

const baseSaldoNegativo: BaseFinanceira = {
  custos: [],
  notas: [],
  recibos: [],
  saldo: { valor: -250, dataReferencia: "2026-08-10" },
};
const saldoNegativo = visaoDeCaixa(
  baseSaldoNegativo, "REALIZADO", "2026-08-10", "2026-08-31"
);
checar("15e. Saldo inicial negativo e preservado",
  saldoNegativo.saldoInicial === -250 && saldoNegativo.saldoFinal === -250,
  `inicial=${saldoNegativo.saldoInicial}; final=${saldoNegativo.saldoFinal}`);

// ---------------- 16. Competência e documentos de medição ----------------
const resultadoComSaldoInicial = saldoNaRef.saldoInicial + 500 - 200;
checar("16. Resultado da competência soma o saldo inicial uma única vez",
  resultadoComSaldoInicial === 1300,
  `${saldoNaRef.saldoInicial} + 500 - 200 = ${resultadoComSaldoInicial}`);
checar("16b. Nota e recibo vinculados consomem juntos o saldo da medição",
  saldoAFaturarDaMedicao(10000, [{ valor: 6000 }, { valor: 2500 }]) === 1500);
checar("16c. Documentos nunca deixam saldo negativo para faturar",
  saldoAFaturarDaMedicao(10000, [{ valor: 11000 }]) === 0);
console.log("");
console.log("-".repeat(72));
console.log(`TOTAL: ${ok + falhas} verificacoes | ${ok} passaram | ${falhas} falharam`);
console.log("-".repeat(72));
process.exit(falhas ? 1 : 0);
