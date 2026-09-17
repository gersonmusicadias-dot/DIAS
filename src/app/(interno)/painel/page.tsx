import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { carregarBase, formatarReal, formatarCompetencia, formatarData } from "@/lib/financeiro/dados";
import {
  economiaDaCompetencia,
  resumoDeCaixa,
  visaoDeCaixa,
  competenciaAtual,
  financeiroDoCusto,
  financeiroDaNota,
  financeiroDoRecibo,
  previsoesDeCaixa,
  saldoAFaturarDaMedicao,
} from "@/lib/financeiro/motor";
import { sessaoAtual } from "@/lib/auth/sessao";
import SeletorCompetencia from "@/components/SeletorCompetencia";
import { hojeISO } from "@/lib/ui";

export const metadata = { title: "Visão Geral · FluxoMed Maricá" };
export const dynamic = "force-dynamic";

interface Props { searchParams: Promise<{ competencia?: string }>; }

type Tom = "azul" | "verde" | "vermelho" | "amarelo" | "roxo";

function deslocarCompetencia(comp: string, delta: number) {
  const [a, m] = comp.split("-").map(Number);
  const d = new Date(a, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function variacao(atual: number, anterior: number) {
  if (anterior === 0) return atual === 0 ? "Sem variação" : "Base anterior zerada";
  const p = ((atual - anterior) / Math.abs(anterior)) * 100;
  return `${p >= 0 ? "+" : ""}${p.toFixed(1).replace(".", ",")}% vs. mês anterior`;
}

function Kpi({ titulo, valor, detalhe, tom, icone, href }: {
  titulo: string; valor: string; detalhe: string; tom: Tom; icone: React.ReactNode; href: string;
}) {
  return (
    <Link href={href} className={`fm-kpi fm-${tom}`} aria-label={`${titulo}: ${valor}. Abrir detalhamento`}>
      <div className="fm-kpi-head">
        <span className="fm-kpi-icon">{icone}</span>
        <div><span>{titulo}</span><strong>{valor}</strong></div>
      </div>
      <div className="fm-kpi-foot"><small>{detalhe}</small><i aria-hidden="true" /></div>
    </Link>
  );
}

function CabecalhoCard({ titulo, subtitulo, href }: { titulo: string; subtitulo?: string; href?: string }) {
  return (
    <div className="fm-card-head">
      <div><h2>{titulo}</h2>{subtitulo && <p>{subtitulo}</p>}</div>
      {href && <Link href={href}>Ver todas →</Link>}
    </div>
  );
}

function Dinheiro({ valor, tom }: { valor: number; tom?: Tom }) {
  return <strong className={tom ? `fm-dinheiro fm-${tom}-texto` : "fm-dinheiro"}>{formatarReal(valor)}</strong>;
}

export default async function PaginaPainel({ searchParams }: Props) {

  const { competencia: pedida } = await searchParams;
  const competencia = /^\d{4}-\d{2}$/.test(pedida ?? "") ? pedida! : competenciaAtual();
  const anterior = deslocarCompetencia(competencia, -1);
  const hoje = hojeISO();

  const [base, medicoes] = await Promise.all([
    carregarBase(),
    prisma.medicao.findMany({
      where: { competencia },
      select: { id: true, valorPrevisto: true, valorMedido: true },
    }),
  ]);

  const eco = economiaDaCompetencia(base, competencia);
  const ecoAnterior = economiaDaCompetencia(base, anterior);
  const caixa = resumoDeCaixa(base);

  const aReceber = eco.receitasPrevistas;
  const aPagar = eco.despesasPrevistas;
  const inicioCompetencia = `${competencia}-01`;
  const [anoCompetencia, mesCompetencia] = competencia.split("-").map(Number);
  const fimCompetencia = `${competencia}-${String(new Date(anoCompetencia, mesCompetencia, 0).getDate()).padStart(2, "0")}`;
  const caixaCompetencia = visaoDeCaixa(base, "REALIZADO", inicioCompetencia, fimCompetencia);
  const resultadoCompetencia = caixaCompetencia.saldoInicial + eco.receitasRealizadas - eco.despesasRealizadas;
  const saldoCompetencia = caixa.saldoAtual + aReceber - aPagar;

  const vencidos = base.custos
    .filter(c => c.competencia === competencia && c.vencimento < hoje)
    .reduce((s, c) => s + financeiroDoCusto(c).saldo, 0);

  // A medição representa execução ainda não documentada. Quando vira NF/Recibo,
  // o valor passa para a linha do documento e não pode ser contado de novo.
  const reconhecidoMedicoes = medicoes.reduce((s, m) => {
    const documentos = [
      ...base.notas
        .filter(n => n.medicaoId === m.id)
        .map(n => ({ valor: financeiroDaNota(n).emitida ? n.valorNota : n.valorPrevisto })),
      ...base.recibos
        .filter(r => r.medicaoId === m.id && !r.substituido)
        .map(r => ({ valor: financeiroDoRecibo(r).foiEmitido ? r.valorRecibo : r.valorPrevisto })),
    ];
    return s + saldoAFaturarDaMedicao(Math.max(0, m.valorMedido ?? m.valorPrevisto), documentos);
  }, 0);
  const recebidoMedicoes = 0;
  const arMedicoes = 0;

  const notasCompetencia = base.notas.filter(n => n.competencia === competencia);
  const recibosCompetencia = base.recibos.filter(r => r.competencia === competencia && !r.substituido);
  const reconhecidoNotas = notasCompetencia.reduce((s, n) => s + (financeiroDaNota(n).emitida ? n.valorNota : n.valorPrevisto), 0);
  const recebidoNotas = notasCompetencia.reduce((s, n) => s + financeiroDaNota(n).recebido, 0);
  const arNotas = notasCompetencia.reduce((s, n) => s + (financeiroDaNota(n).emitida ? financeiroDaNota(n).saldo : n.valorPrevisto), 0);
  const reconhecidoRecibos = recibosCompetencia.reduce((s, r) => s + (financeiroDoRecibo(r).foiEmitido ? r.valorRecibo : r.valorPrevisto), 0);
  const recebidoRecibos = recibosCompetencia.reduce((s, r) => s + financeiroDoRecibo(r).recebido, 0);
  const arRecibos = recibosCompetencia.reduce((s, r) => s + (financeiroDoRecibo(r).foiEmitido ? financeiroDoRecibo(r).saldo : r.valorPrevisto), 0);

  const tipos = [
    { rotulo: "Custos Diretos", valor: "Custo Direto" },
    { rotulo: "Custos Indiretos", valor: "Custo Indireto" },
    { rotulo: "Custos Fixos", valor: "Custo Fixo" },
  ];
  const custosPorTipo = tipos.map(({ rotulo, valor }) => {
    const itens = eco.despesas.filter(d => d.tipo === valor);
    return {
      tipo: rotulo,
      previsto: itens.reduce((s, d) => s + d.realizado + d.previsto, 0),
      realizado: itens.reduce((s, d) => s + d.realizado, 0),
      pagar: itens.reduce((s, d) => s + d.previsto, 0),
    };
  });

  const contasReceber = [
    ...base.notas.map(n => ({
      data: n.previsaoRecebimento ?? "", descricao: `NF ${n.numero} · ${n.clienteNome ?? "—"}`,
      valor: financeiroDaNota(n).emitida ? financeiroDaNota(n).saldo : n.valorPrevisto, href: "/notas-fiscais",
    })),
    ...base.recibos.filter(r => !r.substituido).map(r => ({
      data: r.previsaoRecebimento ?? "", descricao: `${r.identificador} · ${r.clienteNome ?? "—"}`,
      valor: financeiroDoRecibo(r).foiEmitido ? financeiroDoRecibo(r).saldo : r.valorPrevisto, href: "/recibos",
    })),
  ].filter(x => x.valor > 0).sort((a,b) => (a.data || "9999").localeCompare(b.data || "9999")).slice(0,5);

  const contasPagar = base.custos.map(c => ({
    data: c.vencimento, descricao: c.descricao, tipo: c.tipo,
    valor: financeiroDoCusto(c).saldo, href: "/custos",
  })).filter(x => x.valor > 0).sort((a,b) => a.data.localeCompare(b.data)).slice(0,5);

  const previsoes = previsoesDeCaixa(base).filter(p => p.data);
  const periodos = [0,1,2,3].map(i => deslocarCompetencia(competencia, i));
  let saldoProjetadoCorrente = caixa.saldoAtual;
  const projecao = periodos.map(periodo => {
    const movs = previsoes.filter(p => p.data.startsWith(periodo));
    const ar = movs.reduce((s,m) => s + (m.valor > 0 ? m.valor : 0), 0);
    const pagar = movs.reduce((s,m) => s + (m.valor < 0 ? Math.abs(m.valor) : 0), 0);
    saldoProjetadoCorrente += ar - pagar;
    return { periodo, ar, pagar, saldo: saldoProjetadoCorrente };
  });

  const totalProjetadoVisual = Math.abs(caixa.saldoAtual) + aReceber + aPagar;
  const donutVazio = totalProjetadoVisual === 0;
  const donutBase = totalProjetadoVisual || 1;
  const pCaixa = Math.max(0, Math.min(100, Math.abs(caixa.saldoAtual) / donutBase * 100));
  const pReceber = Math.max(0, Math.min(100, aReceber / donutBase * 100));
  const pPagar = Math.max(0, 100 - pCaixa - pReceber);

  const semDados = base.custos.length === 0 && base.notas.length === 0 && base.recibos.length === 0 && medicoes.length === 0;

  return (
    <div className="fm-dashboard">
      <section className="fm-dashboard-title">
        <div>
          <span className="fm-eyebrow">VISÃO GERAL</span>
          <h1>Visão Geral Financeira</h1>
          <p>Resumo financeiro da FluxoMed Maricá em {formatarCompetencia(competencia)}.</p>
        </div>
        <SeletorCompetencia valor={competencia} />
      </section>

      {(semDados || !caixa.configurado) && (
        <div className="fm-pendencias">
          {semDados && <span>Sem lançamentos financeiros nesta base.</span>}
          {!caixa.configurado && <Link href="/fluxo-caixa">Configurar saldo inicial →</Link>}
        </div>
      )}

      <section className="fm-kpis-6">
        <Kpi href="/fluxo-caixa" titulo="Saldo atual em caixa" valor={caixa.configurado ? formatarReal(caixa.saldoAtual) : "—"} detalhe="Posição acumulada até hoje" tom="azul" icone={<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M16 12h5M6 6V4h11"/></svg>} />
        <Kpi href={`/detalhamento?tipo=entradas&competencia=${competencia}`} titulo="Entradas realizadas" valor={formatarReal(eco.receitasRealizadas)} detalhe={variacao(eco.receitasRealizadas, ecoAnterior.receitasRealizadas)} tom="verde" icone={<svg viewBox="0 0 24 24"><path d="M18 6 6 18M7 8v10h10"/></svg>} />
        <Kpi href={`/detalhamento?tipo=saidas&competencia=${competencia}`} titulo="Saídas realizadas" valor={formatarReal(eco.despesasRealizadas)} detalhe={variacao(eco.despesasRealizadas, ecoAnterior.despesasRealizadas)} tom="vermelho" icone={<svg viewBox="0 0 24 24"><path d="M6 18 18 6M17 16V6H7"/></svg>} />
        <Kpi href={`/detalhamento?tipo=receber&competencia=${competencia}`} titulo="A receber" valor={formatarReal(aReceber)} detalhe="Pendências de recebimento da competência" tom="amarelo" icone={<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M8 12h8M12 8v8"/></svg>} />
        <Kpi href={`/detalhamento?tipo=pagar&competencia=${competencia}`} titulo="A pagar" valor={formatarReal(aPagar)} detalhe="Obrigações pendentes de pagamento" tom="roxo" icone={<svg viewBox="0 0 24 24"><path d="M5 7h14v10H5z"/><path d="M8 12h8M12 9v6"/></svg>} />
        <Kpi href={`/detalhamento?tipo=vencidos&competencia=${competencia}`} titulo="Vencidos" valor={formatarReal(vencidos)} detalhe="Obrigações vencidas não pagas" tom="vermelho" icone={<svg viewBox="0 0 24 24"><path d="M12 3 2 20h20L12 3Z"/><path d="M12 9v5M12 17h.01"/></svg>} />
      </section>

      <section className="fm-grid-resumo">
        <article className="fm-card fm-resumo">
          <CabecalhoCard titulo="Resumo da competência" />
          <div className="fm-resumo-body">
            <div><span>Resultado da competência</span><Dinheiro valor={resultadoCompetencia} tom={resultadoCompetencia >= 0 ? "verde" : "vermelho"}/><small>Saldo inicial + entradas − saídas realizadas</small></div>
            <div><span>Saldo projetado</span><Dinheiro valor={saldoCompetencia} tom={saldoCompetencia >= 0 ? "azul" : "vermelho"}/><small>Caixa + a receber − a pagar</small></div>
          </div>
        </article>

        <article className="fm-card fm-projecao-donut">
          <CabecalhoCard titulo="Posição projetada" subtitulo="Caixa, valores a receber e compromissos" />
          <div className="fm-donut-wrap">
            <div className={`fm-donut ${donutVazio ? "fm-donut-vazio" : ""}`} style={{"--caixa": `${pCaixa}%`, "--receber": `${pCaixa+pReceber}%`} as React.CSSProperties}>
              <div><span>Saldo projetado</span><strong className={saldoCompetencia < 0 ? "negativo" : ""}>{formatarReal(saldoCompetencia)}</strong></div>
            </div>
            <div className="fm-donut-legenda">
              <div><i className="caixa"/><span>Saldo em Caixa</span><strong>{formatarReal(caixa.saldoAtual)}</strong><small>{Math.round(pCaixa)}%</small></div>
              <div><i className="receber"/><span>A receber</span><strong>{formatarReal(aReceber)}</strong><small>{Math.round(pReceber)}%</small></div>
              <div><i className="pagar"/><span>A pagar</span><strong>{formatarReal(aPagar)}</strong><small>{Math.round(pPagar)}%</small></div>
            </div>
          </div>
        </article>
      </section>

      <section className="fm-grid-duplo">
        <article className="fm-card fm-table-card">
          <CabecalhoCard titulo="Receitas" href="/medicoes" />
          <div className="fm-table-scroll"><table><thead><tr><th>Tipo</th><th className="dir">Reconhecido</th><th className="dir">Recebido</th><th className="dir">A receber</th></tr></thead><tbody>
            <tr><td>Medições a faturar</td><td className="dir azul">{formatarReal(reconhecidoMedicoes)}</td><td className="dir verde">{formatarReal(recebidoMedicoes)}</td><td className="dir amarelo">{formatarReal(arMedicoes)}</td></tr>
            <tr><td>Notas Fiscais</td><td className="dir azul">{formatarReal(reconhecidoNotas)}</td><td className="dir verde">{formatarReal(recebidoNotas)}</td><td className="dir amarelo">{formatarReal(arNotas)}</td></tr>
            <tr><td>Recibos</td><td className="dir azul">{formatarReal(reconhecidoRecibos)}</td><td className="dir verde">{formatarReal(recebidoRecibos)}</td><td className="dir amarelo">{formatarReal(arRecibos)}</td></tr>
            <tr className="total"><td>Total</td><td className="dir azul">{formatarReal(reconhecidoMedicoes + reconhecidoNotas + reconhecidoRecibos)}</td><td className="dir verde">{formatarReal(recebidoNotas + recebidoRecibos)}</td><td className="dir amarelo">{formatarReal(aReceber)}</td></tr>
          </tbody></table></div>
        </article>

        <article className="fm-card fm-table-card">
          <CabecalhoCard titulo="Custos" href="/custos" />
          <div className="fm-table-scroll"><table><thead><tr><th>Tipo</th><th className="dir">Previsto</th><th className="dir">Realizado</th><th className="dir">A pagar</th></tr></thead><tbody>
            {custosPorTipo.map(c => <tr key={c.tipo}><td>{c.tipo}</td><td className="dir azul">{formatarReal(c.previsto)}</td><td className="dir vermelho">{formatarReal(c.realizado)}</td><td className="dir roxo">{formatarReal(c.pagar)}</td></tr>)}
            <tr className="total"><td>Total</td><td className="dir azul">{formatarReal(eco.despesasRealizadas + eco.despesasPrevistas)}</td><td className="dir vermelho">{formatarReal(eco.despesasRealizadas)}</td><td className="dir roxo">{formatarReal(aPagar)}</td></tr>
          </tbody></table></div>
        </article>
      </section>

      <section className="fm-grid-duplo">
        <article className="fm-card fm-table-card">
          <CabecalhoCard titulo="Contas a receber" subtitulo="Somente Pendências a receber" href="/notas-fiscais" />
          {contasReceber.length ? <div className="fm-table-scroll"><table><thead><tr><th>Descrição</th><th>Previsão</th><th className="dir">Valor</th></tr></thead><tbody>{contasReceber.map((c,i)=><tr key={i}><td><Link href={c.href}>{c.descricao}</Link></td><td>{formatarData(c.data)}</td><td className="dir verde">{formatarReal(c.valor)}</td></tr>)}</tbody></table></div> : <div className="fm-empty"><span>▱</span>Nenhuma conta a receber pendente.</div>}
        </article>

        <article className="fm-card fm-table-card">
          <CabecalhoCard titulo="Contas a pagar" subtitulo="Obrigações rastreáveis cadastradas em Custos" href="/custos" />
          {contasPagar.length ? <div className="fm-table-scroll"><table><thead><tr><th>Descrição</th><th>Vencimento</th><th className="dir">Valor</th><th>Status</th></tr></thead><tbody>{contasPagar.map((c,i)=><tr key={i}><td><Link href={c.href}><strong>{c.descricao}</strong><small>{c.tipo}</small></Link></td><td>{formatarData(c.data)}</td><td className="dir roxo">{formatarReal(c.valor)}</td><td><span className={`fm-status ${c.data < hoje ? "vencido" : "aberto"}`}>{c.data < hoje ? "Vencido" : "A vencer"}</span></td></tr>)}</tbody></table></div> : <div className="fm-empty"><span>✓</span>Nenhuma conta a pagar pendente.</div>}
        </article>
      </section>

      <section className="fm-card fm-table-card fm-projecao-table">
        <CabecalhoCard titulo="Projeção de caixa" subtitulo="Próximas competências a partir do saldo atual" href="/fluxo-caixa" />
        <div className="fm-table-scroll"><table><thead><tr><th>Período</th><th className="dir">A receber</th><th className="dir">A pagar</th><th className="dir">Saldo projetado</th></tr></thead><tbody>{projecao.map(p => <tr key={p.periodo}><td>{formatarCompetencia(p.periodo)}</td><td className="dir amarelo">{formatarReal(p.ar)}</td><td className="dir roxo">{formatarReal(p.pagar)}</td><td className={`dir ${p.saldo < 0 ? "vermelho" : "verde"}`}>{formatarReal(p.saldo)}</td></tr>)}</tbody></table></div>
      </section>

      <footer className="fm-dashboard-footer"><strong>FLUXOMED MARICÁ • v1.0.0</strong><span>Cuidando da saúde financeira da sua clínica ♥</span></footer>
    </div>
  );
}



