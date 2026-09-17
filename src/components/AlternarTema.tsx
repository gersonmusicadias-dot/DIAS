"use client";

import { useEffect, useState } from "react";

type Tema = "escuro" | "claro";

function aplicar(tema: Tema) {
  document.documentElement.dataset.theme = tema;
  document.documentElement.classList.toggle("light", tema === "claro");
  localStorage.setItem("fluxomed_tema", tema);
}

export default function AlternarTema({
  variante = "icone",
}: {
  variante?: "icone" | "login";
}) {
  const [tema, setTema] = useState<Tema>("escuro");

  useEffect(() => {
    const salvo = localStorage.getItem("fluxomed_tema");
    const inicial: Tema = salvo === "claro" ? "claro" : "escuro";
    setTema(inicial);
    aplicar(inicial);
  }, []);

  const alternar = () => {
    const proximo: Tema = tema === "escuro" ? "claro" : "escuro";
    setTema(proximo);
    aplicar(proximo);
  };

  if (variante === "login") {
    return (
      <div className="login-tema" aria-label="Alternar tema">
        <span className={tema === "claro" ? "ativo" : ""}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41" />
          </svg>
          Claro
        </span>

        <button
          type="button"
          className={`login-tema-switch ${tema === "escuro" ? "escuro" : "claro"}`}
          onClick={alternar}
          aria-label={tema === "escuro" ? "Ativar modo claro" : "Ativar modo escuro"}
        >
          <i />
        </button>

        <span className={tema === "escuro" ? "ativo" : ""}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
          </svg>
          Escuro
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="icone-topo"
      onClick={alternar}
      aria-label={tema === "escuro" ? "Ativar modo claro" : "Ativar modo escuro"}
      title={tema === "escuro" ? "Modo claro" : "Modo escuro"}
    >
      {tema === "escuro" ? (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
        </svg>
      )}
    </button>
  );
}
