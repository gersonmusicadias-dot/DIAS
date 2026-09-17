/**
 * Teste de ponta a ponta contra o banco de verdade.
 *
 * Percorre os dois caminhos completos:
 *   Cliente → Medição → Nota Fiscal → Recebimento → Caixa → Balancete → Balanço
 *   Categoria → Custo → Pagamento → Estorno → Caixa → Balancete → Balanço
 *
 * Tudo que cria é prefixado com TESTE_ e removido no fim. Se algo falhar no
 * meio, a limpeza roda mesmo assim.
 *
 *   npm run testar-integracao
 */
import { PrismaClient } from "@prisma/client";
import { carregarBase } from "../src/lib/financeiro/dados";
import {
  economiaDaCompetencia, economiaDoAno, visaoDeCaixa, resumoDeCaixa, previsoesDeCaixa,
} from "../src/lib/financeiro/motor";

const prisma = new PrismaClient();
const MARCA = `TESTE_${Date.now()}_${crypto.randomUUID()}_`;
const COMP = "2031-07"; // ano distante para não colidir com nada real
const ANO = 2031;

let ok = 0;
let falhas = 0;

function checar(nome: string, condicao: boolean, detalhe = "") {
  if (condicao) { ok += 1; console.log("  [OK]  " + nome + (detalhe ? "   -> " + detalhe : "")); }
  else { falhas += 1; console.log("  [FALHA] " + nome + (detalhe ? "   -> " + detalhe : "")); }
}

async function limpar() {
  // Ordem importa: eventos antes dos documentos, documentos antes dos pais.
  await prisma.recebimentoNota.deleteMany({ where: { nota: { numero: { startsWith: MARCA } } } });
  await prisma.recebimentoRecibo.deleteMany({ where: { recibo: { identificador: { startsWith: MARCA } } } });
  await prisma.pagamentoCusto.deleteMany({ where: { custo: { descricao: { startsWith: MARCA } } } });
  await prisma.notaFiscal.deleteMany({ where: { numero: { startsWith: MARCA } } });
  await prisma.recibo.deleteMany({ where: { identificador: { startsWith: MARCA } } });
  await prisma.medicao.deleteMany({ where: { identificador: { startsWith: MARCA } } });
  await prisma.custo.deleteMany({ where: { descricao: { startsWith: MARCA } } });
  await prisma.categoria.deleteMany({ where: { nome: { startsWith: MARCA } } });
  await prisma.cliente.deleteMany({ where: { nomeFantasia: { startsWith: MARCA } } });
  // Nada de saldo aqui: o teste não cria nenhum, e apagar o do usuário
  // seria destruir dado real para arrumar a casa do teste.
}

