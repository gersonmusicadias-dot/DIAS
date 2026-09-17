"use client";

import CampoMoeda from "@/components/CampoMoeda";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { dataBR, hojeISO, paraNumero, real } from "@/lib/ui";

interface Linha {
  id: string;
  data: string;
  tipo: string;
  documento: string;
  descricao: string;
  valor: number;
  previsto: boolean;
  estornoDe?: string | null;
  saldo: number;
}

interface Visao {
  modo: string;
  configurado: boolean;
  saldoInicial: number;
  entradas: number;
  saidas: number;
  estornos: number;
  saldoFinal: number;
  semData: Linha[];
  linhas: Linha[];
}

const MODOS = [
  ["PREVISTO", "Previsto"],
  ["REALIZADO", "Realizado"],
  ["CONSOLIDADO", "Consolidado"],
] as const;

function isoLocal(data: Date) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function intervaloMeses(qtd: number) {
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const fim = new Date(hoje.getFullYear(), hoje.getMonth() + qtd, 0);
  return [isoLocal(inicio), isoLocal(fim)] as const;
}

function totaisConsolidados(linhas: Linha[]) {
  let entradasRealizadas = 0;
  let entradasPrevistas = 0;
  let saidasRealizadas = 0;
  let saidasPrevistas = 0;

  for (const linha of linhas) {
    if (linha.valor > 0) {
      if (linha.previsto) entradasPrevistas += linha.valor;
      else entradasRealizadas += linha.valor;
    } else if (linha.valor < 0) {
      if (linha.previsto) saidasPrevistas += Math.abs(linha.valor);
      else saidasRealizadas += Math.abs(linha.valor);
    }
  }

  return { entradasRealizadas, entradasPrevistas, saidasRealizadas, saidasPrevistas };
}

