"use client";

type CustoGrafico = {
  competencia: string;
  previsto: number;
  pago: number;
  saldo: number;
};

type Props = {
  custos: CustoGrafico[];
  ano: string | number;
  mesDestaque?: string | number;
};

const MESES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

const real = (valor: number) =>
  valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });

export default function GraficoCustosMensal({
  custos,
  ano,
  mesDestaque,
}: Props) {
  const anoTexto = String(ano);
  const mesSelecionado = Number(mesDestaque || 0);

  const dados = MESES.map((mes, indice) => {
    const competencia = `${anoTexto}-${String(indice + 1).padStart(2, "0")}`;

    const total = custos
      .filter((c) => c.competencia === competencia)
      .reduce(
        (acc, c) => ({
          previsto: acc.previsto + Number(c.previsto || 0),
          pago: acc.pago + Number(c.pago || 0),
          restante: acc.restante + Math.max(0, Number(c.saldo || 0)),
        }),
        { previsto: 0, pago: 0, restante: 0 }
      );

    return {
      mes,
      competencia,
      ...total,
    };
  });

  const maiorValor = Math.max(
    1,
    ...dados.flatMap((item) => [
      item.previsto,
      item.pago,
      item.restante,
    ])
  );

  const totaisAno = dados.reduce(
    (acc, item) => ({
      previsto: acc.previsto + item.previsto,
      pago: acc.pago + item.pago,
      restante: acc.restante + item.restante,
    }),
    { previsto: 0, pago: 0, restante: 0 }
  );

  const temDados =
    totaisAno.previsto > 0 ||
    totaisAno.pago > 0 ||
    totaisAno.restante > 0;

  const selecionado = dados[Math.max(0, Math.min(11, mesSelecionado - 1))];
  const percentualPago = selecionado?.previsto > 0
    ? Math.min(100, Math.max(0, (selecionado.pago / selecionado.previsto) * 100))
    : 0;
  const percentualRestante = selecionado?.previsto > 0
    ? Math.min(100, Math.max(0, (selecionado.restante / selecionado.previsto) * 100))
    : 0;
  const percentual = (valor: number) =>
    valor.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

  return (
    <section
      className="fm-custos-grafico fm-custos-grafico-v44"
      aria-label={`Custos mensais de ${anoTexto}`}
    >
      <div className="fm-custos-grafico-head fm-custos-grafico-head-v44">
        <div>
          <span>EVOLUÇÃO DOS CUSTOS · {anoTexto}</span>
          <h2>Compromissos, realizado e valores a pagar</h2>
          <p>Visão mensal com referência financeira e percentual de realização da competência selecionada.</p>
        </div>
        <div className="fm-custos-grafico-resumo">
          <span className="fm-custos-grafico-resumo-label">Realização em {selecionado?.mes ?? "—"}.</span>
          <strong>{percentual(percentualPago)}%</strong>
          <small>{real(selecionado?.pago ?? 0)} de {real(selecionado?.previsto ?? 0)}</small>
        </div>
      </div>

      <div className="fm-custos-grafico-legenda fm-custos-grafico-legenda-v44" aria-label="Legenda do gráfico">
        <span><i className="compromissos" />Compromissos</span>
        <span><i className="realizado" />Realizado</span>
        <span><i className="apagar" />A pagar</span>
      </div>

      {!temDados ? (
        <div className="fm-custos-grafico-vazio">
          Nenhum custo encontrado para {anoTexto}.
        </div>
      ) : (
        <>
          <div className="fm-custos-chart-layout">
            <div className="fm-custos-eixo-y" aria-hidden="true">
              <span>{real(maiorValor)}</span>
              <span>{real(maiorValor * 0.5)}</span>
              <span>R$ 0</span>
            </div>
            <div className="fm-custos-chart-area">
              <div className="fm-custos-grid-line fm-custos-grid-line-top" />
              <div className="fm-custos-grid-line fm-custos-grid-line-mid" />
              <div className="fm-custos-grid-line fm-custos-grid-line-base" />
              <div className="fm-custos-grafico-corpo fm-custos-grafico-corpo-v44">
                {dados.map((item, indice) => {
                  const destaque = mesSelecionado === indice + 1;
                  const altura = (item.previsto / maiorValor) * 100;
                  const pago = item.previsto > 0 ? Math.min(100, Math.max(0, (item.pago / item.previsto) * 100)) : 0;
                  const restante = item.previsto > 0 ? Math.min(100, Math.max(0, (item.restante / item.previsto) * 100)) : 0;

                  return (
                    <div
                      key={item.competencia}
                      className={`fm-custos-mes fm-custos-mes-v44 ${destaque ? "selecionado" : ""}`}
                    >
                      <div className="fm-custos-valor-topo">{item.previsto > 0 ? real(item.previsto) : ""}</div>
                      <div className="fm-custos-stack-wrap" title={`${item.mes}: compromissos ${real(item.previsto)} · realizado ${real(item.pago)} (${percentual(pago)}%) · a pagar ${real(item.restante)} (${percentual(restante)}%)`}>
                        {item.previsto > 0 && <div className="fm-custos-compromisso-referencia" style={{ height: `${altura}%` }} />}
                        <div className="fm-custos-stack" style={{ height: `${altura}%` }}>
                          {restante > 0 && <span className="fm-custos-segmento apagar" style={{ height: `${restante}%` }}><em>{Math.round(restante)}%</em></span>}
                          {pago > 0 && <span className="fm-custos-segmento realizado" style={{ height: `${pago}%` }}><em>{Math.round(pago)}%</em></span>}
                        </div>
                      </div>
                      <strong>{item.mes}</strong>
                      {destaque && <small>selecionado</small>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

        </>
      )}
    </section>
  );
}
