import Link from "next/link";
import { carregarBase, formatarReal } from "@/lib/financeiro/dados";
import { economiaDoAno } from "@/lib/financeiro/motor";

export const metadata = { title: "Balanço · FluxoMed Maricá" };
export const dynamic = "force-dynamic";

interface Props { searchParams: Promise<{ ano?: string }> }

const cor = (v: number) => (v > 0 ? "var(--sucesso)" : v < 0 ? "var(--perigo)" : "var(--texto-2)");

export default async function PaginaBalanco({ searchParams }: Props) {
  const { ano: pedido } = await searchParams;
  const ano = Number(pedido) >= 2000 && Number(pedido) <= 2100
    ? Number(pedido)
    : new Date().getFullYear();

  const base = await carregarBase();
  const { meses, total, composicao } = economiaDoAno(base, ano);

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1 className="titulo-pagina">Balanço</h1>
          <p className="sub-pagina">
            Visão gerencial anual de {ano}. Não é Balanço Patrimonial contábil —
            o sistema não estrutura Ativo, Passivo e Patrimônio Líquido.
          </p>
        </div>
        <div className="pilula-campo">
          <Link href={`/balanco?ano=${ano - 1}`} className="botao discreto mini" style={{ textDecoration: "none" }}>‹</Link>
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--texto)", padding: "0 6px" }}>{ano}</span>
          <Link href={`/balanco?ano=${ano + 1}`} className="botao discreto mini" style={{ textDecoration: "none" }}>›</Link>
        </div>
      </div>

      <div className="grade-kpi" style={{ marginBottom: 18 }}>
        <div className="kpi" style={{ borderLeftColor: "var(--sucesso)" }}>
          <p className="kpi-rotulo">Receitas realizadas no ano</p>
          <div className="kpi-valor" style={{ color: "var(--sucesso)" }}>{formatarReal(total.receitasRealizadas)}</div>
        </div>
        <div className="kpi" style={{ borderLeftColor: "var(--perigo)" }}>
          <p className="kpi-rotulo">Despesas realizadas no ano</p>
          <div className="kpi-valor" style={{ color: "var(--perigo)" }}>{formatarReal(total.despesasRealizadas)}</div>
        </div>
        <div className="kpi" style={{ borderLeftColor: "var(--primaria)" }}>
          <p className="kpi-rotulo">Resultado realizado</p>
          <div className="kpi-valor" style={{ color: cor(total.resultadoRealizado) }}>{formatarReal(total.resultadoRealizado)}</div>
        </div>
      </div>

      <p className="rotulo-secao">Resultado mês a mês</p>
      <div className="cartao tabela-rolagem" style={{ marginBottom: 18 }}>
        <table>
          <thead>
            <tr>
              <th>Mês</th>
              <th style={{ textAlign: "right" }}>Receitas realizadas</th>
              <th style={{ textAlign: "right" }}>Receitas previstas</th>
              <th style={{ textAlign: "right" }}>Despesas realizadas</th>
              <th style={{ textAlign: "right" }}>Despesas previstas</th>
              <th style={{ textAlign: "right" }}>Resultado realizado</th>
              <th style={{ textAlign: "right" }}>Resultado projetado</th>
            </tr>
          </thead>
          <tbody>
            {meses.map((m) => (
              <tr key={m.competencia}>
                <td>
                  <Link href={`/balancete?competencia=${m.competencia}`}
                    style={{ color: "var(--primaria)", textDecoration: "none" }}>
                    {m.nome}
                  </Link>
                </td>
                <td style={{ textAlign: "right", color: "var(--sucesso)" }}>{formatarReal(m.receitasRealizadas)}</td>
                <td style={{ textAlign: "right" }}>{formatarReal(m.receitasPrevistas)}</td>
                <td style={{ textAlign: "right", color: "var(--perigo)" }}>{formatarReal(m.despesasRealizadas)}</td>
                <td style={{ textAlign: "right" }}>{formatarReal(m.despesasPrevistas)}</td>
                <td style={{ textAlign: "right", color: cor(m.resultadoRealizado) }}>{formatarReal(m.resultadoRealizado)}</td>
                <td style={{ textAlign: "right", color: cor(m.resultadoProjetado) }}>{formatarReal(m.resultadoProjetado)}</td>
              </tr>
            ))}
            <tr style={{ background: "rgba(47,159,224,.07)", fontWeight: 700 }}>
              <td>Total do ano</td>
              <td style={{ textAlign: "right", color: "var(--sucesso)" }}>{formatarReal(total.receitasRealizadas)}</td>
              <td style={{ textAlign: "right" }}>{formatarReal(total.receitasPrevistas)}</td>
              <td style={{ textAlign: "right", color: "var(--perigo)" }}>{formatarReal(total.despesasRealizadas)}</td>
              <td style={{ textAlign: "right" }}>{formatarReal(total.despesasPrevistas)}</td>
              <td style={{ textAlign: "right", color: cor(total.resultadoRealizado) }}>{formatarReal(total.resultadoRealizado)}</td>
              <td style={{ textAlign: "right", color: cor(total.resultadoProjetado) }}>{formatarReal(total.resultadoProjetado)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="rotulo-secao">Composição anual</p>
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
            {composicao.map((c) => (
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
