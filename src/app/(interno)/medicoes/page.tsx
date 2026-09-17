import { prisma } from "@/lib/prisma";
import { sessaoAtual } from "@/lib/auth/sessao";
import GerenciarMedicoes from "./GerenciarMedicoes";
import { saldoAFaturarDaMedicao } from "@/lib/financeiro/motor";

export const metadata = { title: "Medições · FluxoMed Maricá" };
export const dynamic = "force-dynamic";

export default async function PaginaMedicoes() {
  const [sessao, clientes, medicoesBrutas] = await Promise.all([
    sessaoAtual(),
    prisma.cliente.findMany({
      where: { ativo: true },
      orderBy: { nomeFantasia: "asc" },
      select: { id: true, nomeFantasia: true },
    }),
    prisma.medicao.findMany({
      include: {
        cliente: { select: { nomeFantasia: true } },
        recibos: { where: { substituidoPor: null }, select: { id: true, identificador: true, valorRecibo: true } },
      },
      orderBy: [{ competencia: "desc" }, { identificador: "asc" }],
    }),
  ]);

  const medicoes = medicoesBrutas.map((m) => {
    const documentos = m.recibos.map((r) => ({ valor: r.valorRecibo }));
    return {
      id: m.id, cliente: m.cliente.nomeFantasia, clienteId: m.clienteId,
      identificador: m.identificador, competencia: m.competencia,
      periodoInicio: m.periodoInicio, periodoFim: m.periodoFim,
      descricaoServicos: m.descricaoServicos, valorPrevisto: m.valorPrevisto,
      valorMedido: m.valorMedido, dataMedicao: m.dataMedicao,
      previsaoRecebimento: m.previsaoRecebimento, status: m.status,
      diferenca: (m.valorMedido ?? 0) - m.valorPrevisto,
      aFaturar: m.valorMedido ? saldoAFaturarDaMedicao(m.valorMedido, documentos) : 0,
      documentos: m.recibos.map((r) => ({ tipo: "RECIBO", rotulo: r.identificador })),
      temDocumento: documentos.length > 0,
    };
  });

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1 className="titulo-pagina">Medições</h1>
          <p className="sub-pagina">
            Reconhecimento da execução. A medição não recebe dinheiro — ela vira Nota Fiscal ou Recibo.
          </p>
        </div>
      </div>
      <GerenciarMedicoes clientes={clientes} medicoesIniciais={medicoes} somenteLeitura={sessao?.papel === "LEITURA"} />
    </>
  );
}






