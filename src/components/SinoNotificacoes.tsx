"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Notificacao = {
  id: string;
  titulo: string;
  mensagem: string;
  destino: string;
  lidaEm: string | null;
  criadoEm: string;
};

export default function SinoNotificacoes() {
  const [aberto, setAberto] = useState(false);
  const [itens, setItens] = useState<Notificacao[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const caixa = useRef<HTMLDivElement>(null);

  async function carregar() {
    const r = await fetch("/api/notificacoes", { cache: "no-store" });
    if (!r.ok) return;
    const d = await r.json();
    setItens(d.notificacoes ?? []);
    setNaoLidas(d.naoLidas ?? 0);
  }

  useEffect(() => { carregar(); const t = window.setInterval(carregar, 60000); return () => window.clearInterval(t); }, []);
  useEffect(() => {
    if (!aberto) return;
    const fechar = (e: MouseEvent) => { if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false); };
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, [aberto]);

  async function marcar(id?: string) {
    await fetch("/api/notificacoes", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(id ? { id } : { todos: true }) });
    await carregar();
  }

  return (
    <div className="fm-sino-wrap" ref={caixa}>
      <button type="button" className="icone-topo fm-sino-botao" aria-label="Notificações" title="Notificações" onClick={() => setAberto((v) => !v)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>
        {naoLidas > 0 && <span className="fm-sino-contador">{naoLidas > 99 ? "99+" : naoLidas}</span>}
      </button>
      {aberto && (
        <div className="fm-notificacoes-popover">
          <div className="fm-notificacoes-topo"><strong>Notificações</strong>{naoLidas > 0 && <button type="button" onClick={() => marcar()}>Marcar todas como lidas</button>}</div>
          <div className="fm-notificacoes-lista">
            {itens.length === 0 ? <p className="fm-notificacoes-vazio">Nenhuma notificação financeira.</p> : itens.slice(0, 12).map((n) => (
              <Link key={n.id} href={n.destino} className={`fm-notificacao-item ${n.lidaEm ? "" : "nao-lida"}`} onClick={() => { if (!n.lidaEm) void marcar(n.id); setAberto(false); }}>
                <strong>{n.titulo}</strong><span>{n.mensagem}</span><small>{new Date(n.criadoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</small>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
