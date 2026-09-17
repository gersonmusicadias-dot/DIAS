"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function FormularioLogin() {
  const router = useRouter();
  const params = useSearchParams();

  const [email, setEmail] = useState(params.get("email") ?? "");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const encerrada = params.get("encerrada") === "1";

  async function entrar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);

    if (!email.trim() || !senha) {
      setErro("Informe o e-mail e a senha.");
      return;
    }

    setEnviando(true);

    try {
      const resposta = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          senha,
        }),
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        setErro(dados.erro ?? "Não foi possível entrar.");
        setSenha("");
        return;
      }

      router.replace(dados.proximo ?? "/painel");
      router.refresh();
    } catch {
      setErro("Não foi possível falar com o servidor.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="fx-form" onSubmit={entrar}>
      {encerrada && !erro && (
        <p className="fx-aviso">
          Sua sessão foi encerrada. Entre novamente para continuar.
        </p>
      )}

      <div className="fx-campo-grupo">
        <label htmlFor="email">E-mail</label>

        <div className="fx-campo">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m4 7 8 6 8-6" />
          </svg>

          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={enviando}
            required
          />
        </div>
      </div>

      <div className="fx-campo-grupo">
        <label htmlFor="senha">Senha</label>

        <div className="fx-campo">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="5" y="10" width="14" height="11" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>

          <input
            id="senha"
            type={mostrarSenha ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            disabled={enviando}
            required
          />

          <button
            type="button"
            className="fx-olho"
            onClick={() => setMostrarSenha((v) => !v)}
            aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>
      </div>

      <div className="fx-recuperar">
        <button
          type="button"
          onClick={() =>
            setErro("A redefinição de senha deve ser solicitada ao administrador.")
          }
        >
          Esqueci minha senha
        </button>
      </div>

      {erro && (
        <p className="fx-erro" role="alert">
          {erro}
        </p>
      )}

      <button
        type="submit"
        className="fx-entrar"
        disabled={enviando}
      >
        {enviando ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
