"use client";

import CampoMoeda from "@/components/CampoMoeda";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { real, dataBR, compBR, hojeISO, competenciaHoje, paraNumero, classeSelo } from "@/lib/ui";
import SelectPadrao from "@/components/SelectPadrao";

interface Cliente { id: string; nomeFantasia: string }

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

interface Medicao {
  id: string; cliente: string; clienteId: string; identificador: string; competencia: string;
  periodoInicio: string; periodoFim: string; descricaoServicos: string | null;
  valorPrevisto: number; valorMedido: number | null; dataMedicao: string | null;
  previsaoRecebimento: string | null; status: string; diferenca: number;
  aFaturar: number; documentos: { tipo: string; rotulo: string }[]; temDocumento: boolean;
}

export default function GerenciarMedicoes({
  clientes, medicoesIniciais, somenteLeitura,
}: { clientes: Cliente[]; medicoesIniciais: Medicao[]; somenteLeitura: boolean }) {
  const router = useRouter();
  const [medicoes, setMedicoes] = useState<Medicao[]>(medicoesIniciais);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [formAberto, setFormAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("Todos");
  const [competenciaFiltro, setCompetenciaFiltro] = useState(competenciaHoje());
  const [clienteFiltro, setClienteFiltro] = useState("");

  const [form, setForm] = useState({
    clienteId: "", identificador: "", competencia: competenciaHoje(),
    periodoInicio: "", periodoFim: "", descricaoServicos: "", valorPrevisto: "",
    previsaoRecebimento: "", medirAgora: false, valorMedido: "", dataMedicao: hojeISO(),
  });

  const [medindo, setMedindo] = useState<Medicao | null>(null);
  const [visualizando, setVisualizando] = useState<Medicao | null>(null);
  const [excluindo, setExcluindo] = useState<Medicao | null>(null);
  const [valorMedicao, setValorMedicao] = useState("");
  const [dataMedicao, setDataMedicao] = useState(hojeISO());

  async function carregar() {
    setCarregando(true);
    const r = await fetch("/api/medicoes");
    if (r.ok) setMedicoes((await r.json()).medicoes);
    setCarregando(false);
  }

  const campo = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  function abrirNovaMedicao() {
    setErro(null);
    setEditandoId(null);
    setForm({
      clienteId: "",
      identificador: "",
      competencia: competenciaHoje(),
      periodoInicio: "",
      periodoFim: "",
      descricaoServicos: "",
      valorPrevisto: "",
      previsaoRecebimento: "",
      medirAgora: false,
      valorMedido: "",
      dataMedicao: hojeISO(),
    });
    setFormAberto(true);
  }

  function abrirEdicao(m: Medicao) {
    setErro(null);

    setEditandoId(m.id);
    setForm({
      clienteId: m.clienteId,
      identificador: m.identificador,
      competencia: m.competencia,
      periodoInicio: m.periodoInicio,
      periodoFim: m.periodoFim,
      descricaoServicos: m.descricaoServicos ?? "",
      valorPrevisto: String(m.valorPrevisto).replace(".", ","),
      previsaoRecebimento: m.previsaoRecebimento ?? "",
      medirAgora: m.status === "MEDIDA",
      valorMedido: m.valorMedido !== null ? String(m.valorMedido).replace(".", ",") : "",
      dataMedicao: m.dataMedicao ?? hojeISO(),
    });
    setFormAberto(true);
  }

  function fecharFormulario() {
    if (salvando) return;
    setFormAberto(false);
    setEditandoId(null);
  }

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      const editando = !!editandoId;
      const r = await fetch("/api/medicoes", {
        method: editando ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editando ? { id: editandoId, acao: "editar" } : {}),
          clienteId: form.clienteId,
          identificador: form.identificador,
          competencia: form.competencia,
          periodoInicio: form.periodoInicio,
          periodoFim: form.periodoFim,
          descricaoServicos: form.descricaoServicos,
          valorPrevisto: paraNumero(form.valorPrevisto),
          previsaoRecebimento: form.previsaoRecebimento || null,
          ...(!editando ? { medirAgora: form.medirAgora } : {}),
          valorMedido: form.medirAgora ? paraNumero(form.valorMedido) : null,
          dataMedicao: form.medirAgora ? form.dataMedicao : null,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        setErro(d.erro ?? "Não foi possível salvar a medição.");
        return;
      }

      setEditandoId(null);
      setFormAberto(false);
      setForm((f) => ({
        ...f,
        identificador: "",
        descricaoServicos: "",
        valorPrevisto: "",
        valorMedido: "",
        medirAgora: false,
      }));
      await carregar();
      router.refresh();
    } finally {
      setSalvando(false);
    }
  }
  async function registrarMedicao(e: React.FormEvent) {
    e.preventDefault();
    if (!medindo) return;
    setErro(null); setSalvando(true);
    try {
      const r = await fetch("/api/medicoes", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: medindo.id, valorMedido: paraNumero(valorMedicao), dataMedicao }),
      });
      const d = await r.json();
      if (!r.ok) { setErro(d.erro); return; }
      setMedindo(null); setValorMedicao("");
      await carregar(); router.refresh();
    } finally { setSalvando(false); }
  }


  async function excluirMedicao() {
    if (!excluindo) return;
    setSalvando(true);
    setErro(null);
    try {
      const r = await fetch("/api/medicoes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: excluindo.id }),
      });
      const d = await r.json();
      if (!r.ok) {
        setErro(d.erro ?? "Não foi possível excluir a medição.");
        return;
      }
      setExcluindo(null);
      await carregar();
      router.refresh();
    } finally {
      setSalvando(false);
    }
  }
  const visiveis = medicoes.filter((m) => {
    const texto = `${m.identificador} ${m.cliente}`.toLowerCase();
    if (competenciaFiltro && m.competencia !== competenciaFiltro) return false;
    if (busca && !texto.includes(busca.toLowerCase())) return false;
    if (clienteFiltro && m.cliente !== clienteFiltro) return false;
    if (filtroStatus !== "Todos" && m.status !== filtroStatus) return false;
    return true;
  });

  const totais = visiveis.reduce(
    (t, m) => ({ previsto: t.previsto + m.valorPrevisto, medido: t.medido + (m.valorMedido ?? 0), aFaturar: t.aFaturar + m.aFaturar }),
    { previsto: 0, medido: 0, aFaturar: 0 }
  );

  const anos = Array.from(new Set([new Date().getFullYear(), ...medicoes.map((m) => Number(m.competencia.slice(0, 4)))]))
    .filter(Number.isFinite)
    .sort((a, b) => b - a);
  const [anoFiltro, mesFiltro] = competenciaFiltro.split("-");
  const nomesClientes = Array.from(new Set(medicoes.map((m) => m.cliente))).sort((a, b) => a.localeCompare(b, "pt-BR"));

  return (
    <>
      {erro && <div className="aviso erro-aviso">{erro}</div>}

      <div className="fm-custos-toolbar">
        <div className="fm-competencia-controle" aria-label="Competência exibida">
          <span className="fm-competencia-icone" aria-hidden="true">▣</span>
          <span className="fm-competencia-label">Competência</span>
          <div className="fm-competencia-select fm-competencia-mes">
            <SelectPadrao
              value={mesFiltro}
              onChange={(v) => setCompetenciaFiltro(`${anoFiltro}-${v}`)}
              options={MESES.map((m, i) => ({ value: String(i + 1).padStart(2, "0"), label: m }))}
              ariaLabel="Mês da competência"
            />
          </div>
          <span className="fm-competencia-separador">/</span>
          <div className="fm-competencia-select fm-competencia-ano">
            <SelectPadrao
              value={anoFiltro}
              onChange={(v) => setCompetenciaFiltro(`${v}-${mesFiltro}`)}
              options={anos.map((a) => ({ value: String(a), label: String(a) }))}
              ariaLabel="Ano da competência"
            />
          </div>
        </div>

        {!somenteLeitura && (
          <button type="button" className="botao fm-botao-novo" onClick={abrirNovaMedicao}>+ Nova Medição</button>
        )}
      </div>

      <div className="fm-modulo-resumo">
        <div className="fm-kpi-compacto"><span>Previsto no mês</span><strong>{real(totais.previsto)}</strong></div>
        <div className="fm-kpi-compacto fm-kpi-sucesso"><span>Valor medido</span><strong>{real(totais.medido)}</strong></div>
        <div className="fm-kpi-compacto fm-kpi-ambar"><span>A medir</span><strong>{real(Math.max(0, totais.previsto - totais.medido))}</strong></div>
        <div className="fm-kpi-compacto fm-kpi-roxo"><span>A faturar</span><strong>{real(totais.aFaturar)}</strong></div>
      </div>

      <div className="fm-legenda-custos" aria-label="Legenda das medições">
        <span className="fm-legenda-titulo">Legenda</span>
        <span><i className="fm-dot fm-dot-previsto" />Previsto</span>
        <span><i className="fm-dot fm-dot-realizado" />Medido</span>
        <span><i className="fm-dot fm-dot-pendente" />A medir</span>
        <span><i className="fm-dot fm-dot-diferenca" />A faturar</span>
      </div>

      {!somenteLeitura && formAberto && (
        <div
          className="fm-custo-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={editandoId ? "Editar medição" : "Nova medição"}
          onMouseDown={(e) => { if (e.target === e.currentTarget) fecharFormulario(); }}
        >
          <div className="fm-custo-modal fm-medicao-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="fm-custo-modal-cabecalho">
              <h2>{editandoId ? "Editar · Medição" : "Nova · Medição"}</h2>
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
                        onChange={(valor) => campo("clienteId", valor)}
                        disabled={salvando}
                        placeholder="Selecione..."
                        options={clientes.map((c) => ({ value: c.id, label: c.nomeFantasia }))}
                        ariaLabel="Cliente da medição"
                      />
                    </div>
                    <div className="fm-custo-campo">
                      <label>Identificador <b>*</b></label>
                      <input value={form.identificador} onChange={(e) => campo("identificador", e.target.value)} placeholder="Ex.: MED-2026-01" required disabled={salvando} />
                    </div>
                    <div className="fm-custo-campo">
                      <label>Competência <b>*</b></label>
                      <input type="month" value={form.competencia} onChange={(e) => campo("competencia", e.target.value)} required disabled={salvando} style={{ colorScheme: "dark" }} />
                    </div>
                    <div className="fm-custo-campo">
                      <label>Valor previsto <b>*</b></label>
                      <CampoMoeda value={form.valorPrevisto} onChange={(e) => campo("valorPrevisto", e.target.value)} placeholder="0,00" required disabled={salvando} />
                    </div>
                  </div>
                </section>

                <section className="fm-custo-secao">
                  <div className="fm-custo-secao-titulo">Período da Medição</div>
                  <div className="fm-custo-grid">
                    <div className="fm-custo-campo">
                      <label>Período inicial <b>*</b></label>
                      <input type="date" value={form.periodoInicio} onChange={(e) => campo("periodoInicio", e.target.value)} required disabled={salvando} style={{ colorScheme: "dark" }} />
                    </div>
                    <div className="fm-custo-campo">
                      <label>Período final <b>*</b></label>
                      <input type="date" value={form.periodoFim} onChange={(e) => campo("periodoFim", e.target.value)} required disabled={salvando} style={{ colorScheme: "dark" }} />
                    </div>
                  </div>
                </section>

                <section className="fm-custo-secao">
                  <div className="fm-custo-secao-titulo">Previsão Financeira</div>
                  <div className="fm-custo-grid">
                    <div className="fm-custo-campo">
                      <label>Previsão de recebimento</label>
                      <input type="date" value={form.previsaoRecebimento} onChange={(e) => campo("previsaoRecebimento", e.target.value)} disabled={salvando} style={{ colorScheme: "dark" }} />
                    </div>
                    <div className="fm-medicao-check">
                      <label>
                        <input type="checkbox" checked={form.medirAgora} onChange={(e) => campo("medirAgora", e.target.checked)} disabled={salvando} />
                        <span>Já registrar a medição</span>
                      </label>
                    </div>
                    {form.medirAgora && (
                      <>
                        <div className="fm-custo-campo">
                          <label>Valor medido <b>*</b></label>
                          <CampoMoeda value={form.valorMedido} onChange={(e) => campo("valorMedido", e.target.value)} placeholder="0,00" required disabled={salvando} />
                        </div>
                        <div className="fm-custo-campo">
                          <label>Data da medição <b>*</b></label>
                          <input type="date" value={form.dataMedicao} onChange={(e) => campo("dataMedicao", e.target.value)} required disabled={salvando} style={{ colorScheme: "dark" }} />
                        </div>
                      </>
                    )}
                  </div>
                </section>

                <section className="fm-custo-secao fm-custo-secao-previsao">
                  <div className="fm-custo-secao-titulo">Informações Complementares</div>
                  <div className="fm-custo-campo">
                    <label>Descrição dos serviços executados <b>*</b></label>
                    <textarea
                      className="fm-medicao-textarea"
                      value={form.descricaoServicos}
                      onChange={(e) => campo("descricaoServicos", e.target.value)}
                      placeholder="Descreva os serviços executados que justificam o valor da medição."
                      required
                      disabled={salvando}
                      rows={4}
                    />
                  </div>
                </section>
              </div>

              <div className="fm-custo-modal-rodape">
                <button type="button" className="botao discreto" onClick={fecharFormulario} disabled={salvando}>Cancelar</button>
                <button type="submit" className="botao" disabled={salvando}>{salvando ? "Salvando…" : editandoId ? "Salvar alterações" : "Salvar Medição"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {excluindo && (
        <div style={{ position:"fixed", inset:0, zIndex:310, background:"rgba(2,12,22,.72)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={() => !salvando && setExcluindo(null)}>
          <div className="cartao" style={{ width:"min(520px, 100%)" }} onClick={(e) => e.stopPropagation()}>
            <div className="cartao-corpo">
              <h2 style={{ margin:"0 0 8px", fontSize:17 }}>Excluir medição</h2>
              <p style={{ margin:"0 0 20px", color:"var(--texto-2)", lineHeight:1.6 }}>
                Deseja excluir a medição <strong>{excluindo.identificador}</strong>?
                Esta ação só é permitida porque ela ainda não foi medida.
              </p>
              <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
                <button type="button" className="botao discreto" disabled={salvando} onClick={() => setExcluindo(null)}>Cancelar</button>
                <button type="button" className="botao perigoso" disabled={salvando} onClick={excluirMedicao}>
                  {salvando ? "Excluindo..." : "Excluir medição"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {visualizando && (
        <div style={{ position:"fixed", inset:0, zIndex:300, background:"rgba(2,12,22,.72)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={() => setVisualizando(null)}>
          <div className="cartao" style={{ width:"min(760px, 100%)", maxHeight:"90vh", overflowY:"auto" }} onClick={(e) => e.stopPropagation()}>
            <div className="cartao-corpo">
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:16, marginBottom:20 }}>
                <div>
                  <h2 style={{ margin:0, fontSize:17 }}>Detalhes da medição</h2>
                  <p style={{ margin:"5px 0 0", color:"var(--texto-3)", fontSize:12 }}>{visualizando.identificador} · Visualização somente leitura</p>
                </div>
                <button type="button" className="botao discreto mini" onClick={() => setVisualizando(null)} aria-label="Fechar">×</button>
              </div>
              <div className="grade-form">
                <div><label className="rotulo">Cliente</label><div className="campo">{visualizando.cliente}</div></div>
                <div><label className="rotulo">Competência</label><div className="campo">{compBR(visualizando.competencia)}</div></div>
                <div><label className="rotulo">Período inicial</label><div className="campo">{dataBR(visualizando.periodoInicio)}</div></div>
                <div><label className="rotulo">Período final</label><div className="campo">{dataBR(visualizando.periodoFim)}</div></div>
                <div><label className="rotulo">Valor previsto</label><div className="campo">{real(visualizando.valorPrevisto)}</div></div>
                <div><label className="rotulo">Valor medido</label><div className="campo">{visualizando.valorMedido !== null ? real(visualizando.valorMedido) : "—"}</div></div>
                <div><label className="rotulo">Data da medição</label><div className="campo">{visualizando.dataMedicao ? dataBR(visualizando.dataMedicao) : "—"}</div></div>
                <div><label className="rotulo">Previsão de recebimento</label><div className="campo">{visualizando.previsaoRecebimento ? dataBR(visualizando.previsaoRecebimento) : "—"}</div></div>
                <div><label className="rotulo">Status</label><div className="campo"><span className={`selo ${classeSelo(visualizando.status)}`}>{visualizando.status === "A_MEDIR" ? "A MEDIR" : "MEDIDA"}</span></div></div>
                <div className="largo"><label className="rotulo">Descrição dos serviços executados</label><div className="campo" style={{ minHeight:90, whiteSpace:"pre-wrap", alignItems:"flex-start" }}>{visualizando.descricaoServicos || "—"}</div></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {medindo && (
        <div className="cartao" style={{ marginBottom: 20, borderColor: "var(--primaria)" }}>
          <div className="cartao-corpo">
            <h2 style={{ margin: "0 0 4px", fontSize: 15 }}>Registrar medição</h2>
            <p style={{ margin: "0 0 16px", fontSize: 12, color: "var(--texto-2)" }}>
              {medindo.identificador} · previsto {real(medindo.valorPrevisto)}
            </p>
            <form onSubmit={registrarMedicao}>
              <div className="grade-form">
                <div>
                  <label className="rotulo">Valor medido</label>
                  <div className="campo" style={{ marginBottom: 0 }}>
                    <CampoMoeda value={valorMedicao} onChange={(e) => setValorMedicao(e.target.value)}
                      placeholder="0,00" required disabled={salvando} />
                  </div>
                </div>
                <div>
                  <label className="rotulo">Data</label>
                  <div className="campo" style={{ marginBottom: 0 }}>
                    <input type="date" value={dataMedicao} onChange={(e) => setDataMedicao(e.target.value)}
                      required disabled={salvando} style={{ colorScheme: "dark" }} />
                  </div>
                </div>
                <div className="largo" style={{ display: "flex", gap: 8 }}>
                  <button type="submit" className="botao" disabled={salvando}>Confirmar</button>
                  <button type="button" className="botao discreto" onClick={() => setMedindo(null)}>Cancelar</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="fm-filtros-operacionais fm-filtros-medicoes">
        <div className="fm-busca-operacional">
          <span aria-hidden="true">⌕</span>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por identificador ou cliente..." aria-label="Buscar medições" />
        </div>
        <select value={clienteFiltro} onChange={(e) => setClienteFiltro(e.target.value)} aria-label="Filtrar por cliente">
          <option value="">Todos os clientes</option>
          {nomesClientes.map((nome) => <option key={nome} value={nome}>{nome}</option>)}
        </select>
        <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} aria-label="Filtrar por status">
          <option value="Todos">Todos os status</option>
          <option value="A_MEDIR">A medir</option>
          <option value="MEDIDA">Medidas</option>
        </select>
        <button type="button" className="fm-limpar-filtros" onClick={() => { setBusca(""); setClienteFiltro(""); setFiltroStatus("Todos"); }}>× Limpar</button>
      </div>

      <div className="cartao tabela-rolagem">
        <table>
          <thead>
            <tr>
              <th>Identificador</th><th>Cliente</th><th>Competência</th><th>Período</th>
              <th style={{ textAlign: "right" }}>Previsto</th>
              <th style={{ textAlign: "right" }}>Medido</th>
              <th style={{ textAlign: "right" }}>A faturar</th>
              <th>Documentos</th><th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((m) => (
              <tr key={m.id}>
                <td><strong>{m.identificador}</strong></td>
                <td>{m.cliente}</td>
                <td>{compBR(m.competencia)}</td>
                <td style={{ fontSize: 12 }}>{dataBR(m.periodoInicio)} a {dataBR(m.periodoFim)}</td>
                <td style={{ textAlign: "right" }}>{real(m.valorPrevisto)}</td>
                <td style={{ textAlign: "right" }}>{m.valorMedido !== null ? real(m.valorMedido) : "—"}</td>
                <td style={{ textAlign: "right", color: m.aFaturar > 0 ? "var(--ambar)" : "var(--texto-3)" }}>
                  {m.valorMedido !== null ? real(m.aFaturar) : "—"}
                </td>
                <td style={{ fontSize: 12 }}>
                  {m.documentos.length ? m.documentos.map((d) => d.rotulo).join(", ") : "—"}
                </td>
                <td><span className={`selo ${classeSelo(m.status)}`}>{m.status === "A_MEDIR" ? "A MEDIR" : "MEDIDA"}</span></td>
                {!somenteLeitura && (
                  <td>
                  <div className="acoes-linha">
                    <button type="button" className="botao discreto mini" style={{ width:34, minWidth:34, padding:0 }} onClick={() => setVisualizando(m)} title="Visualizar medição" aria-label="Visualizar medição">
                      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.8"/></svg>
                    </button>
                    <button
                      type="button"
                      className="botao discreto mini"
                      onClick={() => abrirEdicao(m)}
                      title="Editar medição"
                    >
                      Editar
                    </button>
                    {!somenteLeitura && m.status === "A_MEDIR" && (
                      <><button type="button" className="botao discreto mini"
                        onClick={() => { setMedindo(m); setValorMedicao(String(m.valorPrevisto).replace(".", ",")); }}>
                        Medir
                      </button>
                      <button type="button" className="botao perigoso mini" title="Excluir medição" onClick={() => setExcluindo(m)}>Excluir</button>
                    </>
                    )}
                  </div>
                </td>
                )}
              </tr>
            ))}
            {!carregando && visiveis.length === 0 && (
              <tr><td colSpan={10}><div className="vazio">Nenhuma medição encontrada.</div></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}









