"use client";

import CampoMoeda from "@/components/CampoMoeda";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PainelEventos from "./PainelEventos";
import AnexoPdf from "@/components/AnexoPdf";
import { real, dataBR, hojeISO, competenciaHoje, paraNumero, classeSelo } from "@/lib/ui";
import SelectPadrao from "@/components/SelectPadrao";

/**
 * Notas Fiscais e Recibos são o mesmo componente.
 *
 * Os dois têm a mesma natureza: documento de receita que pode nascer
 * previsto, ser emitido e receber em parcelas com estorno. O que muda é o
 * vocabulário e dois campos. Manter duas cópias faria as regras divergirem.
 */

interface Cliente { id: string; nomeFantasia: string }
interface MedicaoOpcao { id: string; identificador: string; clienteId: string; competencia: string; previsaoRecebimento: string | null; aFaturar: number }

interface Documento {
  id: string; clienteId?: string; medicaoId?: string | null; cliente: string; competencia: string;
  dataEmissao: string | null; previsaoRecebimento: string | null;
  valorPrevisto: number; recebido: number; saldo: number;
  situacao: string; medicao: string | null; temMovimento: boolean;
  numero?: string; faturado?: number; emitida?: boolean;
  identificador?: string; descricao?: string; emitido?: number; foiEmitido?: boolean; origem?: string;
  substitui?: string | null; substituidoPor?: string | null; versaoSubstituicao?: number;
  motivoSubstituicao?: string | null; substituidoEm?: string | null;
  anexo: { nomeArquivo: string; tamanhoBytes: number; mimeType?: string } | null;
}

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const CONFIG = {
  nota: {
    rota: "/api/notas", lista: "notas", eventos: "recebimentos",
    titulo: "nota", rotuloDoc: "Número", novoRotulo: "Nova nota fiscal",
    campoValor: "valorNota", flagEmitido: "emitida",
  },
  recibo: {
    rota: "/api/recibos", lista: "recibos", eventos: "recebimentos",
    titulo: "recibo", rotuloDoc: "Identificador", novoRotulo: "Novo recibo",
    campoValor: "valorRecibo", flagEmitido: "emitido",
  },
} as const;

