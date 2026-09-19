"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Marca from "@/components/Marca";
import BotaoSair from "@/components/BotaoSair";
import MenuLateral from "@/components/MenuLateral";
import AlternarTema from "@/components/AlternarTema";
import SinoNotificacoes from "@/components/SinoNotificacoes";
import TabelasEmCartoes from "@/components/TabelasEmCartoes";

const ROTULO_PAPEL: Record<string, string> = {
  ADMIN: "Administrador",
  LEITURA: "Leitura",
  OPERADOR: "Operador",
};

export default function CascaInterna({
  nome, email, papel, children,
}: {
  nome: string;
  email: string;
  papel: string;
  children: React.ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const caminho = usePathname();

  useEffect(() => {
    setAberto(false);
  }, [caminho]);

  useEffect(() => {
    if (!aberto) return;

    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };

    document.addEventListener("keydown", tecla);

    return () => {
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  return (
    <div className="casca">
      <TabelasEmCartoes />
      {aberto && (
        <div
          className="veu-menu"
          onClick={() => setAberto(false)}
          aria-hidden="true"
        />
      )}

      <aside className={aberto ? "lateral aberta" : "lateral"}>
        <div className="lateral-marca">
          <Marca tamanho={38} />

          <button
            type="button"
            className="fechar so-celular"
            onClick={() => setAberto(false)}
            aria-label="Fechar menu"
          >
            ×
          </button>
        </div>

        <MenuLateral ehAdmin={papel === "ADMIN"} />

        <div className="lateral-rodape">
          <div className="chip-usuario">
            <span className="inicial">
              {nome.charAt(0).toUpperCase()}
            </span>

            <div>
              <strong>{nome}</strong>
              <small>{ROTULO_PAPEL[papel] ?? papel}</small>
            </div>
          </div>

          <BotaoSair />
        </div>
      </aside>

      <div className="conteudo">
        <header className="barra-topo">
          <button
            type="button"
            className="botao-menu"
            onClick={() => setAberto(true)}
            aria-label="Abrir menu"
            aria-expanded={aberto}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 6h18" />
              <path d="M3 12h18" />
              <path d="M3 18h18" />
            </svg>
          </button>

          <div className="ola">
            Olá, <span>{nome.split(" ")[0]}</span>
            <span className="saudacao-extra">
              {" — Bom trabalho hoje!"}
            </span>
          </div>

          <div className="acoes-topo">
            <SinoNotificacoes />

            <AlternarTema />
          </div>
        </header>

        <div className="pagina">
          {children}
        </div>
      </div>
    </div>
  );
}
