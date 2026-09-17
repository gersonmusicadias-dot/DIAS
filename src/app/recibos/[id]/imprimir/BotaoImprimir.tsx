"use client";

export default function BotaoImprimir() {
  return (
    <div className="acoes-impressao">
      <button type="button" onClick={() => window.print()}>
        Imprimir / Salvar em PDF
      </button>

      <button
        type="button"
        className="secundario"
        onClick={() => window.close()}
      >
        Fechar
      </button>
    </div>
  );
}