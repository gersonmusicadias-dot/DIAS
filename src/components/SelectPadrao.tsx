"use client";

import { useEffect, useRef, useState } from "react";

type Opcao = {
  value: string;
  label: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: Opcao[];
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  ariaLabel?: string;
};

export default function SelectPadrao({
  value,
  onChange,
  options,
  placeholder = "Selecione",
  disabled = false,
  id,
  ariaLabel,
}: Props) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selecionada = options.find((op) => op.value === value);

  useEffect(() => {
    function fechar(evento: MouseEvent) {
      if (ref.current && !ref.current.contains(evento.target as Node)) {
        setAberto(false);
      }
    }

    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, []);

  return (
    <div
      ref={ref}
      className={`select-padrao ${aberto ? "aberto" : ""} ${disabled ? "desabilitado" : ""}`}
    >
      <button
        id={id}
        type="button"
        className="select-padrao-botao"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        onClick={() => !disabled && setAberto((v) => !v)}
      >
        <span className={!selecionada ? "select-padrao-placeholder" : ""}>
          {selecionada?.label ?? placeholder}
        </span>
        <span className="select-padrao-seta" aria-hidden="true">⌄</span>
      </button>

      {aberto && !disabled && (
        <div className="select-padrao-lista" role="listbox">
          {options.map((opcao) => (
            <button
              key={opcao.value}
              type="button"
              role="option"
              aria-selected={opcao.value === value}
              className={`select-padrao-opcao ${opcao.value === value ? "selecionada" : ""}`}
              onClick={() => {
                onChange(opcao.value);
                setAberto(false);
              }}
            >
              {opcao.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
