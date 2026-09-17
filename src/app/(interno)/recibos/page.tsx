import { prisma } from "@/lib/prisma";
import { saldoAFaturarDaMedicao } from "@/lib/financeiro/motor";
import { sessaoAtual } from "@/lib/auth/sessao";
import GerenciarDocumentos from "@/components/GerenciarDocumentos";

export const metadata = { title: "Recibos · FluxoMed Maricá" };
export const dynamic = "force-dynamic";

export default async function PaginaRecibos() {
  const sessao = await sessaoAtual();
  const [clientes, medicoes] = await Promise.all([
    prisma.cliente.findMany({
      where: { ativo: true }, orderBy: { nomeFantasia: "asc" },
      select: { id: true, nomeFantasia: true },
    }),
    prisma.medicao.findMany({
      where: { status: "MEDIDA" },
      orderBy: { identificador: "asc" },
      select: {
        id: true, identificador: true, clienteId: true,
        competencia: true, valorMedido: true, previsaoRecebimento: true,
        notasFiscais: { select: { valorNota: true } },
        recibos: { where: { substituidoPor: null }, select: { valorRecibo: true } },
      },
    }),
  ]);

  const medicoesOpcoes = medicoes.map((m) => ({
    id: m.id,
    identificador: m.identificador,
    clienteId: m.clienteId,
    competencia: m.competencia,
    previsaoRecebimento: m.previsaoRecebimento,
    aFaturar: saldoAFaturarDaMedicao(
      m.valorMedido ?? 0,
      [
        ...m.notasFiscais.map((n) => ({ valor: n.valorNota })),
        ...m.recibos.map((r) => ({ valor: r.valorRecibo })),
      ]
    ),
  }));

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1 className="titulo-pagina">Recibos</h1>
          <p className="sub-pagina">
            O recibo é o documento. Receber é um evento à parte, com histórico e estorno.
          </p>
        </div>
      </div>
      <GerenciarDocumentos tipo="recibo" clientes={clientes} medicoes={medicoesOpcoes}
        somenteLeitura={sessao?.papel === "LEITURA"} />
    </>
  );
}
