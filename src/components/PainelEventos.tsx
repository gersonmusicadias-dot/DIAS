"use client";

import CampoMoeda from "@/components/CampoMoeda";

import { useEffect, useState } from "react";
import { real, dataBR, hojeISO, paraNumero } from "@/lib/ui";
import { liquido, type TipoEvento } from "@/lib/financeiro/motor";

interface EventoLido {
  id: string; data: string; valor: number; tipo: TipoEvento;
  motivo: string | null; observacao: string | null;
  estornado: boolean; podeEstornar: boolean;
}

/**
 * Histórico e lançamento de eventos financeiros.
 *
 * Serve Custos, Notas e Recibos: os três têm a mesma mecânica — pilha
 * append-only, recebimento/pagamento parcial e estorno com motivo.
 */
export default function PainelEventos({
  rota, titulo, documento, previsto, rotuloAcao, somenteLeitura, aoMudar, aoFechar,
}: {
  rota: string;
  titulo: string;
  documento: string;
  /** Valor total do documento. O saldo é calculado aqui, a partir dos
   *  eventos carregados — se viesse pronto de fora, ficaria velho no
   *  instante seguinte a um estorno feito dentro deste painel. */
  previsto: number;
  rotuloAcao: string;
  somenteLeitura: boolean;
  aoMudar: () => void;
  aoFechar: () => void;
}) {
  const [eventos, setEventos] = useState<EventoLido[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const saldo = Math.max(0, previsto - liquido(eventos));

  const [data, setData] = useState(hojeISO());
  const [valor, setValor] = useState("");
  // Enquanto a pessoa não mexe no campo, ele acompanha o saldo em aberto: o
  // valor cadastrado na primeira vez, o que falta depois de um pagamento parcial.
  const [valorEditado, setValorEditado] = useState(false);
  const [estornando, setEstornando] = useState<EventoLido | null>(null);
  const [motivo, setMotivo] = useState("");

  async function carregar() {
    setCarregando(true);
    const r = await fetch(rota);
    if (r.ok) setEventos((await r.json()).eventos);
    setCarregando(false);
  }

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [rota]);

  useEffect(() => {
    if (carregando || estornando || valorEditado) return;
    setValor(saldo > 0 ? saldo.toFixed(2).replace(".", ",") : "");
  }, [carregando, saldo, estornando, valorEditado]);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const corpo = estornando
        ? { data, valor: paraNumero(valor), estornoDe: estornando.id, motivo }
        : { data, valor: paraNumero(valor) };

      const r = await fetch(rota, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      const resposta = await r.json();
      if (!r.ok) { setErro(resposta.erro); return; }

      setValor(""); setMotivo(""); setEstornando(null); setValorEditado(false);
      await carregar();
      aoMudar();
    } finally { setEnviando(false); }
  }

  function comecarEstorno(e: EventoLido) {
    setEstornando(e);
    setValor(String(e.valor).replace(".", ","));
    setData(hojeISO());
    setErro(null);
  }

  return (
    <div className="modal-fundo" onClick={(e) => { if (e.target === e.currentTarget) aoFechar(); }}>
      <div className="modal-caixa" role="dialog" aria-modal="true" aria-label={titulo}>
        <header className="modal-topo">
          <div>
            <h3>{titulo}</h3>
            <p>{documento} · saldo em aberto {real(saldo)}</p>
          </div>
          <button type="button" className="fechar" onClick={aoFechar} aria-label="Fechar">×</button>
        </header>

        <div className="modal-corpo">
          {erro && <div className="aviso erro-aviso">{erro}</div>}

          {!somenteLeitura && (saldo > 0 || estornando) && (
            <form onSubmit={enviar} className="form-evento">
              {estornando && (
                <div className="aviso" style={{ marginBottom: 12 }}>
                  Estornando o lançamento de {real(estornando.valor)} de {dataBR(estornando.data)}.
                  O original permanece no histórico.
                </div>
              )}
              <div className="grade-form">
                <div>
                  <label className="rotulo">Data</label>
                  <div className="campo" style={{ marginBottom: 0 }}>
                    <input type="date" value={data} onChange={(e) => setData(e.target.value)}
                      required disabled={enviando} style={{ colorScheme: "dark" }} />
                  </div>
                </div>
                <div>
                  <label className="rotulo">Valor</label>
                  <div className="campo" style={{ marginBottom: 0 }}>
                    <CampoMoeda value={valor} onChange={(e) => { setValor(e.target.value); setValorEditado(true); }}
                      placeholder="0,00" required disabled={enviando} />
                  </div>
                </div>
                {estornando && (
                  <div className="largo">
                    <label className="rotulo">Motivo do estorno</label>
                    <div className="campo" style={{ marginBottom: 0 }}>
                      <input value={motivo} onChange={(e) => setMotivo(e.target.value)}
                        placeholder="Por que este lançamento está sendo estornado?" required disabled={enviando} />
                    </div>
                  </div>
                )}
                <div className="largo" style={{ display: "flex", gap: 8 }}>
                  <button type="submit" className="botao" disabled={enviando}>
                    {enviando ? "Salvando…" : estornando ? "Confirmar estorno" : rotuloAcao}
                  </button>
                  {estornando && (
                    <button type="button" className="botao discreto"
                      onClick={() => { setEstornando(null); setValor(""); setMotivo(""); setValorEditado(false); }}>
                      Cancelar estorno
                    </button>
                  )}
                </div>
              </div>
            </form>
          )}

          <p className="rotulo-secao" style={{ marginTop: 20 }}>Histórico</p>
          {carregando ? (
            <p style={{ color: "var(--texto-3)", fontSize: 13 }}>Carregando…</p>
          ) : eventos.length === 0 ? (
            <p style={{ color: "var(--texto-3)", fontSize: 13 }}>Nenhum lançamento ainda.</p>
          ) : (
            <div className="tabela-rolagem">
            <table>
              <thead>
                <tr><th>Data</th><th>Tipo</th><th style={{ textAlign: "right" }}>Valor</th><th>Motivo</th><th></th></tr>
              </thead>
              <tbody>
                {eventos.map((e) => (
                  <tr key={e.id} style={e.estornado ? { opacity: 0.55 } : undefined}>
                    <td>{dataBR(e.data)}</td>
                    <td>
                      <span className={`selo ${e.tipo === "REVERSAL" ? "espera" : "ok"}`}>
                        {e.tipo === "REVERSAL" ? "Estorno" : "Normal"}
                      </span>
                      {e.estornado && <span className="selo off" style={{ marginLeft: 6 }}>Estornado</span>}
                    </td>
                    <td style={{ textAlign: "right", color: e.tipo === "REVERSAL" ? "var(--ambar)" : "var(--sucesso)" }}>
                      {real(e.valor)}
                    </td>
                    <td style={{ fontSize: 12, color: "var(--texto-3)" }}>{e.motivo ?? e.observacao ?? "—"}</td>
                    <td>
                      {!somenteLeitura && e.podeEstornar && (
                        <button type="button" className="botao discreto" onClick={() => comecarEstorno(e)}>
                          Estornar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
