"use client";

import CampoMoeda from "@/components/CampoMoeda";

import { TIPOS_CUSTO, TIPO_CUSTO_PADRAO } from "@/lib/financeiro/constantes";
import SelectPadrao from "@/components/SelectPadrao";
import { paraNumero, competenciaHoje } from "@/lib/ui";
import PainelEventos from "@/components/PainelEventos";
import GraficoCustosMensal from "@/components/GraficoCustosMensal";
import AnexoPdf from "@/components/AnexoPdf";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Categoria { id: string; nome: string; tipo: string }

interface Custo {
  id: string; descricao: string; tipo: string; categoria: string | null; categoriaId: string | null;
  competencia: string; vencimento: string;
  previsto: number; pago: number; saldo: number;
  situacao: string; temMovimento: boolean;
  anexo: { nomeArquivo: string; tamanhoBytes: number } | null;
}

const real = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
const dataBR = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? d.split("-").reverse().join("/") : "—");
const compBR = (c: string) => (/^\d{4}-\d{2}$/.test(c) ? `${c.slice(5)}/${c.slice(0, 4)}` : "—");

const SELO: Record<string, string> = { PAGO: "ok", PARCIAL: "espera", PREVISTO: "off" };

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default function GerenciarCustos({
  categorias, custosIniciais, somenteLeitura,
}: { categorias: Categoria[]; custosIniciais: Custo[]; somenteLeitura: boolean }) {
  const router = useRouter();
  const [custos, setCustos] = useState<Custo[]>(custosIniciais);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // formulário de custo
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState<string>(TIPO_CUSTO_PADRAO);
  const [categoriaId, setCategoriaId] = useState("");
  const [competencia, setCompetencia] = useState(() => competenciaHoje());
  const [vencimento, setVencimento] = useState("");
  const [valor, setValor] = useState("");
  const [recorrente, setRecorrente] = useState(false);
  const [mesesRecorrencia, setMesesRecorrencia] = useState("12");
  const [salvando, setSalvando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [formAberto, setFormAberto] = useState(false);

  // Controles de visualização: filtram apenas a lista exibida no cliente.
  // Não alteram cálculos persistidos, APIs ou regras financeiras.
  const hoje = competenciaHoje();
  const [competenciaFiltro, setCompetenciaFiltro] = useState(hoje);
  const [busca, setBusca] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("");
  const [menuAcoesId, setMenuAcoesId] = useState<string | null>(null);

  // Pagamentos e estornos ficam no mesmo painel que serve Notas e Recibos:
  // a mecanica e identica, e duas telas diferentes para a mesma regra e o
  // caminho mais curto para as duas divergirem.
  const [pagamentosDe, setPagamentosDe] = useState<Custo | null>(null);
  const [excluindo, setExcluindo] = useState<Custo | null>(null);
  const [visualizando, setVisualizando] = useState<Custo | null>(null);

  async function carregar() {
    setCarregando(true);
    const r = await fetch("/api/custos");
    if (r.ok) setCustos((await r.json()).custos);
    setCarregando(false);
  }


  function limparFormulario() {
    setDescricao("");
    setTipo(TIPO_CUSTO_PADRAO);
    setCategoriaId("");
    setCompetencia(competenciaHoje());
    setVencimento("");
    setValor("");
    setRecorrente(false);
    setMesesRecorrencia("12");
    setEditandoId(null);
  }

  function iniciarEdicao(c: Custo) {
    setErro(null);

    if (c.pago > 0) {
      setErro(
        "Este custo possui pagamento registrado. Estorne o pagamento antes de editar."
      );
      return;
    }

    setEditandoId(c.id);
    setDescricao(c.descricao);
    setTipo(c.tipo);
    setCategoriaId(c.categoriaId ?? "");
    setCompetencia(c.competencia);
    setVencimento(c.vencimento);
    setValor(String(c.previsto).replace(".", ","));

    setFormAberto(true);
  }
  async function criar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);

    // "8.000,00" com Number() vira NaN, e "8.000" vira 8 — mil vezes menos,
    // sem aviso nenhum. O parser do pt-BR e a checagem abaixo existem por isso.
    const valorPrevisto = paraNumero(valor);
    if (!Number.isFinite(valorPrevisto) || valorPrevisto <= 0) {
      setErro("Informe um valor previsto maior que zero.");
      return;
    }

    const quantidadeRecorrencia = Number(mesesRecorrencia);
    if (!editandoId && recorrente && (!Number.isInteger(quantidadeRecorrencia) || quantidadeRecorrencia < 2 || quantidadeRecorrencia > 60)) {
      setErro("Informe uma recorrência entre 2 e 60 meses.");
      return;
    }

    setSalvando(true);
    try {
      const r = await fetch("/api/custos", {
        method: editandoId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editandoId ? { id: editandoId } : {}),
          descricao,
          tipo,
          categoriaId: categoriaId || null,
          competencia,
          vencimento,
          valorPrevisto,
          ...(!editandoId
            ? { recorrente, mesesRecorrencia: recorrente ? quantidadeRecorrencia : undefined }
            : {}),
        }),
      });
      const dados = await r.json();
      if (!r.ok) { setErro(dados.erro); return; }
      limparFormulario();
      setFormAberto(false);
      await carregar();
      router.refresh();
    } finally { setSalvando(false); }
  }


  async function confirmarExclusao() {
    if (!excluindo) return;

    setErro(null);
    setSalvando(true);

    try {
      const r = await fetch("/api/custos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: excluindo.id }),
      });

      const dados = await r.json();

      if (!r.ok) {
        setErro(dados.erro ?? "Não foi possível excluir o custo.");
        return;
      }

      if (editandoId === excluindo.id) {
        limparFormulario();
      }

      setExcluindo(null);

      await carregar();
      router.refresh();
    } finally {
      setSalvando(false);
    }
  }
  const custosFiltrados = custos.filter((c) => {
    if (competenciaFiltro && c.competencia !== competenciaFiltro) return false;
    if (tipoFiltro && c.tipo !== tipoFiltro) return false;
    if (categoriaFiltro && (c.categoriaId ?? "") !== categoriaFiltro) return false;
    if (statusFiltro && c.situacao !== statusFiltro) return false;
    if (busca.trim()) {
      const termo = busca.trim().toLocaleLowerCase("pt-BR");
      const alvo = `${c.descricao} ${c.categoria ?? ""} ${c.tipo}`.toLocaleLowerCase("pt-BR");
      if (!alvo.includes(termo)) return false;
    }
    return true;
  });

  const totais = custosFiltrados.reduce(
    (t, c) => ({ previsto: t.previsto + c.previsto, pago: t.pago + c.pago, saldo: t.saldo + c.saldo }),
    { previsto: 0, pago: 0, saldo: 0 }
  );

  const anos = Array.from(new Set([new Date().getFullYear(), ...custos.map((c) => Number(c.competencia.slice(0, 4)))]))
    .filter(Number.isFinite)
    .sort((a, b) => b - a);
  const [anoFiltro, mesFiltro] = competenciaFiltro.split("-");

  return (
    <>
      {erro && <div className="aviso" style={{ borderColor: "rgba(240,109,109,.4)", color: "var(--perigo)" }}>{erro}</div>}

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
          <button type="button" className="botao fm-botao-novo" onClick={() => { limparFormulario(); setFormAberto(true); }}>
            + Novo Custo
          </button>
        )}
      </div>

      <div className="fm-modulo-resumo fm-custos-resumo fm-custos-resumo-v44">
        <div className="fm-kpi-compacto fm-kpi-neutro">
          <span>Compromissos do mês</span><strong>{real(totais.previsto)}</strong><small>Total assumido na competência</small>
        </div>
        <div className="fm-kpi-compacto fm-kpi-saida">
          <span>Realizado no mês</span><strong>{real(totais.pago)}</strong>
          <small>{totais.previsto > 0 ? `${((totais.pago / totais.previsto) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% dos compromissos` : "Sem compromissos na competência"}</small>
        </div>
        <div className="fm-kpi-compacto fm-kpi-roxo">
          <span>A pagar</span><strong>{real(totais.saldo)}</strong>
          <small>{totais.previsto > 0 ? `${((totais.saldo / totais.previsto) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% dos compromissos` : "Sem compromissos na competência"}</small>
        </div>
      </div>

      <GraficoCustosMensal
        custos={custos}
        ano={anoFiltro}
        mesDestaque={mesFiltro}
      />

      <div className="fm-legenda-custos" aria-label="Legenda dos valores">
        <span className="fm-legenda-titulo">Legenda</span>
        <span><i className="fm-dot fm-dot-previsto" />Previsto</span>
        <span><i className="fm-dot fm-dot-realizado" />Realizado</span>
        <span><i className="fm-dot fm-dot-pendente" />Pendente</span>
        <span><i className="fm-dot fm-dot-diferenca" />Diferença</span>
        <span><i className="fm-dot fm-dot-negativa" />Negativa</span>
      </div>

      <div className="fm-filtros-operacionais fm-custos-filtros-v44">
        <div className="fm-busca-operacional">
          <span aria-hidden="true">⌕</span>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por descrição..." aria-label="Buscar custos" />
        </div>
        <select value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value)} aria-label="Filtrar por tipo">
          <option value="">Todos os tipos</option>
          {TIPOS_CUSTO.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={categoriaFiltro} onChange={(e) => setCategoriaFiltro(e.target.value)} aria-label="Filtrar por categoria">
          <option value="">Todas as categorias</option>
          {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <select value={statusFiltro} onChange={(e) => setStatusFiltro(e.target.value)} aria-label="Filtrar por status">
          <option value="">Todos os status</option>
          <option value="PREVISTO">Previsto</option>
          <option value="PARCIAL">Parcial</option>
          <option value="PAGO">Pago</option>
        </select>
        <button
          type="button"
          className="fm-limpar-filtros"
          onClick={() => { setBusca(""); setTipoFiltro(""); setCategoriaFiltro(""); setStatusFiltro(""); }}
        >
          × Limpar
        </button>
      </div>

      {!somenteLeitura && formAberto && (
        <div
          className="fm-custo-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={editandoId ? "Editar custo" : "Novo custo"}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !salvando) {
              limparFormulario();
              setFormAberto(false);
            }
          }}
        >
          <div className="fm-custo-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="fm-custo-modal-cabecalho">
              <h2>{editandoId ? "Editar · Custo" : "Novo · Custo"}</h2>
              <button
                type="button"
                className="fm-custo-modal-fechar"
                onClick={() => { limparFormulario(); setFormAberto(false); }}
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            <form className="fm-custo-form" onSubmit={criar}>
              <div className="fm-custo-modal-corpo">
                <section className="fm-custo-secao">
                  <div className="fm-custo-secao-titulo">Identificação</div>
                  <div className="fm-custo-grid">
                    <div className="fm-custo-campo">
                      <label>Descrição <b>*</b></label>
                      <input
                        value={descricao}
                        onChange={(e) => setDescricao(e.target.value)}
                        placeholder="Ex.: Aluguel da clínica"
                        required
                        disabled={salvando}
                      />
                    </div>

                    <div className="fm-custo-campo">
                      <label>Tipo do Custo <b>*</b></label>
                      <SelectPadrao
                        value={tipo}
                        onChange={setTipo}
                        disabled={salvando}
                        options={TIPOS_CUSTO.map((t) => ({ value: t, label: t }))}
                        ariaLabel="Tipo do custo"
                      />
                    </div>

                    <div className="fm-custo-campo">
                      <label>Categoria</label>
                      <SelectPadrao
                        value={categoriaId}
                        onChange={setCategoriaId}
                        disabled={salvando}
                        options={[
                          { value: "", label: "Sem categoria" },
                          ...categorias.map((c) => ({ value: c.id, label: c.nome })),
                        ]}
                        ariaLabel="Categoria do custo"
                      />
                    </div>

                    <div className="fm-custo-campo">
                      <label>Competência <b>*</b></label>
                      <input
                        type="month"
                        value={competencia}
                        onChange={(e) => setCompetencia(e.target.value)}
                        required
                        disabled={salvando}
                      />
                    </div>
                  </div>
                </section>

                <section className="fm-custo-secao fm-custo-secao-previsao">
                  <div className="fm-custo-secao-titulo">Previsão</div>
                  <div className="fm-custo-grid">
                    <div className="fm-custo-campo">
                      <label>Data de Vencimento <b>*</b></label>
                      <input
                        type="date"
                        value={vencimento}
                        onChange={(e) => setVencimento(e.target.value)}
                        required
                        disabled={salvando}
                      />
                    </div>

                    <div className="fm-custo-campo">
                      <label>Valor Previsto <b>*</b></label>
                      <CampoMoeda
                        value={valor}
                        onChange={(e) => setValor(e.target.value)}
                        placeholder="R$ 0,00"
                        required
                        disabled={salvando}
                      />
                    </div>
                  </div>

                  {!editandoId && (
                    <div className="fm-custo-recorrencia">
                      <label className="fm-custo-recorrencia-opcao">
                        <input
                          type="checkbox"
                          checked={recorrente}
                          onChange={(e) => setRecorrente(e.target.checked)}
                          disabled={salvando}
                        />
                        <span>
                          <strong>Este custo é recorrente</strong>
                          <small>Repita este custo automaticamente nas próximas competências.</small>
                        </span>
                      </label>

                      {recorrente && (
                        <div className="fm-custo-recorrencia-detalhe">
                          <div className="fm-custo-campo">
                            <label>Gerar previsão para <b>*</b></label>
                            <div className="fm-custo-recorrencia-meses">
                              <input
                                type="text"
                                inputMode="numeric"
                                value={mesesRecorrencia}
                                onChange={(e) => {
                                  const valorDigitado = e.target.value.replace(/\D/g, "").slice(0, 2);
                                  setMesesRecorrencia(valorDigitado);
                                }}
                                onBlur={() => {
                                  if (mesesRecorrencia === "") setMesesRecorrencia("12");
                                }}
                                disabled={salvando}
                                required
                                aria-label="Quantidade de meses da recorrência"
                              />
                              <span>meses</span>
                            </div>
                            <small>De 2 a 60 meses, incluindo a primeira competência.</small>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              </div>

              <div className="fm-custo-modal-rodape">
                <button
                  type="button"
                  className="botao discreto"
                  onClick={() => { limparFormulario(); setFormAberto(false); }}
                  disabled={salvando}
                >
                  Cancelar
                </button>
                <button type="submit" className="botao" disabled={salvando}>
                  {salvando ? "Salvando..." : editandoId ? "Salvar alterações" : "Salvar Custo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="cartao tabela-rolagem fm-tabela-operacional fm-custos-tabela-v44">
        <table>
          <thead>
            <tr>
              <th>Descrição</th><th>Tipo</th><th>Categoria</th><th>Competência</th><th>Vencimento</th>
              <th style={{ textAlign: "right" }}>Previsto</th><th style={{ textAlign: "right" }}>Realizado</th><th style={{ textAlign: "right" }}>Diferença</th>
              <th>Status</th><th style={{ textAlign: "center" }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {custosFiltrados.map((c) => (
              <tr key={c.id}>
                <td><strong>{c.descricao}</strong></td>
                <td><span className="fm-tag-tipo">{c.tipo}</span></td>
                <td>{c.categoria ?? "—"}</td>
                <td>{compBR(c.competencia)}</td>
                <td>{dataBR(c.vencimento)}</td>
                <td style={{ textAlign: "right", color: "var(--fm-brand)" }}>{real(c.previsto)}</td>
                <td style={{ textAlign: "right", color: "var(--sucesso)" }}>{real(c.pago)}</td>
                <td style={{ textAlign: "right", color: c.saldo > 0.005 ? "var(--ambar)" : "var(--texto-2)" }}>{real(c.saldo)}</td>
                <td><span className={`selo ${SELO[c.situacao] ?? "off"}`}>{c.situacao}</span></td>
                <td className="fm-col-acoes">
                  <div className="fm-acoes-compactas">
                    <button type="button" className="fm-acao-icone" onClick={() => setVisualizando(c)} title="Visualizar custo" aria-label="Visualizar custo">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.8"/></svg>
                    </button>
                    {!somenteLeitura && (
                      <div className="fm-menu-acoes-wrap">
                        <button type="button" className="fm-acao-icone" onClick={() => setMenuAcoesId(menuAcoesId === c.id ? null : c.id)} aria-label="Mais ações" title="Mais ações">⋮</button>
                        {menuAcoesId === c.id && (
                          <div className="fm-menu-acoes">
                            {c.pago <= 0 && <button type="button" onClick={() => { setMenuAcoesId(null); iniciarEdicao(c); }}>Editar</button>}
                            <button type="button" onClick={() => { setMenuAcoesId(null); setPagamentosDe(c); }}>
                              {!c.temMovimento ? "Pagar" : c.saldo > 0.005 ? "Pagamentos / estornos" : "Pagamentos / estornar"}
                            </button>
                            {!c.temMovimento && <button type="button" className="perigo" onClick={() => { setMenuAcoesId(null); setExcluindo(c); }}>Excluir</button>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!carregando && custosFiltrados.length === 0 && (
              <tr><td colSpan={10}><div className="fm-vazio-linha"><strong>Nenhum custo encontrado</strong><span>Ajuste os filtros ou cadastre um novo custo.</span></div></td></tr>
            )}
            {custosFiltrados.length > 0 && (
              <tr className="fm-total-linha">
                <td colSpan={5}><strong>Total</strong></td>
                <td style={{ textAlign: "right" }}><strong>{real(totais.previsto)}</strong></td>
                <td style={{ textAlign: "right", color: "var(--sucesso)" }}><strong>{real(totais.pago)}</strong></td>
                <td style={{ textAlign: "right", color: "var(--ambar)" }}><strong>{real(totais.saldo)}</strong></td>
                <td colSpan={2} />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {visualizando && (
        <div style={{ position:"fixed", inset:0, zIndex:300, background:"rgba(2,12,22,.72)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={() => setVisualizando(null)}>
          <div className="cartao" style={{ width:"min(680px, 100%)", maxHeight:"90vh", overflowY:"auto" }} onClick={(e) => e.stopPropagation()}>
            <div className="cartao-corpo">
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:16, marginBottom:20 }}>
                <div><h2 style={{ margin:0, fontSize:17 }}>Detalhes do custo</h2><p style={{ margin:"5px 0 0", color:"var(--texto-3)", fontSize:12 }}>Visualização somente leitura</p></div>
                <button type="button" className="botao discreto mini" onClick={() => setVisualizando(null)} aria-label="Fechar">×</button>
              </div>
              <div className="grade-form">
                <div className="largo"><label className="rotulo">Descrição</label><div className="campo">{visualizando.descricao}</div></div>
                <div><label className="rotulo">Tipo</label><div className="campo">{visualizando.tipo}</div></div>
                <div><label className="rotulo">Categoria</label><div className="campo">{visualizando.categoria ?? "—"}</div></div>
                <div><label className="rotulo">Competência</label><div className="campo">{compBR(visualizando.competencia)}</div></div>
                <div><label className="rotulo">Vencimento</label><div className="campo">{dataBR(visualizando.vencimento)}</div></div>
                <div><label className="rotulo">Valor previsto</label><div className="campo">{real(visualizando.previsto)}</div></div>
                <div><label className="rotulo">Pago</label><div className="campo">{real(visualizando.pago)}</div></div>
                <div><label className="rotulo">Saldo</label><div className="campo">{real(visualizando.saldo)}</div></div>
                <div><label className="rotulo">Situação</label><div className="campo"><span className={`selo ${SELO[visualizando.situacao] ?? "off"}`}>{visualizando.situacao}</span></div></div>
              </div>
              <div style={{ marginTop: 20 }}>
                <label className="rotulo">Anexo (PDF)</label>
                <AnexoPdf tipo="custo" id={visualizando.id} anexoInicial={visualizando.anexo} somenteLeitura={somenteLeitura} />
              </div>
            </div>
          </div>
        </div>
      )}

      {excluindo && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirmar exclusão"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(2, 12, 22, .72)",
            backdropFilter: "blur(5px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !salvando) {
              setExcluindo(null);
            }
          }}
        >
          <div
            className="cartao"
            style={{
              width: "100%",
              maxWidth: 480,
              boxShadow: "0 24px 80px rgba(0,0,0,.45)",
            }}
          >
            <div className="cartao-corpo" style={{ padding: 28 }}>
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 18,
                  background: "rgba(240, 109, 109, .12)",
                  border: "1px solid rgba(240, 109, 109, .28)",
                  color: "var(--perigo)",
                  fontSize: 22,
                  fontWeight: 800,
                }}
              >
                !
              </div>

              <h2 style={{ margin: "0 0 10px", fontSize: 20 }}>
                Confirmar exclusão
              </h2>

              <p
                style={{
                  margin: "0 0 12px",
                  color: "var(--texto-2)",
                  lineHeight: 1.6,
                }}
              >
                Você está prestes a excluir o custo{" "}
                <strong style={{ color: "var(--texto-1)" }}>
                  “{excluindo.descricao}”
                </strong>.
              </p>

              <div
                style={{
                  padding: "13px 15px",
                  borderRadius: 12,
                  marginBottom: 22,
                  background: "rgba(240, 109, 109, .08)",
                  border: "1px solid rgba(240, 109, 109, .2)",
                  color: "var(--perigo)",
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                Esta ação é permanente. Depois da exclusão, os dados não
                poderão ser recuperados.
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  className="botao discreto"
                  disabled={salvando}
                  onClick={() => setExcluindo(null)}
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  className="botao"
                  disabled={salvando}
                  onClick={confirmarExclusao}
                  style={{
                    background: "var(--perigo)",
                    borderColor: "var(--perigo)",
                  }}
                >
                  {salvando ? "Excluindo..." : "Excluir definitivamente"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {pagamentosDe && (
        <PainelEventos
          rota={`/api/custos/${pagamentosDe.id}/pagamentos`}
          titulo="Pagamentos"
          documento={pagamentosDe.descricao}
          previsto={pagamentosDe.previsto}
          rotuloAcao="Registrar pagamento"
          somenteLeitura={somenteLeitura}
          aoMudar={() => { carregar(); router.refresh(); }}
          aoFechar={() => setPagamentosDe(null)}
        />
      )}
    </>
  );
}