export default function VerFluxoCaixa({ somenteLeitura }: { somenteLeitura: boolean }) {
  const router = useRouter();
  const [visao, setVisao] = useState<Visao | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [modo, setModo] = useState<string>("REALIZADO");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [definindoSaldo, setDefinindoSaldo] = useState(false);
  const [valorSaldo, setValorSaldo] = useState("");
  const [dataSaldo, setDataSaldo] = useState(hojeISO());
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const q = new URLSearchParams({ modo });
    if (inicio) q.set("inicio", inicio);
    if (fim) q.set("fim", fim);
    const r = await fetch(`/api/fluxo-caixa?${q}`);
    if (r.ok) setVisao((await r.json()).visao);
    setCarregando(false);
  }, [modo, inicio, fim]);

  useEffect(() => { carregar(); }, [carregar]);

  const composicao = useMemo(() => totaisConsolidados(visao?.linhas ?? []), [visao]);

  async function salvarSaldo(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      const corpo = visao?.configurado
        ? { valor: paraNumero(valorSaldo) }
        : { valor: paraNumero(valorSaldo), dataReferencia: dataSaldo };
      const r = await fetch("/api/fluxo-caixa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      const d = await r.json();
      if (!r.ok) { setErro(d.erro); return; }
      setDefinindoSaldo(false);
      setValorSaldo("");
      await carregar();
      router.refresh();
    } finally {
      setSalvando(false);
    }
  }

  function aplicarAtalho(meses: number) {
    const [de, ate] = intervaloMeses(meses);
    setInicio(de);
    setFim(ate);
  }

  const saldoFinalLabel = modo === "REALIZADO" ? "Saldo final do per\u00edodo" : "Saldo projetado";
  const entradasLabel = modo === "PREVISTO" ? "Entradas previstas" : modo === "REALIZADO" ? "Entradas realizadas" : "Entradas no per\u00edodo";
  const saidasLabel = modo === "PREVISTO" ? "Sa\u00eddas previstas" : modo === "REALIZADO" ? "Sa\u00eddas realizadas" : "Sa\u00eddas no per\u00edodo";

  return (
    <section className="fm-caixa-v41 fm-caixa-v38">
      {erro && <div className="aviso erro-aviso">{erro}</div>}

      {visao && !visao.configurado && (
        <div className="aviso">{"Saldo inicial n\u00e3o configurado. O acumulado parte de zero at\u00e9 que um saldo inicial seja definido."}</div>
      )}

      <div className="fm-caixa-v41-acoes">
        <div className="fm-caixa-v41-modos" aria-label="Visao do fluxo de caixa">
          {MODOS.map(([valor, rotulo]) => (
            <button key={valor} type="button" aria-pressed={modo === valor} className={modo === valor ? "ativo" : ""} onClick={() => setModo(valor)}>
              {rotulo}
            </button>
          ))}
        </div>
        {!somenteLeitura && (
          <button type="button" className="fm-caixa-v41-saldo-inicial" onClick={() => setDefinindoSaldo(true)}>
            {visao?.configurado ? "Acrescentar saldo" : "Definir saldo inicial"}
          </button>
        )}
      </div>

      <p className="fm-caixa-v41-contexto">
        {modo === "CONSOLIDADO"
          ? "Consolidado: combina\u00e7\u00e3o de realizado e previsto no per\u00edodo selecionado."
          : modo === "PREVISTO"
            ? "Previsto: movimenta\u00e7\u00f5es futuras no per\u00edodo selecionado."
            : "Realizado: movimenta\u00e7\u00f5es efetivamente registradas no per\u00edodo selecionado."}
      </p>

      <div className="fm-caixa-v41-periodo">
        <div className="fm-caixa-v41-periodo-principal">
          <span className="fm-caixa-v41-calendario" aria-hidden="true">{"\u25a3"}</span>
          <span className="fm-caixa-v41-periodo-label">{"PER\u00cdODO"}</span>
          <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} aria-label="Data inicial" />
          <span className="fm-caixa-v41-ate">{"at\u00e9"}</span>
          <input type="date" value={fim} onChange={(e) => setFim(e.target.value)} aria-label="Data final" />
        </div>
        <button type="button" onClick={() => aplicarAtalho(1)}>M&ecirc;s atual</button>
        <button type="button" onClick={() => aplicarAtalho(3)}>3 meses</button>
        <button type="button" onClick={() => aplicarAtalho(6)}>6 meses</button>
        <button type="button" onClick={() => aplicarAtalho(12)}>12 meses</button>
        <button type="button" className="fm-caixa-v41-limpar" onClick={() => { setInicio(""); setFim(""); }}>{"\u00d7 Limpar"}</button>
      </div>

      {visao && (
        <div className="fm-caixa-v41-kpis">
          <article className="fm-caixa-v41-kpi inicial">
            <span>{"SALDO INICIAL DO PER\u00cdODO"}</span>
            <strong>{real(visao.saldoInicial)}</strong>
          </article>
          <article className="fm-caixa-v41-kpi entrada">
            <span>{entradasLabel}</span>
            <strong>{real(visao.entradas)}</strong>
            <small>{"Total do per\u00edodo"}</small>
          </article>
          <article className="fm-caixa-v41-kpi saida">
            <span>{saidasLabel}</span>
            <strong>{real(visao.saidas)}</strong>
            <small>{"Total do per\u00edodo"}</small>
          </article>
          <article className="fm-caixa-v41-kpi estorno">
            <span>Estornos (informativo)</span>
            <strong>{real(visao.estornos)}</strong>
            <small>Já refletidos em entradas/saídas</small>
          </article>
          <article className={`fm-caixa-v41-kpi final ${visao.saldoFinal < 0 ? "negativo" : "positivo"}`}>
            <span>{saldoFinalLabel}</span>
            {modo !== "REALIZADO" && <em>{"PROJE\u00c7\u00c3O"}</em>}
            <strong>{real(visao.saldoFinal)}</strong>
          </article>
        </div>
      )}

      {visao && (
        <div className="fm-caixa-v41-composicao">
          <b>{modo === "CONSOLIDADO" ? "RESUMO CONSOLIDADO" : "RESUMO DO PER\u00cdODO"}</b>
          {modo === "CONSOLIDADO" ? (
            <div className="fm-caixa-v41-equacao">
              <span>Saldo Inicial <strong>{real(visao.saldoInicial)}</strong></span><i aria-hidden="true">·</i>
              <span>Entradas Realizadas <strong className="verde">{real(composicao.entradasRealizadas)}</strong></span><i aria-hidden="true">·</i>
              <span>Entradas Previstas <strong className="verde">{real(composicao.entradasPrevistas)}</strong></span><i aria-hidden="true">·</i>
              <span>{"Sa\u00eddas Realizadas "}<strong className="vermelho">{real(composicao.saidasRealizadas)}</strong></span><i aria-hidden="true">·</i>
              <span>{"Sa\u00eddas Previstas "}<strong className="vermelho">{real(composicao.saidasPrevistas)}</strong></span><i aria-hidden="true">·</i>
              <span>Saldo Projetado <strong className={visao.saldoFinal < 0 ? "vermelho" : "verde"}>{real(visao.saldoFinal)}</strong></span>
            </div>
          ) : (
            <div className="fm-caixa-v41-equacao">
              <span>Saldo Inicial <strong>{real(visao.saldoInicial)}</strong></span><i aria-hidden="true">·</i>
              <span>Entradas <strong className="verde">{real(visao.entradas)}</strong></span><i aria-hidden="true">·</i>
              <span>{"Sa\u00eddas "}<strong className="vermelho">{real(visao.saidas)}</strong></span><i aria-hidden="true">·</i>
              <span>{saldoFinalLabel} <strong className={visao.saldoFinal < 0 ? "vermelho" : "verde"}>{real(visao.saldoFinal)}</strong></span>
            </div>
          )}
        </div>
      )}

      {visao && visao.semData.length > 0 && (
        <div className="aviso">
          {visao.semData.length}{" previs\u00e3o(\u00f5es) sem data prevista ficam fora do c\u00e1lculo cronol\u00f3gico: "}
          {visao.semData.map((m) => `${m.documento} ${real(Math.abs(m.valor))}`).join(" \u00b7 ")}
        </div>
      )}

      <div className="fm-caixa-v41-tabela-wrap">
        <table className="fm-caixa-v41-tabela">
          <thead>
            <tr>
              <th scope="col">DATA</th>
              <th scope="col">TIPO</th>
              <th scope="col">DOCUMENTO</th>
              <th scope="col">CLIENTE/DESCRIÇÃO</th>
              <th scope="col" className="numero">ENTRADA</th>
              <th scope="col" className="numero">SAÍDA</th>
              <th scope="col" className="numero">ESTORNO</th>
              <th scope="col" className="numero">SALDO ACUMULADO</th>
            </tr>
          </thead>
          <tbody>
            {visao && (
              <tr className="fm-caixa-v41-saldo-row">
                <td>—</td>
                <td colSpan={3}>Saldo inicial do período</td>
                <td className="numero">—</td>
                <td className="numero">—</td>
                <td className="numero">—</td>
                <td className="numero saldo-valor">{real(visao.saldoInicial)}</td>
              </tr>
            )}
            {visao?.linhas.map((linha) => (
              <tr key={linha.id}>
                <td>{dataBR(linha.data)}</td>
                <td>
                  <div>{linha.tipo}</div>
                  <span className={"fm-caixa-v41-status " + (linha.previsto ? "previsto" : "realizado")}>
                    {linha.previsto ? "Previsto" : "Realizado"}
                  </span>
                </td>
                <td>{linha.documento || "—"}</td>
                <td className="fm-caixa-v41-descricao">{linha.descricao || "—"}</td>
                <td className="numero entrada-valor">{linha.valor > 0 ? real(linha.valor) : "—"}</td>
                <td className="numero saida-valor">{linha.valor < 0 ? real(Math.abs(linha.valor)) : "—"}</td>
                <td className="numero estorno-valor">{linha.estornoDe ? real(Math.abs(linha.valor)) : "—"}</td>
                <td className={"numero saldo-valor " + (linha.saldo < 0 ? "negativo" : "")}>{real(linha.saldo)}</td>
              </tr>
            ))}

            {!carregando && visao?.linhas.length === 0 && (
              <tr><td colSpan={8}><div className="vazio">{"Nenhuma movimenta\u00e7\u00e3o no per\u00edodo."}</div></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {definindoSaldo && (
        <div className="fm-custo-modal-overlay" role="dialog" aria-modal="true" aria-label="Saldo inicial de caixa">
          <div className="fm-custo-modal fm-caixa-v41-modal">
            <div className="fm-custo-modal-cabecalho">
              <div>
                <h2>{visao?.configurado ? "Acrescentar saldo inicial" : "Saldo inicial de caixa"}</h2>
                <p>
                  {visao?.configurado
                    ? `Saldo inicial atual: ${real(visao.saldoInicial)}. O valor informado \u00e9 somado a ele \u2014 n\u00e3o \u00e9 poss\u00edvel redefinir.`
                    : "Defina o ponto de partida do acumulado financeiro."}
                </p>
              </div>
              <button type="button" className="fm-custo-modal-fechar" onClick={() => setDefinindoSaldo(false)} aria-label="Fechar">{"\u00d7"}</button>
            </div>
            <form className="fm-custo-form" onSubmit={salvarSaldo}>
              <div className="fm-custo-modal-corpo">
                <section className="fm-custo-secao">
                  <div className="fm-custo-secao-titulo">{"Refer\u00eancia do saldo"}</div>
                  <div className="fm-caixa-v41-saldo-grid">
                    <div className="fm-custo-campo">
                      <label>{visao?.configurado ? "Valor a acrescentar" : "Valor"} <b>*</b></label>
                      <CampoMoeda value={valorSaldo} onChange={(e) => setValorSaldo(e.target.value)} placeholder="0,00" required disabled={salvando} />
                    </div>
                    {!visao?.configurado && (
                      <div className="fm-custo-campo">
                        <label>{"Data de refer\u00eancia "}<b>*</b></label>
                        <input type="date" value={dataSaldo} onChange={(e) => setDataSaldo(e.target.value)} required disabled={salvando} />
                      </div>
                    )}
                  </div>
                </section>
              </div>
              <div className="fm-custo-modal-rodape">
                <button type="button" className="botao discreto" onClick={() => setDefinindoSaldo(false)} disabled={salvando}>Cancelar</button>
                <button type="submit" className="botao" disabled={salvando}>{salvando ? "Salvando..." : "Salvar saldo"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
