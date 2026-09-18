"use client";

import { useEffect, useState } from "react";

type Preferencias = {
  email: string;
  receberEmail: boolean;
  notificarPagar: boolean;
  notificarReceber: boolean;
  notificarVencidos: boolean;
};

export default function PreferenciasNotificacao({ email }: { email: string }) {
  const [dados, setDados] = useState<Preferencias>({
    email, receberEmail: false, notificarPagar: true, notificarReceber: true, notificarVencidos: true,
  });
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [testando, setTestando] = useState(false);
  const [resultadoTeste, setResultadoTeste] = useState<{ ok: boolean; texto: string } | null>(null);

  useEffect(() => {
    fetch("/api/preferencias-notificacao").then(r => r.json()).then(j => {
      if (!j.erro) setDados(j);
    }).catch(() => undefined);
  }, []);

  function marcar(campo: keyof Omit<Preferencias, "email">, valor: boolean) {
    setDados(d => ({ ...d, [campo]: valor }));
  }

  async function salvar() {
    setSalvando(true); setMensagem("");
    const r = await fetch("/api/preferencias-notificacao", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        receberEmail: dados.receberEmail,
        notificarPagar: dados.notificarPagar,
        notificarReceber: dados.notificarReceber,
        notificarVencidos: dados.notificarVencidos,
      }),
    });
    const j = await r.json().catch(() => ({}));
    setMensagem(r.ok ? "Preferências salvas." : (j.erro || "Não foi possível salvar."));
    setSalvando(false);
  }

  async function enviarTeste() {
    setTestando(true); setResultadoTeste(null);
    try {
      const r = await fetch("/api/preferencias-notificacao/teste", { method: "POST" });
      const j = await r.json().catch(() => ({}));
      setResultadoTeste(r.ok
        ? { ok: true, texto: `E-mail de teste enviado para ${j.para}. Confira a caixa de entrada (e o spam).` }
        : { ok: false, texto: `Não foi possível enviar: ${j.erro ?? "erro desconhecido"}` });
    } catch {
      setResultadoTeste({ ok: false, texto: "Não foi possível enviar: falha de conexão." });
    } finally {
      setTestando(false);
    }
  }

  return (
    <div className="fm-pref-wrap">
      <section className="fm-pref-card">
        <h2>✉ E-mail que receberá os alertas</h2>
        <strong>{dados.email}</strong>
        <p>As notificações serão enviadas para o e-mail cadastrado na sua conta.</p>
        <button type="button" className="botao discreto mini" onClick={enviarTeste} disabled={testando}>{testando ? "Enviando…" : "Enviar e-mail de teste"}</button>
        {resultadoTeste && <p style={{ marginTop: 8, color: resultadoTeste.ok ? "var(--fm-success)" : "var(--fm-danger)" }}>{resultadoTeste.texto}</p>}
      </section>

      <section className="fm-pref-card">
        <h2>♧ Notificações por e-mail</h2>
        <label className="fm-pref-toggle-row">
          <span><strong>Receber notificações por e-mail</strong><small>Além do aviso no sino, envia os alertas automáticos para o seu e-mail de acesso.</small></span>
          <input type="checkbox" checked={dados.receberEmail} onChange={e => marcar("receberEmail", e.target.checked)} />
        </label>
      </section>

      <section className="fm-pref-card">
        <h2>Preferências de alertas automáticos</h2>
        <label className="fm-pref-check"><input type="checkbox" checked={dados.notificarPagar} onChange={e => marcar("notificarPagar", e.target.checked)} /><span>Contas a pagar — 15, 10, 5, 3, 2, 1 dia e no vencimento</span></label>
        <label className="fm-pref-check"><input type="checkbox" checked={dados.notificarReceber} onChange={e => marcar("notificarReceber", e.target.checked)} /><span>Contas a receber — 15, 10, 5, 3, 2, 1 dia e no vencimento</span></label>
        <label className="fm-pref-check"><input type="checkbox" checked={dados.notificarVencidos} onChange={e => marcar("notificarVencidos", e.target.checked)} /><span>Vencidos</span></label>
      </section>

      <div className="fm-pref-actions">
        {mensagem && <span>{mensagem}</span>}
        <button type="button" className="botao primario" onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar preferências"}</button>
      </div>
    </div>
  );
}
