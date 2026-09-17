"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Mesmas exigências do servidor, mostradas antes de enviar. */
const REGRAS = [
  { texto: "Pelo menos 8 caracteres", ok: (s: string) => s.length >= 8 },
  { texto: "Uma letra minúscula", ok: (s: string) => /[a-z]/.test(s) },
  { texto: "Uma letra maiúscula", ok: (s: string) => /[A-Z]/.test(s) },
  { texto: "Um número", ok: (s: string) => /[0-9]/.test(s) },
];

export default function FormularioNovaSenha() {
  const router = useRouter();
  const [provisoria, setProvisoria] = useState("");
  const [nova, setNova] = useState("");
  const [confirma, setConfirma] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const atendeTudo = REGRAS.every((r) => r.ok(nova));
  const iguais = nova.length > 0 && nova === confirma;

  async function salvar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);

    if (!provisoria) return setErro("Informe a senha provisória que você recebeu.");
    if (!atendeTudo) return setErro("A nova senha ainda não atende a todas as regras.");
    if (!iguais) return setErro("A confirmação não confere com a nova senha.");

    setEnviando(true);
    try {
      const resposta = await fetch("/api/auth/trocar-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senhaAtual: provisoria, novaSenha: nova }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) {
        setErro(dados.erro ?? "Não foi possível salvar.");
        return;
      }
      router.replace(dados.proximo ?? "/painel");
      router.refresh();
    } catch {
      setErro("Não foi possível falar com o servidor. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={salvar} noValidate>
      <label className="rotulo" htmlFor="provisoria">Senha provisória</label>
      <div className="campo">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <input
          id="provisoria" type="password" autoComplete="current-password"
          placeholder="A que veio no e-mail" value={provisoria}
          onChange={(e) => setProvisoria(e.target.value)} disabled={enviando}
        />
      </div>

      <label className="rotulo" htmlFor="nova">Nova senha</label>
      <div className="campo">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <input
          id="nova" type="password" autoComplete="new-password"
          placeholder="Escolha uma senha só sua" value={nova}
          onChange={(e) => setNova(e.target.value)} disabled={enviando}
        />
      </div>

      <ul className="regras-senha">
        {REGRAS.map((r) => (
          <li key={r.texto} className={r.ok(nova) ? "atende" : ""}>
            <span aria-hidden="true">{r.ok(nova) ? "✓" : "•"}</span> {r.texto}
          </li>
        ))}
      </ul>

      <label className="rotulo" htmlFor="confirma">Confirme a nova senha</label>
      <div className="campo">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20 6 9 17l-5-5" />
        </svg>
        <input
          id="confirma" type="password" autoComplete="new-password"
          placeholder="Digite de novo" value={confirma}
          onChange={(e) => setConfirma(e.target.value)} disabled={enviando}
        />
      </div>

      {erro && <p className="erro" role="alert">{erro}</p>}

      <button type="submit" className="botao-entrar" disabled={enviando}>
        {enviando ? "Salvando…" : "SALVAR E ENTRAR"}
      </button>
    </form>
  );
}
