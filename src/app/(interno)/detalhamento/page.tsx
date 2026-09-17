import Link from "next/link";
import { carregarBase, formatarCompetencia, formatarData, formatarReal } from "@/lib/financeiro/dados";
import { competenciaAtual, financeiroDoCusto, financeiroDaNota, financeiroDoRecibo } from "@/lib/financeiro/motor";
import { hojeISO } from "@/lib/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Detalhamento financeiro · FluxoMed Maricá" };

type Tipo = "entradas"|"saidas"|"receber"|"pagar"|"vencidos";
interface Props { searchParams: Promise<{tipo?:string; competencia?:string}> }

type Linha = { origem:string; descricao:string; contraparte:string; documento:string; data:string; valor:number; status:string; href:string };

const config: Record<Tipo,{titulo:string; subtitulo:string; tom:string}> = {
  entradas:{titulo:"Entradas realizadas",subtitulo:"Valores efetivamente recebidos na competência",tom:"verde"},
  saidas:{titulo:"Saídas realizadas",subtitulo:"Pagamentos efetivamente realizados na competência",tom:"vermelho"},
  receber:{titulo:"Contas a receber",subtitulo:"Valores ainda pendentes de recebimento",tom:"amarelo"},
  pagar:{titulo:"Contas a pagar",subtitulo:"Obrigações ainda pendentes de pagamento",tom:"roxo"},
  vencidos:{titulo:"Vencidos",subtitulo:"Obrigações vencidas e ainda não pagas",tom:"vermelho"},
};

export default async function Detalhamento({searchParams}:Props){
  const sp=await searchParams;
  const tipo:Tipo = ["entradas","saidas","receber","pagar","vencidos"].includes(sp.tipo||"") ? sp.tipo as Tipo : "receber";
  const competencia=/^\d{4}-\d{2}$/.test(sp.competencia||"") ? sp.competencia! : competenciaAtual();
  const base=await carregarBase(); const hoje=hojeISO(); let linhas:Linha[]=[];

  if(tipo==="entradas"){
    linhas = [
      ...base.notas
        .filter(n => n.competencia === competencia)
        .map(n => {
          const f = financeiroDaNota(n);
          return {
            origem: "Nota Fiscal",
            descricao: `NF ${n.numero}`,
            contraparte: n.clienteNome || "—",
            documento: `NF ${n.numero}`,
            data: n.dataEmissao || "",
            valor: f.recebido,
            status: "Realizado",
            href: "/notas-fiscais"
          };
        }),
      ...base.recibos
        .filter(r => r.competencia === competencia && !r.substituido)
        .map(r => {
          const f = financeiroDoRecibo(r);
          return {
            origem: "Recibo",
            descricao: r.identificador,
            contraparte: r.clienteNome || "—",
            documento: r.identificador,
            data: r.dataEmissao || "",
            valor: f.recebido,
            status: "Realizado",
            href: "/recibos"
          };
        })
    ].filter(x => x.valor > 0);
  }

  if(tipo==="saidas"){
    linhas = base.custos
      .filter(c => c.competencia === competencia)
      .map(c => {
        const f = financeiroDoCusto(c);
        return {
          origem: c.tipo,
          descricao: c.descricao,
          contraparte: c.categoriaNome || "—",
          documento: c.descricao,
          data: c.vencimento,
          valor: f.pago,
          status: "Realizado",
          href: "/custos"
        };
      })
      .filter(x => x.valor > 0);
  }
  if(tipo==="receber"){
    linhas=[...base.notas.filter(n=>n.competencia===competencia).map(n=>({origem:"Nota Fiscal",descricao:`NF ${n.numero}`,contraparte:n.clienteNome||"—",documento:`NF ${n.numero}`,data:n.previsaoRecebimento||"",valor:financeiroDaNota(n).emitida?financeiroDaNota(n).saldo:n.valorPrevisto,status:"A receber",href:"/notas-fiscais"})),...base.recibos.filter(r=>r.competencia===competencia && !r.substituido).map(r=>({origem:"Recibo",descricao:r.identificador,contraparte:r.clienteNome||"—",documento:r.identificador,data:r.previsaoRecebimento||"",valor:financeiroDoRecibo(r).foiEmitido?financeiroDoRecibo(r).saldo:r.valorPrevisto,status:"A receber",href:"/recibos"}))].filter(x=>x.valor>0);
  }
  if(tipo==="pagar" || tipo==="vencidos"){
    linhas=base.custos.filter(c=>c.competencia===competencia).map(c=>({origem:c.tipo,descricao:c.descricao,contraparte:c.categoriaNome||"—",documento:c.descricao,data:c.vencimento,valor:financeiroDoCusto(c).saldo,status:c.vencimento<hoje?"Vencido":"A vencer",href:"/custos"})).filter(x=>x.valor>0 && (tipo!=="vencidos" || x.data<hoje));
  }
  linhas.sort((a,b)=>(a.data||"9999").localeCompare(b.data||"9999"));
  const total=linhas.reduce((s,l)=>s+l.valor,0); const c=config[tipo];
  return <div className="fm-detalhe-page">
    <div className="fm-detalhe-topo"><div><Link href={`/painel?competencia=${competencia}`}>← Voltar à Visão Geral</Link><span className="fm-eyebrow">DETALHAMENTO</span><h1>{c.titulo}</h1><p>{c.subtitulo} · {formatarCompetencia(competencia)}</p></div><div className={`fm-detalhe-total fm-${c.tom}`}><span>Total</span><strong>{formatarReal(total)}</strong><small>{linhas.length} {linhas.length===1?"item":"itens"}</small></div></div>
    <article className="fm-card fm-table-card fm-detalhe-card"><div className="fm-table-scroll"><table><thead><tr><th>Origem</th><th>Descrição / documento</th><th>Cliente / categoria</th><th>Data</th><th>Status</th><th className="dir">Valor</th></tr></thead><tbody>{linhas.length?linhas.map((l,i)=><tr key={`${l.documento}-${i}`}><td>{l.origem}</td><td><Link href={l.href}>{l.descricao}</Link></td><td>{l.contraparte}</td><td>{formatarData(l.data)}</td><td><span className={`fm-status ${l.status==="Vencido"?"vencido":"aberto"}`}>{l.status}</span></td><td className={`dir ${c.tom}`}>{formatarReal(l.valor)}</td></tr>):<tr><td colSpan={6}><div className="fm-empty">Nenhum lançamento encontrado para este detalhamento.</div></td></tr>}</tbody></table></div></article>
  </div>;
}

