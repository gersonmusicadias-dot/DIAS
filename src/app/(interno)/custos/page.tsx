import { prisma } from "@/lib/prisma";
import { sessaoAtual } from "@/lib/auth/sessao";
import GerenciarCustos from "./GerenciarCustos";
import { financeiroDoCusto } from "@/lib/financeiro/motor";

export const metadata = { title: "Custos · FluxoMed Maricá" };
export const dynamic = "force-dynamic";

export default async function PaginaCustos() {
  const sessao = await sessaoAtual();
  const categorias = await prisma.categoria.findMany({
    where: { ativa: true },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true, tipo: true },
  });

  const custosBrutos = await prisma.custo.findMany({
    include: {
      categoria: { select: { id: true, nome: true } },
      pagamentos: true,
      anexos: { select: { id: true, nomeArquivo: true, tamanhoBytes: true, mimeType: true }, orderBy: { criadoEm: "asc" } },
    },
    orderBy: [{ competencia: "desc" }, { vencimento: "asc" }],
  });

  const custos = custosBrutos.map((c) => {
    const f = financeiroDoCusto({
      id: c.id, descricao: c.descricao, tipo: c.tipo,
      competencia: c.competencia, vencimento: c.vencimento,
      valorPrevisto: c.valorPrevisto, categoriaNome: c.categoria?.nome,
      pagamentos: c.pagamentos.map((p) => ({ id: p.id, data: p.data, valor: p.valor, tipo: p.tipo === "REVERSAL" ? "REVERSAL" : "NORMAL" })),
    });
    return { id: c.id, descricao: c.descricao, tipo: c.tipo, categoria: c.categoria?.nome ?? null, categoriaId: c.categoriaId, competencia: c.competencia, vencimento: c.vencimento, observacoes: c.observacoes, previsto: f.previsto, pago: f.pago, saldo: f.saldo, situacao: f.pago <= 0 ? "PREVISTO" : f.saldo > 0 ? "PARCIAL" : "PAGO", temMovimento: c.pagamentos.length > 0, anexos: c.anexos };
  });

  return (
    <div className="fm-custos-page">
      <div className="cabecalho-pagina">
        <div>
          <h1 className="titulo-pagina">Custos</h1>
          <p className="sub-pagina">Obrigações financeiras e seus pagamentos</p>
        </div>
      </div>
      <GerenciarCustos categorias={categorias} custosIniciais={custos} somenteLeitura={sessao?.papel === "LEITURA"} />
    </div>
  );
}