export default function GerenciarDocumentos({
  tipo, clientes, medicoes, somenteLeitura,
}: {
  tipo: "nota" | "recibo";
  clientes: Cliente[];
  medicoes: MedicaoOpcao[];
  somenteLeitura: boolean;
}) {
  const cfg = CONFIG[tipo];
  const router = useRouter();
  const [itens, setItens] = useState<Documento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [formAberto, setFormAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("Todos");
  const [competenciaFiltro, setCompetenciaFiltro] = useState(competenciaHoje());
  const [clienteFiltro, setClienteFiltro] = useState("");
  const [recebendo, setRecebendo] = useState<Documento | null>(null);
  const [emitindo, setEmitindo] = useState<Documento | null>(null);
  const [visualizando, setVisualizando] = useState<Documento | null>(null);
  const [excluindo, setExcluindo] = useState<Documento | null>(null);
  const [substituindo, setSubstituindo] = useState<Documento | null>(null);
  const [formSubstituicao, setFormSubstituicao] = useState({ motivo: "", descricao: "", dataEmissao: hojeISO(), valorRecibo: "", previsaoRecebimento: "" });
  const [dataEmissao, setDataEmissao] = useState(hojeISO());
  const [valorEmissao, setValorEmissao] = useState("");

  const [form, setForm] = useState({
    clienteId: "", medicaoId: "", doc: "", descricao: "",
    competencia: competenciaHoje(), valorPrevisto: "",
    emitido: false, dataEmissao: hojeISO(), valorDoc: "", previsaoRecebimento: "",
  });

  async function carregar() {
    setCarregando(true);
    const r = await fetch(cfg.rota);
    if (r.ok) {
      const d = await r.json();
      setItens(d[cfg.lista]);
    }
    setCarregando(false);
  }
  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [tipo]);

  const campo = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));
  const medicoesDoCliente = medicoes.filter((m) => m.clienteId === form.clienteId);

  const proximoIdentificadorRecibo = (() => {
    const ano = form.dataEmissao.slice(0, 4);
    const prefixo = `REC-${ano}-`;
    const maior = itens.reduce((atual, d) => {
      const id = d.identificador ?? "";
      if (!id.startsWith(prefixo)) return atual;
      const numero = Number(id.slice(prefixo.length));
      return Number.isInteger(numero) ? Math.max(atual, numero) : atual;
    }, 0);
    return `${prefixo}${String(maior + 1).padStart(4, "0")}`;
  })();

  function abrirNovo() {
    setErro(null);
    setEditandoId(null);
    setForm({
      clienteId: "",
      medicaoId: "",
      doc: "",
      descricao: "",
      competencia: competenciaHoje(),
      valorPrevisto: "",
      emitido: false,
      dataEmissao: hojeISO(),
      valorDoc: "",
      previsaoRecebimento: "",
    });
    setFormAberto(true);
  }

  function abrirEdicao(d: Documento) {
    if (tipo === "recibo" && d.substituidoPor) {
      setErro("Este recibo foi substituído e permanece preservado no histórico. Edite a versão atual.");
      return;
    }

    setErro(null);
    setEditandoId(d.id);

    setForm({
      clienteId: d.clienteId ?? "",
      medicaoId: d.medicaoId ?? "",
      doc: tipo === "nota" ? (d.numero ?? "") : (d.identificador ?? ""),
      descricao: d.descricao ?? "",
      competencia: d.competencia,
      valorPrevisto: String(d.valorPrevisto).replace(".", ","),
      emitido: foiEmitido(d),
      dataEmissao: d.dataEmissao ?? hojeISO(),
      valorDoc: foiEmitido(d)
        ? String(faturadoDe(d)).replace(".", ",")
        : "",
      previsaoRecebimento: d.previsaoRecebimento ?? "",
    });

    setFormAberto(true);
  }

  function fecharFormulario() {
    if (salvando) return;
    setFormAberto(false);
    setEditandoId(null);
    setErro(null);
  }
  function selecionarMedicao(valor: string) {
    if (!valor) {
      setForm((f) => ({ ...f, medicaoId: "", valorPrevisto: "", valorDoc: "", previsaoRecebimento: "" }));
      return;
    }
    const m = medicoes.find((x) => x.id === valor);
    if (!m) return;
    const valorFormatado = m.aFaturar.toFixed(2).replace(".", ",");
    setForm((f) => ({
      ...f,
      medicaoId: m.id,
      valorPrevisto: valorFormatado,
      // A nota fiscal lê o valor de valorDoc (não valorPrevisto) — sem isso,
      // criar uma NF vinculada a uma medição enviava valorNota vazio e a API
      // recusava com 400, tornando o vínculo impossível pela tela.
      valorDoc: valorFormatado,
      previsaoRecebimento: m.previsaoRecebimento ?? "",
    }));
  }

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);

    try {
      const editando = !!editandoId;

      const corpo = tipo === "nota"
        ? editando
          ? {
              id: editandoId,
              acao: "editar",
              clienteId: form.clienteId,
              medicaoId: form.medicaoId || null,
              numero: form.doc,
              dataEmissao: form.dataEmissao,
              valorNota: paraNumero(form.valorDoc),
              previsaoRecebimento: form.previsaoRecebimento || null,
            }
          : {
              clienteId: form.clienteId,
              medicaoId: form.medicaoId || null,
              competencia: form.dataEmissao.slice(0, 7),
              valorPrevisto: paraNumero(form.valorDoc),
              dataEmissao: form.dataEmissao,
              previsaoRecebimento: form.previsaoRecebimento || null,
              numero: form.doc,
              emitida: true,
              valorNota: paraNumero(form.valorDoc),
            }
        : editando
          ? {
              id: editandoId,
              acao: "editar",
              clienteId: form.clienteId,
              medicaoId: form.medicaoId || null,
              // Só emitido tem data de emissão para derivar o mês; um recibo
              // previsto usa a competência já carregada, não a de hoje —
              // senão editar um recibo previsto move a receita de mês.
              competencia: form.emitido ? form.dataEmissao.slice(0, 7) : form.competencia,
              valorPrevisto: paraNumero(form.valorPrevisto),
              dataEmissao: form.emitido ? form.dataEmissao : null,
              previsaoRecebimento: form.previsaoRecebimento || null,
              descricao: form.descricao,
              origem: form.medicaoId ? "MEDICAO" : "AVULSO",
              emitido: form.emitido,
              valorRecibo: form.emitido ? paraNumero(form.valorDoc) : null,
            }
          : {
              clienteId: form.clienteId,
              medicaoId: form.medicaoId || null,
              competencia: form.emitido ? form.dataEmissao.slice(0, 7) : form.competencia,
              valorPrevisto: paraNumero(form.valorPrevisto),
              dataEmissao: form.emitido ? form.dataEmissao : null,
              previsaoRecebimento: form.previsaoRecebimento || null,
              descricao: form.descricao,
              origem: form.medicaoId ? "MEDICAO" : "AVULSO",
              emitido: form.emitido,
              valorRecibo: form.emitido ? paraNumero(form.valorDoc) : null,
            };

      const r = await fetch(cfg.rota, {
        method: editando ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });

      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErro(d.erro ?? "Não foi possível salvar o documento.");
        return;
      }

      setEditandoId(null);
      setFormAberto(false);
      setForm({
        clienteId: "",
        medicaoId: "",
        doc: "",
        descricao: "",
        competencia: competenciaHoje(),
        valorPrevisto: "",
        emitido: false,
        dataEmissao: hojeISO(),
        valorDoc: "",
        previsaoRecebimento: "",
      });

      await carregar();
      router.refresh();
    } finally {
      setSalvando(false);
    }
  }
  async function emitir(e: React.FormEvent) {
    e.preventDefault();
    if (!emitindo) return;
    setErro(null); setSalvando(true);
    try {
      const corpo: Record<string, unknown> = { id: emitindo.id, dataEmissao };
      corpo[cfg.campoValor] = paraNumero(valorEmissao);
      const r = await fetch(cfg.rota, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo),
      });
      const d = await r.json();
      if (!r.ok) { setErro(d.erro); return; }
      setEmitindo(null); setValorEmissao("");
      await carregar(); router.refresh();
    } finally { setSalvando(false); }
  }


  function abrirSubstituicao(d: Documento) {
    setErro(null);
    setSubstituindo(d);
    setFormSubstituicao({
      motivo: "",
      descricao: d.descricao ?? "",
      dataEmissao: d.dataEmissao ?? hojeISO(),
      valorRecibo: String(d.emitido ?? d.valorPrevisto).replace(".", ","),
      previsaoRecebimento: d.previsaoRecebimento ?? "",
    });
  }

  async function substituirRecibo(e: React.FormEvent) {
    e.preventDefault();
    if (!substituindo) return;
    setErro(null);
    setSalvando(true);
    try {
      const r = await fetch(`/api/recibos/${substituindo.id}/substituir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          motivo: formSubstituicao.motivo,
          descricao: formSubstituicao.descricao,
          dataEmissao: formSubstituicao.dataEmissao,
          valorRecibo: paraNumero(formSubstituicao.valorRecibo),
          previsaoRecebimento: formSubstituicao.previsaoRecebimento || null,
        }),
      });
      const d = await r.json().catch(() => ({ erro: `Falha HTTP ${r.status} ao substituir o recibo.` }));
      if (!r.ok) {
        setErro(d.erro ?? "Não foi possível substituir o recibo.");
        return;
      }
      setSubstituindo(null);
      await carregar();
      router.refresh();
    } finally {
      setSalvando(false);
    }
  }

  async function excluirDocumento() {
    if (!excluindo) return;
    setSalvando(true);
    setErro(null);
    try {
      const r = await fetch(cfg.rota, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: excluindo.id }),
      });
      const d = await r.json();
      if (!r.ok) {
        setErro(d.erro ?? `Não foi possível excluir ${cfg.titulo}.`);
        return;
      }
      setExcluindo(null);
      await carregar();
      router.refresh();
    } finally {
      setSalvando(false);
    }
  }
  const rotuloDe = (d: Documento) => (tipo === "nota" ? `NF ${d.numero}` : d.identificador ?? "—");
  const faturadoDe = (d: Documento) => (tipo === "nota" ? d.faturado ?? 0 : d.emitido ?? 0);
  const foiEmitido = (d: Documento) => (tipo === "nota" ? Boolean(d.emitida) : Boolean(d.foiEmitido));

  const visiveis = itens.filter((d) => {
    const texto = `${rotuloDe(d)} ${d.cliente} ${d.descricao ?? ""}`.toLowerCase();
    if (competenciaFiltro && d.competencia !== competenciaFiltro) return false;
    if (clienteFiltro && d.cliente !== clienteFiltro) return false;
    if (busca && !texto.includes(busca.toLowerCase())) return false;
    if (filtro !== "Todos" && d.situacao !== filtro) return false;
    return true;
  });

  const totais = visiveis.filter((d) => !d.substituidoPor).reduce(
    (t, d) => ({
      previsto: t.previsto + d.valorPrevisto,
      faturado: t.faturado + faturadoDe(d),
      recebido: t.recebido + d.recebido,
      saldo: t.saldo + d.saldo,
    }),
    { previsto: 0, faturado: 0, recebido: 0, saldo: 0 }
  );

  const anosNotas = Array.from(new Set([new Date().getFullYear(), ...itens.map((d) => Number(d.competencia.slice(0, 4)))]))
    .filter(Number.isFinite)
    .sort((a, b) => b - a);
  const [anoFiltroNota, mesFiltroNota] = competenciaFiltro.split("-");
  const clientesNotas = Array.from(new Set(itens.map((d) => d.cliente))).sort((a, b) => a.localeCompare(b, "pt-BR"));

  return (
    <>
      {erro && <div className="aviso erro-aviso">{erro}</div>}

      {tipo === "nota" && (
        <>
          <div className="fm-custos-toolbar">
            <div className="fm-competencia-controle" aria-label="Competência exibida">
              <span className="fm-competencia-icone" aria-hidden="true">▣</span>
              <span className="fm-competencia-label">Competência</span>
              <div className="fm-competencia-select fm-competencia-mes">
                <SelectPadrao
                  value={mesFiltroNota}
                  onChange={(v) => setCompetenciaFiltro(`${anoFiltroNota}-${v}`)}
                  options={MESES.map((m, i) => ({ value: String(i + 1).padStart(2, "0"), label: m }))}
                  ariaLabel="Mês da competência"
                />
              </div>
              <span className="fm-competencia-separador">/</span>
              <div className="fm-competencia-select fm-competencia-ano">
                <SelectPadrao
                  value={anoFiltroNota}
                  onChange={(v) => setCompetenciaFiltro(`${v}-${mesFiltroNota}`)}
                  options={anosNotas.map((a) => ({ value: String(a), label: String(a) }))}
                  ariaLabel="Ano da competência"
                />
              </div>
            </div>
            {!somenteLeitura && (
              <button type="button" className="botao fm-botao-novo" onClick={abrirNovo}>+ Nova Nota Fiscal</button>
            )}
          </div>

          <div className="fm-modulo-resumo">
            <div className="fm-kpi-compacto"><span>Faturado no mês</span><strong>{real(totais.faturado)}</strong></div>
            <div className="fm-kpi-compacto fm-kpi-sucesso"><span>Recebido</span><strong>{real(totais.recebido)}</strong></div>
            <div className="fm-kpi-compacto fm-kpi-ambar"><span>A receber</span><strong>{real(totais.saldo)}</strong></div>
            <div className="fm-kpi-compacto fm-kpi-roxo"><span>Quantidade</span><strong>{visiveis.length}</strong></div>
          </div>

          <div className="fm-legenda-custos" aria-label="Legenda das notas fiscais">
            <span className="fm-legenda-titulo">Legenda</span>
            <span><i className="fm-dot fm-dot-previsto" />Faturado</span>
            <span><i className="fm-dot fm-dot-realizado" />Recebido</span>
            <span><i className="fm-dot fm-dot-pendente" />A receber</span>
            <span><i className="fm-dot fm-dot-diferenca" />Quantidade</span>
          </div>

          {!somenteLeitura && formAberto && (
            <div
              className="fm-custo-modal-overlay"
              role="dialog"
              aria-modal="true"
              aria-label={editandoId ? "Editar nota fiscal" : "Nova nota fiscal"}
              onMouseDown={(e) => { if (e.target === e.currentTarget) fecharFormulario(); }}
            >
              <div className="fm-custo-modal fm-nota-modal" onMouseDown={(e) => e.stopPropagation()}>
                <div className="fm-custo-modal-cabecalho">
                  <h2>{editandoId ? "Editar · Nota Fiscal" : "Nova · Nota Fiscal"}</h2>
                  <button type="button" className="fm-custo-modal-fechar" onClick={fecharFormulario} aria-label="Fechar">×</button>
                </div>

                <form className="fm-custo-form" onSubmit={criar}>
                  <div className="fm-custo-modal-corpo">
                    <section className="fm-custo-secao">
                      <div className="fm-custo-secao-titulo">Identificação</div>
                      <div className="fm-custo-grid">
                        <div className="fm-custo-campo">
                          <label>Cliente <b>*</b></label>
                          <SelectPadrao
                            value={form.clienteId}
                            onChange={(valor) => { campo("clienteId", valor); campo("medicaoId", ""); }}
                            disabled={salvando}
                            placeholder="Selecione..."
                            options={clientes.map((c) => ({ value: c.id, label: c.nomeFantasia }))}
                            ariaLabel="Cliente da nota fiscal"
                          />
                        </div>
                        <div className="fm-custo-campo">
                          <label>Número da Nota Fiscal <b>*</b></label>
                          <input value={form.doc} onChange={(e) => campo("doc", e.target.value)} placeholder="Ex.: 1001" required disabled={salvando} />
                        </div>
                        <div className="fm-custo-campo fm-custo-campo-largo">
                          <label>Medição de origem</label>
                          <SelectPadrao value={form.medicaoId} onChange={selecionarMedicao} disabled={salvando || !form.clienteId || !!editandoId} options={[{ value: "", label: "Sem vínculo (avulsa)" }, ...medicoesDoCliente.filter((m) => m.aFaturar > 0 || m.id === form.medicaoId).map((m) => ({ value: m.id, label: `${m.identificador} · disponível ${real(m.aFaturar)}` }))]} ariaLabel="Medição de origem da nota fiscal" />
                        </div>
                      </div>
                    </section>

                    <section className="fm-custo-secao">
                      <div className="fm-custo-secao-titulo">Nota Fiscal</div>
                      <div className="fm-custo-grid">
                        <div className="fm-custo-campo">
                          <label>Data de emissão <b>*</b></label>
                          <input type="date" value={form.dataEmissao} onChange={(e) => campo("dataEmissao", e.target.value)} required disabled={salvando} style={{ colorScheme: "dark" }} />
                        </div>
                        <div className="fm-custo-campo">
                          <label>Valor da Nota Fiscal <b>*</b></label>
                          <CampoMoeda value={form.valorDoc} onChange={(e) => campo("valorDoc", e.target.value)} placeholder="0,00" required disabled={salvando || (!!form.medicaoId && !editandoId)} />
                        </div>
                      </div>
                    </section>

                    <section className="fm-custo-secao fm-custo-secao-previsao">
                      <div className="fm-custo-secao-titulo">Previsão Financeira</div>
                      <div className="fm-custo-grid">
                        <div className="fm-custo-campo">
                          <label>Previsão de recebimento</label>
                          <input type="date" value={form.previsaoRecebimento} onChange={(e) => campo("previsaoRecebimento", e.target.value)} disabled={salvando || (!!form.medicaoId && !editandoId)} style={{ colorScheme: "dark" }} />
                        </div>
                      </div>
                    </section>
                  </div>

                  <div className="fm-custo-modal-rodape">
                    <button type="button" className="botao discreto" onClick={fecharFormulario} disabled={salvando}>Cancelar</button>
                    <button type="submit" className="botao" disabled={salvando}>{salvando ? "Salvando…" : editandoId ? "Salvar alterações" : "Salvar Nota Fiscal"}</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}

      {tipo === "recibo" && (
        <>
          <div className="fm-custos-toolbar">
            <div className="fm-competencia-controle" aria-label="Competência exibida">
              <span className="fm-competencia-icone" aria-hidden="true">▣</span>
              <span className="fm-competencia-label">Competência</span>
              <div className="fm-competencia-select fm-competencia-mes">
                <SelectPadrao
                  value={mesFiltroNota}
                  onChange={(v) => setCompetenciaFiltro(`${anoFiltroNota}-${v}`)}
                  options={MESES.map((m, i) => ({ value: String(i + 1).padStart(2, "0"), label: m }))}
                  ariaLabel="Mês da competência"
                />
              </div>
              <span className="fm-competencia-separador">/</span>
              <div className="fm-competencia-select fm-competencia-ano">
                <SelectPadrao
                  value={anoFiltroNota}
                  onChange={(v) => setCompetenciaFiltro(`${v}-${mesFiltroNota}`)}
                  options={anosNotas.map((a) => ({ value: String(a), label: String(a) }))}
                  ariaLabel="Ano da competência"
                />
              </div>
            </div>
            {!somenteLeitura && (
              <button type="button" className="botao fm-botao-novo" onClick={abrirNovo}>+ Novo Recibo</button>
            )}
          </div>

          <div className="fm-modulo-resumo">
            <div className="fm-kpi-compacto"><span>Previsto no mês</span><strong>{real(totais.previsto)}</strong></div>
            <div className="fm-kpi-compacto fm-kpi-sucesso"><span>Recebido</span><strong>{real(totais.recebido)}</strong></div>
            <div className="fm-kpi-compacto fm-kpi-ambar"><span>A receber</span><strong>{real(totais.saldo)}</strong></div>
            <div className="fm-kpi-compacto fm-kpi-roxo"><span>Quantidade</span><strong>{visiveis.length}</strong></div>
          </div>

          <div className="fm-legenda-custos" aria-label="Legenda dos recibos">
            <span className="fm-legenda-titulo">Legenda</span>
            <span><i className="fm-dot fm-dot-previsto" />Previsto</span>
            <span><i className="fm-dot fm-dot-realizado" />Recebido</span>
            <span><i className="fm-dot fm-dot-pendente" />A receber</span>
            <span><i className="fm-dot fm-dot-diferenca" />Quantidade</span>
          </div>

          {!somenteLeitura && formAberto && (
            <div
              className="fm-custo-modal-overlay"
              role="dialog"
              aria-modal="true"
              aria-label={editandoId ? "Editar recibo" : "Novo recibo"}
              onMouseDown={(e) => { if (e.target === e.currentTarget) fecharFormulario(); }}
            >
              <div className="fm-custo-modal fm-recibo-modal" onMouseDown={(e) => e.stopPropagation()}>
                <div className="fm-custo-modal-cabecalho">
                  <h2>{editandoId ? "Editar · Recibo" : "Novo · Recibo"}</h2>
                  <button type="button" className="fm-custo-modal-fechar" onClick={fecharFormulario} aria-label="Fechar">×</button>
                </div>

                <form className="fm-custo-form" onSubmit={criar}>
                  <div className="fm-custo-modal-corpo">
                    <section className="fm-custo-secao">
                      <div className="fm-custo-secao-titulo">Identificação</div>
                      <div className="fm-custo-grid">
                        <div className="fm-custo-campo">
                          <label>Cliente <b>*</b></label>
                          <SelectPadrao value={form.clienteId} onChange={(valor) => { campo("clienteId", valor); campo("medicaoId", ""); }} disabled={salvando} placeholder="Selecione..." options={clientes.map((c) => ({ value: c.id, label: c.nomeFantasia }))} ariaLabel="Cliente do recibo" />
                        </div>
                        <div className="fm-custo-campo">
                          <label>Identificador</label>
                          <input
                            value={form.emitido ? proximoIdentificadorRecibo : "Gerado ao emitir o recibo"}
                            readOnly
                            title={form.emitido ? "Numeração automática do recibo" : "Recibos previstos recebem um identificador provisório até serem emitidos"}
                          />
                        </div>
                        <div className="fm-custo-campo fm-custo-campo-largo">
                          <label>Descrição <b>*</b></label>
                          <input value={form.descricao} onChange={(e) => campo("descricao", e.target.value)} placeholder="Do que se trata este recibo" required disabled={salvando} />
                        </div>
                      </div>
                    </section>

                    <section className="fm-custo-secao">
                      <div className="fm-custo-secao-titulo">Origem do Recibo</div>
                      <div className="fm-custo-grid">
                        <div className="fm-custo-campo fm-custo-campo-largo">
                          <label>Medição de origem</label>
                          <SelectPadrao value={form.medicaoId} onChange={(valor) => selecionarMedicao(valor)} disabled={salvando || !form.clienteId || !!editandoId} options={[{ value: "", label: "Sem vínculo (avulso)" }, ...medicoesDoCliente.filter((m) => m.aFaturar > 0 || m.id === form.medicaoId).map((m) => ({ value: m.id, label: `${m.identificador} · disponível ${real(m.aFaturar)}` }))]} ariaLabel="Medição de origem" />
                        </div>
                      </div>
                    </section>

                    <section className="fm-custo-secao">
                      <div className="fm-custo-secao-titulo">Valores e Emissão</div>
                      <div className="fm-custo-grid">
                        <div className="fm-custo-campo">
                          <label>Data de emissão <b>*</b></label>
                          <input type="date" value={form.dataEmissao} onChange={(e) => campo("dataEmissao", e.target.value)} required disabled={salvando} style={{ colorScheme: "dark" }} />
                        </div>
                        <div className="fm-custo-campo">
                          <label>Valor previsto <b>*</b></label>
                          <CampoMoeda value={form.valorPrevisto} onChange={(e) => campo("valorPrevisto", e.target.value)} placeholder="0,00" required disabled={salvando || (!!form.medicaoId && !editandoId)} />
                        </div>
                        <div className="fm-custo-campo">
                          <label>Previsão de recebimento</label>
                          <input type="date" value={form.previsaoRecebimento} onChange={(e) => campo("previsaoRecebimento", e.target.value)} disabled={salvando || (!!form.medicaoId && !editandoId)} style={{ colorScheme: "dark" }} />
                        </div>
                        <div className="fm-custo-campo fm-recibo-check-wrap">
                          <label className="fm-recibo-check"><input type="checkbox" checked={form.emitido} onChange={(e) => campo("emitido", e.target.checked)} disabled={salvando || !!editandoId} /> <span>Já emitido</span></label>
                        </div>
                        {form.emitido && (
                          <div className="fm-custo-campo">
                            <label>Valor do documento <b>*</b></label>
                            <CampoMoeda value={form.valorDoc} onChange={(e) => campo("valorDoc", e.target.value)} placeholder="0,00" required disabled={salvando} />
                          </div>
                        )}
                      </div>
                    </section>
                  </div>

                  <div className="fm-custo-modal-rodape">
                    <button type="button" className="botao discreto" onClick={fecharFormulario} disabled={salvando}>Cancelar</button>
                    <button type="submit" className="botao" disabled={salvando}>{salvando ? "Salvando…" : editandoId ? "Salvar alterações" : "Salvar Recibo"}</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}

      {tipo === "recibo" && emitindo && (
        <div className="cartao" style={{ marginBottom: 20, borderColor: "var(--primaria)" }}>
          <div className="cartao-corpo">
            <h2 style={{ margin: "0 0 4px", fontSize: 15 }}>Emitir {cfg.titulo}</h2>
            <p style={{ margin: "0 0 16px", fontSize: 12, color: "var(--texto-2)" }}>
              {rotuloDe(emitindo)} · previsto {real(emitindo.valorPrevisto)}
            </p>
            <form onSubmit={emitir}>
              <div className="grade-form">
                <div>
                  <label className="rotulo">Data de emissão</label>
                  <div className="campo" style={{ marginBottom: 0 }}>
                    <input type="date" value={dataEmissao} onChange={(e) => setDataEmissao(e.target.value)}
                      required disabled={salvando} style={{ colorScheme: "dark" }} />
                  </div>
                </div>
                <div>
                  <label className="rotulo">Valor</label>
                  <div className="campo" style={{ marginBottom: 0 }}>
                    <CampoMoeda value={valorEmissao} onChange={(e) => setValorEmissao(e.target.value)}
                      placeholder="0,00" required disabled={salvando} />
                  </div>
                </div>
                <div className="largo" style={{ display: "flex", gap: 8 }}>
                  <button type="submit" className="botao" disabled={salvando}>Confirmar emissão</button>
                  <button type="button" className="botao discreto" onClick={() => setEmitindo(null)}>Cancelar</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className={`fm-filtros-operacionais ${tipo === "nota" ? "fm-filtros-notas" : "fm-filtros-recibos"}`}>
        <div className="fm-busca-operacional">
          <span aria-hidden="true">⌕</span>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={tipo === "nota" ? "Buscar por número da NF ou cliente..." : "Buscar por recibo, descrição ou cliente..."}
            aria-label={tipo === "nota" ? "Buscar notas fiscais" : "Buscar recibos"}
          />
        </div>
        <select value={clienteFiltro} onChange={(e) => setClienteFiltro(e.target.value)} aria-label="Filtrar por cliente">
          <option value="">Todos os clientes</option>
          {clientesNotas.map((nome) => <option key={nome} value={nome}>{nome}</option>)}
        </select>
        <select value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Filtrar por situação">
          <option value="Todos">Todos os status</option>
          {tipo === "nota" ? (
            <>
              <option value="PREVISTA">Prevista</option>
              <option value="EMITIDA">Emitida</option>
              <option value="PARCIALMENTE RECEBIDA">Parcialmente recebida</option>
              <option value="RECEBIDA">Recebida</option>
            </>
          ) : (
            <>
              <option value="PREVISTO">Previsto</option>
              <option value="EMITIDO">Emitido</option>
              <option value="PARCIALMENTE RECEBIDO">Parcialmente recebido</option>
              <option value="RECEBIDO">Recebido</option>
            </>
          )}
        </select>
        <button type="button" className="fm-limpar-filtros" onClick={() => { setBusca(""); setClienteFiltro(""); setFiltro("Todos"); }}>× Limpar</button>
      </div>

      <div className="cartao tabela-rolagem">
        <table>
          <thead>
            <tr>
              <th>{cfg.rotuloDoc}</th><th>Cliente</th><th>Medição</th><th>Data de emissão</th>
              <th style={{ textAlign: "right" }}>Faturado</th>
              <th style={{ textAlign: "right" }}>Recebido</th>
              <th style={{ textAlign: "right" }}>A receber</th>
              <th>Previsão</th><th>Situação</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((d) => (
              <tr key={d.id}>
                <td>
                  <strong>{rotuloDe(d)}</strong>
                  {d.descricao && <><br /><small style={{ color: "var(--texto-3)" }}>{d.descricao}</small></>}
                </td>
                <td>{d.cliente}</td>
                <td>{d.medicao ?? "—"}</td>
                <td>{dataBR(d.dataEmissao)}</td>
                <td style={{ textAlign: "right" }}>
                  {foiEmitido(d) ? real(faturadoDe(d)) : <span style={{ color: "var(--texto-3)" }}>—</span>}
                </td>
                <td style={{ textAlign: "right", color: "var(--sucesso)" }}>{real(d.recebido)}</td>
                <td style={{ textAlign: "right", color: d.saldo > 0 ? "var(--ambar)" : "var(--texto-3)" }}>
                  {foiEmitido(d) ? real(d.saldo) : "—"}
                </td>
                <td>{dataBR(d.previsaoRecebimento)}</td>
                <td><span className={`selo ${classeSelo(d.situacao)}`}>{d.situacao}</span></td>
                <td>
                  <div className="acoes-linha">
                    <button type="button" className="botao discreto mini" onClick={() => setVisualizando(d)}>
                      Visualizar
                    </button>
                    {!somenteLeitura && (tipo === "nota" || !d.substituidoPor) && (
                      <button
                        type="button"
                        className="botao discreto mini"
                        onClick={() => abrirEdicao(d)}
                      >
                        Editar
                      </button>
                    )}
                    {!somenteLeitura && tipo === "recibo" && !foiEmitido(d) && (
                      <button type="button" className="botao discreto mini"
                        onClick={() => { setEmitindo(d); setValorEmissao(String(d.valorPrevisto).replace(".", ",")); }}>
                        Emitir
                      </button>
                    )}
                    {tipo === "recibo" && foiEmitido(d) && (
                      <button type="button" className="botao discreto mini" onClick={() => window.open(`/recibos/${d.id}/imprimir`, "_blank", "noopener,noreferrer")}>
                        PDF
                      </button>
                    )}
                    {!somenteLeitura && foiEmitido(d) && !d.substituidoPor && (
                      <button type="button" className="botao discreto mini" onClick={() => setRecebendo(d)}>
                        {d.temMovimento ? "Recebimentos" : "Receber"}
                      </button>
                    )}
                    {!somenteLeitura && tipo === "recibo" && foiEmitido(d) && !d.temMovimento && !d.substituidoPor && (
                      <button type="button" className="botao discreto mini" onClick={() => abrirSubstituicao(d)}>
                        Substituir
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!carregando && visiveis.length === 0 && (
              <tr><td colSpan={10}><div className="vazio">Nenhum documento encontrado.</div></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {visualizando && (
        <div style={{ position:"fixed", inset:0, zIndex:300, background:"rgba(2,12,22,.72)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={() => setVisualizando(null)}>
          <div className="cartao" style={{ width:"min(760px,100%)", maxHeight:"90vh", overflowY:"auto" }} onClick={(e) => e.stopPropagation()}>
            <div className="cartao-corpo">
              <div style={{ display:"flex", justifyContent:"space-between", gap:16, marginBottom:20 }}>
                <div>
                  <h2 style={{ margin:0, fontSize:17 }}>Detalhes do {cfg.titulo}</h2>
                  <p style={{ margin:"5px 0 0", color:"var(--texto-3)", fontSize:12 }}>{rotuloDe(visualizando)} · Visualização somente leitura</p>
                </div>
                <button type="button" className="botao discreto mini" onClick={() => setVisualizando(null)}>×</button>
              </div>
              <div className="grade-form">
                <div><label className="rotulo">Cliente</label><div className="campo">{visualizando.cliente}</div></div>
                <div><label className="rotulo">Medição</label><div className="campo">{visualizando.medicao ?? "—"}</div></div>
                <div><label className="rotulo">Data de emissão</label><div className="campo">{visualizando.dataEmissao ? dataBR(visualizando.dataEmissao) : "—"}</div></div>
                <div><label className="rotulo">Valor previsto</label><div className="campo">{real(visualizando.valorPrevisto)}</div></div>
                <div><label className="rotulo">Faturado</label><div className="campo">{foiEmitido(visualizando) ? real(faturadoDe(visualizando)) : "—"}</div></div>
                <div><label className="rotulo">Recebido</label><div className="campo">{real(visualizando.recebido)}</div></div>
                <div><label className="rotulo">A receber</label><div className="campo">{foiEmitido(visualizando) ? real(visualizando.saldo) : "—"}</div></div>
                <div><label className="rotulo">Previsão de recebimento</label><div className="campo">{visualizando.previsaoRecebimento ? dataBR(visualizando.previsaoRecebimento) : "—"}</div></div>
                <div><label className="rotulo">Situação</label><div className="campo"><span className={`selo ${classeSelo(visualizando.situacao)}`}>{visualizando.situacao}</span></div></div>
                {tipo === "recibo" && visualizando.descricao && (
                  <div className="largo"><label className="rotulo">Descrição</label><div className="campo" style={{ minHeight:70, whiteSpace:"pre-wrap", alignItems:"flex-start" }}>{visualizando.descricao}</div></div>
                )}
              </div>
              <div style={{ marginTop: 20 }}>
                <label className="rotulo">Anexo (PDF, JPEG ou PNG)</label>
                <AnexoPdf tipo={tipo} id={visualizando.id} anexoInicial={visualizando.anexo} somenteLeitura={somenteLeitura} />
              </div>
            </div>
          </div>
        </div>
      )}

      {excluindo && (
        <div style={{ position:"fixed", inset:0, zIndex:310, background:"rgba(2,12,22,.72)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={() => !salvando && setExcluindo(null)}>
          <div className="cartao" style={{ width:"min(520px,100%)" }} onClick={(e) => e.stopPropagation()}>
            <div className="cartao-corpo">
              <h2 style={{ margin:"0 0 8px", fontSize:17 }}>Excluir {cfg.titulo}</h2>
              <p style={{ margin:"0 0 20px", color:"var(--texto-2)", lineHeight:1.6 }}>
                Deseja excluir <strong>{rotuloDe(excluindo)}</strong>? Esta ação só é permitida antes da emissão.
              </p>
              <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
                <button type="button" className="botao discreto" disabled={salvando} onClick={() => setExcluindo(null)}>Cancelar</button>
                <button type="button" className="botao perigoso" disabled={salvando} onClick={excluirDocumento}>
                  {salvando ? "Excluindo..." : "Excluir"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {substituindo && (
        <div
          style={{ position:"fixed", inset:0, zIndex:320, background:"rgba(2,12,22,.72)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}
          onMouseDown={(e) => { if (e.target === e.currentTarget && !salvando) setSubstituindo(null); }}
        >
          <div className="cartao" style={{ width:"min(680px,100%)", maxHeight:"90vh", overflow:"auto" }} onClick={(e) => e.stopPropagation()}>
            <div className="cartao-corpo">
              <h2 style={{ margin:"0 0 8px", fontSize:17 }}>Substituir recibo</h2>

              <p style={{ margin:"0 0 18px", color:"var(--texto-2)", lineHeight:1.6 }}>
                O recibo <strong>{substituindo.identificador}</strong> permanecerá no histórico.
                A nova versão receberá a identificação de substituição automaticamente.
              </p>
              {erro && <div className="aviso erro-aviso" style={{ marginBottom:16 }}>{erro}</div>}

              <form onSubmit={substituirRecibo}>
                <div className="grade-form">
                  <div className="largo">
                    <label className="rotulo">Motivo da substituição</label>
                    <div className="campo" style={{ marginBottom:0 }}>
                      <textarea
                        value={formSubstituicao.motivo}
                        onChange={(e) => setFormSubstituicao((x) => ({ ...x, motivo:e.target.value }))}
                        required
                        minLength={5}
                        disabled={salvando}
                        style={{ width:"100%", minHeight:80, resize:"vertical" }}
                      />
                    </div>
                  </div>

                  <div className="largo">
                    <label className="rotulo">Descrição</label>
                    <div className="campo" style={{ marginBottom:0 }}>
                      <input
                        value={formSubstituicao.descricao}
                        onChange={(e) => setFormSubstituicao((x) => ({ ...x, descricao:e.target.value }))}
                        required
                        disabled={salvando}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="rotulo">Data de emissão</label>
                    <div className="campo" style={{ marginBottom:0 }}>
                      <input
                        type="date"
                        value={formSubstituicao.dataEmissao}
                        onChange={(e) => setFormSubstituicao((x) => ({ ...x, dataEmissao:e.target.value }))}
                        required
                        disabled={salvando}
                        style={{ colorScheme:"dark" }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="rotulo">Valor do recibo</label>
                    <div className="campo" style={{ marginBottom:0 }}>
                      <CampoMoeda
                        value={formSubstituicao.valorRecibo}
                        onChange={(e) => setFormSubstituicao((x) => ({ ...x, valorRecibo:e.target.value }))}
                        required
                        disabled={salvando || Boolean(substituindo.medicao)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="rotulo">Previsão de recebimento</label>
                    <div className="campo" style={{ marginBottom:0 }}>
                      <input
                        type="date"
                        value={formSubstituicao.previsaoRecebimento}
                        onChange={(e) => setFormSubstituicao((x) => ({ ...x, previsaoRecebimento:e.target.value }))}
                        disabled={salvando || Boolean(substituindo.medicao)}
                        style={{ colorScheme:"dark" }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginTop:20 }}>
                  <button type="button" className="botao discreto" disabled={salvando} onClick={() => setSubstituindo(null)}>
                    Cancelar
                  </button>
                  <button type="submit" className="botao" disabled={salvando}>
                    {salvando ? "Substituindo..." : "Criar substituição"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {recebendo && (
        <PainelEventos
          rota={`${cfg.rota}/${recebendo.id}/${cfg.eventos}`}
          titulo="Recebimentos"
          documento={`${rotuloDe(recebendo)} · ${recebendo.cliente}`}
          previsto={foiEmitido(recebendo) ? faturadoDe(recebendo) : recebendo.valorPrevisto}
          rotuloAcao="Registrar recebimento"
          somenteLeitura={somenteLeitura}
          aoMudar={() => { carregar(); router.refresh(); }}
          aoFechar={() => setRecebendo(null)}
        />
      )}
    </>
  );
}