async function principal() {
  console.log("=".repeat(72));
  console.log("INTEGRAÇÃO — do cadastro ao Balanço, contra o banco");
  console.log("=".repeat(72));
  console.log("");

  await limpar();

  // Fotografia do que já existe, para provar no fim que nada foi tocado.
  const antes = {
    clientes: await prisma.cliente.count(),
    custos: await prisma.custo.count(),
    notas: await prisma.notaFiscal.count(),
    saldos: await prisma.saldoCaixa.count(),
  };

  // O caixa é global: soma tudo que existe no banco, não só o que este teste
  // cria. Então as contas de caixa daqui para baixo são feitas por DIFERENÇA
  // em cima desta linha de base. Sem isso o teste só passa com o banco vazio
  // — ou seja, deixa de passar no primeiro dia de uso real.
  const base0 = await carregarBase();
  const caixa0 = visaoDeCaixa(base0, "REALIZADO");
  const previsoes0 = previsoesDeCaixa(base0).length;

  // ---------------- Caminho da receita ----------------
  const cliente = await prisma.cliente.create({
    data: { razaoSocial: MARCA + "Clinica LTDA", nomeFantasia: MARCA + "Clinica" },
  });
  checar("1. Cliente criado", Boolean(cliente.id));

  const medicao = await prisma.medicao.create({
    data: {
      clienteId: cliente.id, identificador: MARCA + "MED-01", competencia: COMP,
      periodoInicio: `${ANO}-07-01`, periodoFim: `${ANO}-07-31`,
      valorPrevisto: 20000, valorMedido: 20000, dataMedicao: `${ANO}-07-31`,
      previsaoRecebimento: `${ANO}-08-10`, status: "MEDIDA",
    },
  });
  checar("2. Medição criada e medida", medicao.status === "MEDIDA");

  const baseSoMedicao = await carregarBase();
  checar("2b. Medição sozinha NÃO gera receita nem caixa",
    economiaDaCompetencia(baseSoMedicao, COMP).receitasRealizadas === 0
    && visaoDeCaixa(baseSoMedicao, "REALIZADO").entradas === caixa0.entradas,
    "medição é reconhecimento de execução, não dinheiro");

  const nota = await prisma.notaFiscal.create({
    data: {
      clienteId: cliente.id, medicaoId: medicao.id, numero: MARCA + "1001",
      competencia: COMP, dataEmissao: `${ANO}-07-05`,
      valorPrevisto: 20000, valorNota: 20000,
      previsaoRecebimento: `${ANO}-08-10`, status: "EMITIDA",
    },
  });
  checar("3. Nota fiscal emitida a partir da medição", nota.medicaoId === medicao.id);

  const baseComNota = await carregarBase();
  const ecoComNota = economiaDaCompetencia(baseComNota, COMP);
  checar("3b. Nota emitida sem recebimento: receita prevista, não realizada",
    ecoComNota.receitasRealizadas === 0 && ecoComNota.receitasPrevistas === 20000,
    `realizada=${ecoComNota.receitasRealizadas} prevista=${ecoComNota.receitasPrevistas}`);

  await prisma.recebimentoNota.create({
    data: { notaId: nota.id, data: `${ANO}-07-20`, valor: 12000, tipo: "NORMAL" },
  });
  const baseParcial = await carregarBase();
  const ecoParcial = economiaDaCompetencia(baseParcial, COMP);
  checar("4. Recebimento parcial vira receita realizada",
    ecoParcial.receitasRealizadas === 12000, String(ecoParcial.receitasRealizadas));
  checar("4b. E o restante continua previsto",
    ecoParcial.receitasPrevistas === 8000, String(ecoParcial.receitasPrevistas));

  const caixaParcial = visaoDeCaixa(baseParcial, "REALIZADO");
  checar("4c. O recebimento ENTRA no caixa",
    caixaParcial.entradas - caixa0.entradas === 12000,
    String(caixaParcial.entradas - caixa0.entradas));

  // ---------------- Caminho da despesa ----------------
  const categoria = await prisma.categoria.create({
    data: { nome: MARCA + "Aluguel", tipo: "Custo Fixo" },
  });
  const custo = await prisma.custo.create({
    data: {
      descricao: MARCA + "Aluguel da sede", tipo: "Custo Fixo", categoriaId: categoria.id,
      competencia: COMP, vencimento: `${ANO}-07-10`, valorPrevisto: 8000,
    },
  });
  checar("5. Categoria e custo criados", Boolean(custo.id));

  const pagamento = await prisma.pagamentoCusto.create({
    data: { custoId: custo.id, data: `${ANO}-07-08`, valor: 8000, tipo: "NORMAL" },
  });
  await prisma.pagamentoCusto.create({
    data: {
      custoId: custo.id, data: `${ANO}-07-15`, valor: 3000,
      tipo: "REVERSAL", estornoDe: pagamento.id, motivo: "teste de integração",
    },
  });

  const baseFinal = await carregarBase();
  const eco = economiaDaCompetencia(baseFinal, COMP);
  checar("6. Estorno reduz a despesa realizada",
    eco.despesasRealizadas === 5000, String(eco.despesasRealizadas));
  checar("6b. E devolve o saldo para previsto",
    eco.despesasPrevistas === 3000, String(eco.despesasPrevistas));
  checar("6c. O evento original continua no banco",
    (await prisma.pagamentoCusto.count({ where: { custoId: custo.id } })) === 2,
    "append-only: dois eventos");

  // ---------------- Caixa ----------------
  // O saldo inicial é registro único: quem já existe no banco continua
  // valendo, e o teste não cria um segundo. Criar um segundo não daria erro
  // — seria simplesmente ignorado, e o teste passaria a medir outra coisa.
  const baseComSaldo = await carregarBase();
  const caixa = visaoDeCaixa(baseComSaldo, "REALIZADO");

  const entrou = caixa.entradas - caixa0.entradas;
  const saiu = caixa.saidas - caixa0.saidas;
  checar("7. Estorno de custo ENTRA no caixa, ao contrário do resultado",
    entrou === 15000, `12.000 do recebimento + 3.000 do estorno = ${entrou}`);
  checar("7b. O pagamento SAI do caixa", saiu === 8000, String(saiu));
  checar("7c. Saldo final = saldo inicial + entradas − saídas",
    caixa.saldoFinal === caixa.saldoInicial + caixa.entradas - caixa.saidas,
    `${caixa.saldoInicial} + ${caixa.entradas} - ${caixa.saidas} = ${caixa.saldoFinal}`);
  // 12.000 recebidos − 8.000 pagos + 3.000 estornados
  checar("7c2. E o que este teste movimentou é exatamente 7.000",
    caixa.saldoFinal - caixa0.saldoFinal === 7000,
    String(caixa.saldoFinal - caixa0.saldoFinal));

  const resumo = resumoDeCaixa(baseComSaldo);
  checar("7d. O resumo do painel bate com o fluxo", resumo.saldoAtual === caixa.saldoFinal);

  const consolidado = visaoDeCaixa(baseComSaldo, "CONSOLIDADO");
  const previsoesNovas = previsoesDeCaixa(baseComSaldo).length - previsoes0;
  checar("7e. O documento em aberto e o custo em aberto viram duas previsões",
    previsoesNovas === 2, String(previsoesNovas));
  checar("7f. Consolidado é o realizado mais as previsões, sem duplicar nada",
    consolidado.linhas.length === caixa.linhas.length + previsoesDeCaixa(baseComSaldo).length,
    `${caixa.linhas.length} realizados + ${previsoesDeCaixa(baseComSaldo).length} previstos`);
  // 7.000 movimentados + 8.000 a receber − 3.000 a pagar
  checar("7g. Saldo projetado soma o que ainda vai entrar e sair",
    consolidado.saldoFinal - visaoDeCaixa(base0, "CONSOLIDADO").saldoFinal === 12000,
    String(consolidado.saldoFinal - visaoDeCaixa(base0, "CONSOLIDADO").saldoFinal));

  // ---------------- Balancete ----------------
  checar("8. Balancete: resultado realizado = receitas − despesas realizadas",
    eco.resultadoRealizado === 12000 - 5000, String(eco.resultadoRealizado));
  checar("8b. Balancete: resultado projetado inclui os dois previstos",
    eco.resultadoProjetado === 12000 + 8000 - 5000 - 3000, String(eco.resultadoProjetado));
  checar("8c. A composição separa as três origens",
    eco.composicao.find((c) => c.origem === "Notas Fiscais")?.realizado === 12000
    && eco.composicao.find((c) => c.origem === "Custos")?.realizado === 5000, "");

  // ---------------- Balanço ----------------
  const anual = economiaDoAno(baseComSaldo, ANO);
  const julho = anual.meses[6];
  checar("9. Balanço: julho reflete o mesmo do Balancete",
    julho.resultadoRealizado === eco.resultadoRealizado, String(julho.resultadoRealizado));
  checar("9b. Balanço: o total do ano é a soma dos meses",
    anual.total.resultadoRealizado === anual.meses.reduce((s, m) => s + m.resultadoRealizado, 0), "");
  checar("9c. Balanço: os outros onze meses estão zerados",
    anual.meses.filter((m, i) => i !== 6).every((m) => m.resultadoProjetado === 0), "");

  // ---------------- Isolamento ----------------
  checar("10. Competência vizinha não é contaminada",
    economiaDaCompetencia(baseComSaldo, "2031-06").resultadoProjetado === 0, "");

  // ---------------- Limpeza ----------------
  await limpar();
  const depois = {
    clientes: await prisma.cliente.count(),
    custos: await prisma.custo.count(),
    notas: await prisma.notaFiscal.count(),
    saldos: await prisma.saldoCaixa.count(),
  };
  checar("11. Nenhum dado de teste sobrou",
    depois.clientes === antes.clientes && depois.custos === antes.custos && depois.notas === antes.notas,
    `clientes ${depois.clientes} | custos ${depois.custos} | notas ${depois.notas}`);
  checar("11c. E o saldo inicial do usuário continua onde estava",
    depois.saldos === antes.saldos
    && visaoDeCaixa(await carregarBase(), "REALIZADO").saldoInicial === caixa0.saldoInicial,
    String(caixa0.saldoInicial));

  const limpa = await carregarBase();
  checar("11b. E a base voltou ao estado anterior",
    economiaDaCompetencia(limpa, COMP).resultadoProjetado === 0, "");

  console.log("");
  console.log("-".repeat(72));
  console.log(`TOTAL: ${ok + falhas} verificacoes | ${ok} passaram | ${falhas} falharam`);
  console.log("-".repeat(72));
}

principal()
  .catch(async (erro) => {
    console.error(erro);
    await limpar().catch(() => {});
    falhas += 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(falhas ? 1 : 0);
  });
