import { prisma } from "@/lib/prisma";
import { saldoAFaturarDaMedicao } from "@/lib/financeiro/motor";
import { sessaoAtual } from "@/lib/auth/sessao";
import GerenciarDocumentos from "@/components/GerenciarDocumentos";

export const metadata = { title: "Notas Fiscais · FluxoMed Maricá" };
export const dynamic = "force-dynamic";

export default async function PaginaNotas() {
  const sessao = await sessaoAtual();

  const [clientes, medicoes] = await Promise.all([
    prisma.cliente.findMany({
      where: { ativo: true }, orderBy: { nomeFantasia: "asc" },
      select: { id: true, nomeFantasia: true },
    }),
    prisma.medicao.findMany({
      where: { status: "MEDIDA" }, orderBy: { identificador: "asc" },
      select: {
        id: true, identificador: true, clienteId: true, competencia: true,
        valorMedido: true, previsaoRecebimento: true,
        notasFiscais: { select: { valorNota: true, valorPrevisto: true, dataEmissao: true } },
        recibos: { where: { substituidoPor: null }, select: { valorRecibo: true, valorPrevisto: true, dataEmissao: true } },
      },
    }),
  ]);

  const medicoesOpcoes = medicoes.map((m) => ({
    id: m.id, identificador: m.identificador, clienteId: m.clienteId,
    competencia: m.competencia, previsaoRecebimento: m.previsaoRecebimento,
    aFaturar: saldoAFaturarDaMedicao(m.valorMedido ?? 0, [
      ...m.notasFiscais.map((n) => ({ valor: n.dataEmissao ? n.valorNota : n.valorPrevisto })),
      ...m.recibos.map((r) => ({ valor: r.dataEmissao ? r.valorRecibo : r.valorPrevisto })),
    ]),
  }));

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1 className="titulo-pagina">Notas Fiscais</h1>
          <p className="sub-pagina">
            A nota é o documento. Receber é um evento à parte, com histórico e estorno.
          </p>
        </div>
      </div>

      <GerenciarDocumentos
        tipo="nota"
        clientes={clientes}
        medicoes={medicoesOpcoes}
        somenteLeitura={sessao?.papel === "LEITURA"}
      />
    </>
  );
}
