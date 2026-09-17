import { carregarBase, formatarReal, formatarCompetencia } from "@/lib/financeiro/dados";
import { economiaDaCompetencia, competenciaAtual } from "@/lib/financeiro/motor";
import SeletorCompetencia from "@/components/SeletorCompetencia";

export const metadata = { title: "Balancete · FluxoMed Maricá" };
export const dynamic = "force-dynamic";

interface Props { searchParams: Promise<{ competencia?: string }> }

const cor = (v: number) => (v > 0 ? "var(--sucesso)" : v < 0 ? "var(--perigo)" : "var(--texto-2)");

export default async function PaginaBalancete({ searchParams }: Props) {
  const { competencia: pedida } = await searchParams;
  const competencia = /^\d{4}-\d{2}$/.test(pedida ?? "") ? pedida! : competenciaAtual();

  const base = await carregarBase();
  const eco = economiaDaCompetencia(base, competencia);

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1 className="titulo-pagina">Balancete</h1>
          <p className="sub-pagina">
            Resultado gerencial da competência {formatarCompetencia(competencia)}.
            Não é balancete contábil de partidas dobradas — é a visão econômica do período.
          </p>
        </div>
        <SeletorCompetencia valor={competencia} />
      </div>

      <div className="grade-kpi" style={{ marginBottom: 18 }}>
        <div className="kpi" style={{ borderLeftColor: "var(--sucesso)" }}>
          <p className="kpi-rotulo">Receitas realizadas</p>
          <div className="kpi-valor" style={{ color: "var(--sucesso)" }}>{formatarReal(eco.receitasRealizadas)}</div>
        </div>
        <div className="kpi" style={{ borderLeftColor: "var(--ambar)" }}>
          <p className="kpi-rotulo">Receitas previstas</p>
          <div className="kpi-valor">{formatarReal(eco.receitasPrevistas)}</div>
        </div>
        <div className="kpi" style={{ borderLeftColor: "var(--perigo)" }}>
          <p className="kpi-rotulo">Despesas realizadas</p>
          <div className="kpi-valor" style={{ color: "var(--perigo)" }}>{formatarReal(eco.despesasRealizadas)}</div>
        </div>
        <div className="kpi" style={{ borderLeftColor: "var(--ambar)" }}>
          <p className="kpi-rotulo">Despesas previstas</p>
          <div className="kpi-valor">{formatarReal(eco.despesasPrevistas)}</div>
        </div>
        <div className="kpi" style={{ borderLeftColor: "var(--primaria)" }}>
          <p className="kpi-rotulo">Resultado realizado</p>
          <div className="kpi-valor" style={{ color: cor(eco.resultadoRealizado) }}>{formatarReal(eco.resultadoRealizado)}</div>
        </div>
        <div className="kpi" style={{ borderLeftColor: "var(--primaria)" }}>
          <p className="kpi-rotulo">Resultado projetado</p>
          <div className="kpi-valor" style={{ color: cor(eco.resultadoProjetado) }}>{formatarReal(eco.resultadoProjetado)}</div>
        </div>
      </div>

      <p className="rotulo-secao">Detalhamento das receitas</p>
      <div className="cartao tabela-rolagem" style={{ marginBottom: 18 }}>
        <table>
          <thead>
            <tr>
              <th>Documento</th><th>Cliente</th><th>Origem</th>
              <th style={{ textAlign: "right" }}>Realizado</th>
              <th style={{ textAlign: "right" }}>Previsto</th>
              <th style={{ textAlign: "right" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {eco.receitas.map((r, i) => (
              <tr key={i}>
                <td><strong>{r.documento}</strong></td>
                <td>{r.cliente}</td>
                <td>{r.origem}</td>
                <td style={{ textAlign: "right", color: "var(--sucesso)" }}>{formatarReal(r.realizado)}</td>
                <td style={{ textAlign: "right", color: "var(--ambar)" }}>{formatarReal(r.previsto)}</td>
                <td style={{ textAlign: "right" }}>{formatarReal(r.realizado + r.previsto)}</td>
              </tr>
            ))}
            {eco.receitas.length === 0 && (
              <tr><td colSpan={6}><div className="vazio">Nenhuma receita nesta competência.</div></td></tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="rotulo-secao">Detalhamento das despesas</p>
      <div className="cartao tabela-rolagem" style={{ marginBottom: 18 }}>
        <table>
          <thead>
            <tr>
              <th>Descrição</th><th>Categoria</th><th>Tipo</th>
              <th style={{ textAlign: "right" }}>Realizado</th>
              <th style={{ textAlign: "right" }}>Previsto</th>
              <th style={{ textAlign: "right" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {eco.despesas.map((d, i) => (
              <tr key={i}>
                <td><strong>{d.descricao}</strong></td>
                <td>{d.categoria}</td>
                <td>{d.tipo}</td>
                <td style={{ textAlign: "right", color: "var(--perigo)" }}>{formatarReal(d.realizado)}</td>
                <td style={{ textAlign: "right", color: "var(--ambar)" }}>{formatarReal(d.previsto)}</td>
                <td style={{ textAlign: "right" }}>{formatarReal(d.realizado + d.previsto)}</td>
              </tr>
            ))}
            {eco.despesas.length === 0 && (
              <tr><td colSpan={6}><div className="vazio">Nenhuma despesa nesta competência.</div></td></tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="rotulo-secao">Composição do resultado</p>
      <div className="cartao">
        <table>
          <thead>
            <tr>
              <th>Origem</th>
              <th style={{ textAlign: "right" }}>Realizado</th>
              <th style={{ textAlign: "right" }}>Previsto</th>
              <th style={{ textAlign: "right" }}>Total econômico</th>
            </tr>
          </thead>
          <tbody>
            {eco.composicao.map((c) => (
              <tr key={c.origem}>
                <td>{c.origem}</td>
                <td style={{ textAlign: "right", color: "var(--sucesso)" }}>{formatarReal(c.realizado)}</td>
                <td style={{ textAlign: "right", color: "var(--ambar)" }}>{formatarReal(c.previsto)}</td>
                <td style={{ textAlign: "right" }}>{formatarReal(c.realizado + c.previsto)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
