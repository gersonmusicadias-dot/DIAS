"use client";

import { useEffect, useRef } from "react";

/**
 * Confirmação de uma ação que muda a vida de alguém.
 *
 * Existe para que toda pergunta do tipo "tem certeza?" tenha a mesma cara e
 * o mesmo comportamento em todos os módulos: Esc fecha, clicar no fundo
 * fecha, o foco começa no botão de cancelar (o inofensivo) e o botão de
 * confirmar diz o que vai acontecer, não "OK".
 */
export default function ModalConfirmacao({
  titulo,
  confirmar,
  aoConfirmar,
  aoCancelar,
  perigo = false,
  ocupado = false,
  children,
}: {
  titulo: string;
  confirmar: string;
  aoConfirmar: () => void;
  aoCancelar: () => void;
  perigo?: boolean;
  ocupado?: boolean;
  children: React.ReactNode;
}) {
  const cancelar = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelar.current?.focus();
    function tecla(e: KeyboardEvent) {
      if (e.key === "Escape" && !ocupado) aoCancelar();
    }
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [aoCancelar, ocupado]);

  return (
    <div
      className="modal-fundo"
      onClick={(e) => { if (e.target === e.currentTarget && !ocupado) aoCancelar(); }}
    >
      <div className="modal-caixa estreita" role="dialog" aria-modal="true" aria-label={titulo}>
        <header className="modal-topo">
          <div><h3>{titulo}</h3></div>
          <button type="button" className="fechar" onClick={aoCancelar}
            disabled={ocupado} aria-label="Fechar">×</button>
        </header>

        <div className="modal-corpo texto-modal">{children}</div>

        <footer className="modal-acoes">
          <button ref={cancelar} type="button" className="botao discreto"
            onClick={aoCancelar} disabled={ocupado}>
            Cancelar
          </button>
          <button type="button" className={perigo ? "botao perigoso" : "botao"}
            onClick={aoConfirmar} disabled={ocupado}>
            {ocupado ? "Aguarde…" : confirmar}
          </button>
        </footer>
      </div>
    </div>
  );
}
