"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ClipboardEvent
} from "react";

import { paraNumero } from "@/lib/ui";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value"> & {
  value: string | number;
};

function separarValor(valor: string | number) {
  const texto = String(valor ?? "").trim();

  if (!texto) {
    return { inteiro: "", decimais: "" };
  }

  const numero = paraNumero(texto);

  if (!Number.isFinite(numero)) {
    return { inteiro: "", decimais: "" };
  }

  const [inteiro, decimais] = numero.toFixed(2).split(".");

  return {
    inteiro,
    decimais: decimais === "00" ? "" : decimais
  };
}

function formatar(inteiro: string, decimais: string) {
  if (!inteiro) return "";

  const numeroInteiro = Number(inteiro || "0");

  const parteInteira = numeroInteiro.toLocaleString("pt-BR", {
    maximumFractionDigits: 0
  });

  return `${parteInteira},${decimais.padEnd(2, "0").slice(0, 2)}`;
}

export default function CampoMoeda({
  value,
  onChange,
  onFocus,
  onBlur,
  placeholder = "0,00",
  ...props
}: Props) {
  const inicial = separarValor(value);

  const [inteiro, setInteiro] = useState(inicial.inteiro);
  const [decimais, setDecimais] = useState(inicial.decimais);
  const [modoDecimal, setModoDecimal] = useState(false);
  const [focado, setFocado] = useState(false);

  const ref = useRef<HTMLInputElement>(null);

  const texto = formatar(inteiro, decimais);

  useEffect(() => {
    if (focado) return;

    const novo = separarValor(value);
    setInteiro(novo.inteiro);
    setDecimais(novo.decimais);
  }, [value, focado]);

  function emitir(
    novoInteiro: string,
    novosDecimais: string,
    evento?: ChangeEvent<HTMLInputElement>
  ) {
    setInteiro(novoInteiro);
    setDecimais(novosDecimais);

    const valorFormatado = formatar(novoInteiro, novosDecimais);

    if (evento) {
      evento.target.value = valorFormatado;
      onChange?.(evento);
      return;
    }

    if (onChange) {
      onChange({
        target: { value: valorFormatado },
        currentTarget: { value: valorFormatado }
      } as ChangeEvent<HTMLInputElement>);
    }
  }

  function tudoSelecionado() {
    const input = ref.current;
    if (!input) return false;

    return (
      input.selectionStart === 0 &&
      input.selectionEnd === input.value.length
    );
  }

  function tecla(e: KeyboardEvent<HTMLInputElement>) {
    if (e.ctrlKey || e.metaKey) return;

    if (/^\d$/.test(e.key)) {
      e.preventDefault();

      if (tudoSelecionado()) {
        setModoDecimal(false);
        emitir(e.key, "");
        return;
      }

      if (modoDecimal) {
        if (decimais.length >= 2) return;

        emitir(inteiro || "0", decimais + e.key);
        return;
      }

      const novo = `${inteiro}${e.key}`.replace(/^0+(?=\d)/, "");
      emitir(novo, decimais);
      return;
    }

    if (e.key === "," || e.key === ".") {
      e.preventDefault();

      if (!inteiro) {
        emitir("0", "");
      }

      setModoDecimal(true);
      return;
    }

    if (e.key === "Backspace") {
      e.preventDefault();

      if (tudoSelecionado()) {
        setModoDecimal(false);
        emitir("", "");
        return;
      }

      if (modoDecimal) {
        if (decimais.length > 0) {
          emitir(inteiro, decimais.slice(0, -1));
        } else {
          setModoDecimal(false);
        }
        return;
      }

      emitir(inteiro.slice(0, -1), decimais);
      return;
    }

    if (e.key === "Delete" && tudoSelecionado()) {
      e.preventDefault();
      setModoDecimal(false);
      emitir("", "");
    }
  }

  function colar(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();

    const colado = e.clipboardData.getData("text");
    const numero = paraNumero(colado);

    if (!Number.isFinite(numero)) return;

    const [i, d] = numero.toFixed(2).split(".");

    setModoDecimal(false);
    emitir(i, d === "00" ? "" : d);
  }

  return (
    <input
      {...props}
      ref={ref}
      type="text"
      inputMode="decimal"
      value={texto}
      placeholder={placeholder}
      onKeyDown={tecla}
      onPaste={colar}
      onChange={(e) => {
        if (!e.target.value) {
          emitir("", "", e);
        }
      }}
      onFocus={(e) => {
        setFocado(true);
        setModoDecimal(false);

        requestAnimationFrame(() => {
          ref.current?.select();
        });

        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocado(false);
        setModoDecimal(false);
        onBlur?.(e);
      }}
    />
  );
}
