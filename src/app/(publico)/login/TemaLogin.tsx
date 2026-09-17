"use client";

import { useEffect, useState } from "react";

type Tema = "dark" | "light";

function aplicarTema(tema: Tema) {
  const html = document.documentElement;

  if (tema === "dark") {
    html.classList.add("dark");
  } else {
    html.classList.remove("dark");
  }

  localStorage.setItem("fluxomed-theme", tema);
}

export default function TemaLogin() {
  const [tema, setTema] = useState<Tema>("dark");

  useEffect(() => {
    const salvo = localStorage.getItem("fluxomed-theme");
    const inicial: Tema = salvo === "light" ? "light" : "dark";

    setTema(inicial);
    aplicarTema(inicial);
  }, []);

  function alternar() {
    const proximo: Tema = tema === "dark" ? "light" : "dark";
    setTema(proximo);
    aplicarTema(proximo);
  }

  return (
    <div className="fx-tema">
      <span className={tema === "light" ? "ativo" : ""}>Claro</span>

      <button
        type="button"
        className="fx-tema-switch"
        onClick={alternar}
        aria-label="Alternar entre modo claro e escuro"
        aria-pressed={tema === "dark"}
      >
        <i />
      </button>

      <span className={tema === "dark" ? "ativo" : ""}>Escuro</span>
    </div>
  );
}
