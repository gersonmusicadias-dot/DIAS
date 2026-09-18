"use client";

import { useState } from "react";

const LIMITE_BYTES = 10 * 1024 * 1024;

interface AnexoInfo {
  nomeArquivo: string;
  tamanhoBytes: number;
}

/**
 * Anexo de PDF (nota fiscal digitalizada, comprovante, recibo escaneado)
 * para um lançamento de Custo, Nota Fiscal ou Recibo. Um lançamento tem no
 * máximo um PDF — enviar de novo substitui o anterior.
 */
export default function AnexoPdf({
  tipo, id, anexoInicial, somenteLeitura,
}: {
  tipo: "custo" | "nota" | "recibo";
  id: string;
  anexoInicial: AnexoInfo | null;
  somenteLeitura: boolean;
}) {
  const [anexo, setAnexo] = useState<AnexoInfo | null>(anexoInicial);
  const [enviando, setEnviando] = useState(false);
  const [confirmandoRemocao, setConfirmandoRemocao] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const rota = `/api/anexos/${tipo}/${id}`;

  async function enviarArquivo(arquivo: File) {
    setErro(null);
    if (arquivo.type !== "application/pdf") {
      setErro("Selecione um arquivo PDF.");
      return;
    }
    if (arquivo.size > LIMITE_BYTES) {
      setErro("O PDF não pode ultrapassar 10 MB.");
      return;
    }

    setEnviando(true);
    try {
      const formData = new FormData();
      formData.append("arquivo", arquivo);
      const r = await fetch(rota, { method: "POST", body: formData });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErro(d.erro ?? "Não foi possível anexar o arquivo.");
        return;
      }
      setAnexo({ nomeArquivo: d.anexo.nomeArquivo, tamanhoBytes: d.anexo.tamanhoBytes });
    } finally {
      setEnviando(false);
    }
  }

  async function remover() {
    setErro(null);
    setEnviando(true);
    try {
      const r = await fetch(rota, { method: "DELETE" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErro(d.erro ?? "Não foi possível remover o anexo.");
        return;
      }
      setAnexo(null);
    } finally {
      setEnviando(false);
      setConfirmandoRemocao(false);
    }
  }

  return (
    <div className="fm-anexo-pdf">
      {erro && <div className="aviso erro-aviso" style={{ marginBottom: 8 }}>{erro}</div>}

      {anexo ? (
        <div className="fm-anexo-pdf-atual">
          <a href={rota} target="_blank" rel="noopener noreferrer" className="fm-anexo-pdf-link">
            📎 {anexo.nomeArquivo}
            <small>{(anexo.tamanhoBytes / (1024 * 1024)).toFixed(2)} MB</small>
          </a>

          {!somenteLeitura && (
            confirmandoRemocao ? (
              <span className="fm-anexo-pdf-confirmar">
                Remover este anexo?
                <button type="button" className="botao perigoso mini" disabled={enviando} onClick={remover}>
                  {enviando ? "Removendo…" : "Confirmar"}
                </button>
                <button type="button" className="botao discreto mini" disabled={enviando} onClick={() => setConfirmandoRemocao(false)}>
                  Cancelar
                </button>
              </span>
            ) : (
              <button type="button" className="botao discreto mini" onClick={() => setConfirmandoRemocao(true)}>
                Remover
              </button>
            )
          )}
        </div>
      ) : somenteLeitura ? (
        <p className="fm-anexo-pdf-vazio">Nenhum PDF anexado.</p>
      ) : (
        <label className={`botao discreto mini fm-anexo-pdf-botao ${enviando ? "desabilitado" : ""}`}>
          {enviando ? "Enviando…" : "+ Anexar PDF"}
          <input
            type="file"
            accept="application/pdf"
            style={{ display: "none" }}
            disabled={enviando}
            onChange={(e) => {
              const arquivo = e.target.files?.[0];
              e.target.value = "";
              if (arquivo) enviarArquivo(arquivo);
            }}
          />
        </label>
      )}
    </div>
  );
}
