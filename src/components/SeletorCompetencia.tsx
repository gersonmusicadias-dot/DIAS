"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MESES_LONGOS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/**
 * Mesmo seletor do fluxomed_v2.html: painel próprio, no tema do sistema,
 * em vez do calendário nativo do navegador.
 */
export default function SeletorCompetencia({ valor }: { valor: string }) {
  const router = useRouter();
  const caminho = usePathname();
  const [aberto, setAberto] = useState(false);
  const [ano, setAno] = useState(() => Number(valor.slice(0, 4)));
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function foraDaCaixa(evento: MouseEvent) {
      if (caixa.current && !caixa.current.contains(evento.target as Node)) setAberto(false);
    }
    document.addEventListener("click", foraDaCaixa);
    return () => document.removeEventListener("click", foraDaCaixa);
  }, []);

  function escolher(competencia: string) {
    setAberto(false);
    router.push(`${caminho}?competencia=${competencia}`);
  }

  const mesAtual = Number(valor.slice(5, 7)) - 1;
  const legivel = `${MESES_LONGOS[mesAtual] ?? "—"} de ${valor.slice(0, 4)}`;

  return (
    <div className="comp-caixa" ref={caixa}>
      <button type="button" className="comp-gatilho" onClick={() => { setAno(Number(valor.slice(0, 4))); setAberto((v) => !v); }}
        aria-expanded={aberto} aria-haspopup="dialog">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" />
        </svg>
        <span className="comp-rotulo">Competência</span>
        <span className="comp-valor">{legivel}</span>
      </button>

      {aberto && (
        <div className="comp-painel" role="dialog" aria-label="Escolher competência">
          <div className="comp-ano">
            <button type="button" onClick={() => setAno((a) => a - 1)} aria-label="Ano anterior">‹</button>
            <strong>{ano}</strong>
            <button type="button" onClick={() => setAno((a) => a + 1)} aria-label="Próximo ano">›</button>
          </div>
          <div className="comp-meses">
            {MESES.map((mes, i) => {
              const competencia = `${ano}-${String(i + 1).padStart(2, "0")}`;
              return (
                <button key={mes} type="button"
                  className={competencia === valor ? "selecionado" : ""}
                  onClick={() => escolher(competencia)}>
                  {mes}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
