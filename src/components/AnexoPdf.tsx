"use client";

import { useState } from "react";
import CapturarFoto from "@/components/CapturarFoto";

// A Vercel recusa qualquer envio acima de ~4.5 MB antes mesmo de chegar na
// nossa API — ficar bem abaixo disso evita um envio que "trava" sem erro.
const LIMITE_BYTES = 4 * 1024 * 1024;
const TIPOS_ACEITOS = ["application/pdf", "image/jpeg", "image/png"];

interface AnexoInfo {
  id: string;
  nomeArquivo: string;
  tamanhoBytes: number;
  mimeType?: string;
}

/**
 * Anexos de comprovante (PDF, foto ou imagem) de um lançamento de Custo,
 * Nota Fiscal ou Recibo. Um lançamento pode ter vários anexos; cada um é
 * enviado e removido individualmente.
 */
export default function AnexoPdf({
  tipo, id, anexosIniciais, somenteLeitura,
}: {
  tipo: "custo" | "nota" | "recibo";
  id: string;
  anexosIniciais: AnexoInfo[];
  somenteLeitura: boolean;
}) {
  const [anexos, setAnexos] = useState<AnexoInfo[]>(anexosIniciais);
  const [enviando, setEnviando] = useState(false);
  const [removendoId, setRemovendoId] = useState<string | null>(null);
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [cameraAberta, setCameraAberta] = useState(false);

  const rota = `/api/anexos/${tipo}/${id}`;
  const urlDoAnexo = (anexoId: string) => `${rota}?anexo=${anexoId}`;

  // Um arquivo por requisição: o limite de corpo da hospedagem é bem menor
  // que a soma de várias fotos, e assim um arquivo com problema não derruba
  // os outros do mesmo lote.
  async function enviarArquivos(arquivos: File[]) {
    setErro(null);
    setEnviando(true);
    const falhas: string[] = [];
    try {
      for (const arquivo of arquivos) {
        if (!TIPOS_ACEITOS.includes(arquivo.type)) {
          falhas.push(`${arquivo.name}: somente PDF, JPEG ou PNG.`);
          continue;
        }
        if (arquivo.size > LIMITE_BYTES) {
          falhas.push(`${arquivo.name}: acima de 4 MB.`);
          continue;
        }
        try {
          const formData = new FormData();
          formData.append("arquivo", arquivo);
          const r = await fetch(rota, { method: "POST", body: formData });
          const d = await r.json().catch(() => ({}));
          if (!r.ok) {
            falhas.push(`${arquivo.name}: ${d.erro ?? "não foi possível anexar."}`);
            continue;
          }
          setAnexos((atuais) => [...atuais, ...(d.anexos as AnexoInfo[])]);
        } catch {
          // Uma queda de conexão no meio do envio (comum com arquivo grande em
          // rede instável) não pode passar batido: sem isto, o arquivo some da
          // tela sem explicação nenhuma.
          falhas.push(`${arquivo.name}: falha de conexão durante o envio. Tente novamente.`);
        }
      }
    } finally {
      setEnviando(false);
      if (falhas.length) setErro(falhas.join(" "));
    }
  }

  async function remover(anexoId: string) {
    setErro(null);
    setRemovendoId(anexoId);
    try {
      const r = await fetch(urlDoAnexo(anexoId), { method: "DELETE" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErro(d.erro ?? "Não foi possível remover o anexo.");
        return;
      }
      setAnexos((atuais) => atuais.filter((a) => a.id !== anexoId));
    } finally {
      setRemovendoId(null);
      setConfirmandoId(null);
    }
  }

  return (
    <div className="fm-anexo-pdf">
      {erro && <div className="aviso erro-aviso" style={{ marginBottom: 8 }}>{erro}</div>}

      {anexos.length === 0 && somenteLeitura && <p className="fm-anexo-pdf-vazio">Nenhum anexo.</p>}

      {anexos.map((anexo) => {
        const ehImagem = anexo.mimeType?.startsWith("image/");
        const url = urlDoAnexo(anexo.id);
        return (
          <div key={anexo.id} className="fm-anexo-pdf-atual" style={{ marginBottom: 8 }}>
            {ehImagem && (
              <a href={url} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={anexo.nomeArquivo} className="fm-anexo-pdf-miniatura" />
              </a>
            )}
            <a href={url} target="_blank" rel="noopener noreferrer" className="fm-anexo-pdf-link">
              {ehImagem ? "🖼️" : "📎"} {anexo.nomeArquivo}
              <small>{(anexo.tamanhoBytes / (1024 * 1024)).toFixed(2)} MB</small>
            </a>

            {!somenteLeitura && (
              confirmandoId === anexo.id ? (
                <span className="fm-anexo-pdf-confirmar">
                  Remover este anexo?
                  <button type="button" className="botao perigoso mini" disabled={removendoId === anexo.id} onClick={() => remover(anexo.id)}>
                    {removendoId === anexo.id ? "Removendo…" : "Confirmar"}
                  </button>
                  <button type="button" className="botao discreto mini" disabled={removendoId === anexo.id} onClick={() => setConfirmandoId(null)}>
                    Cancelar
                  </button>
                </span>
              ) : (
                <button type="button" className="botao discreto mini" onClick={() => setConfirmandoId(anexo.id)}>
                  Remover
                </button>
              )
            )}
          </div>
        );
      })}

      {!somenteLeitura && (
        <div className="fm-anexo-pdf-acoes-vazio">
          <label className={`botao discreto mini fm-anexo-pdf-botao ${enviando ? "desabilitado" : ""}`}>
            {enviando ? "Enviando…" : anexos.length ? "+ Anexar mais arquivos" : "+ Anexar arquivos"}
            <input
              type="file"
              multiple
              accept="application/pdf,image/jpeg,image/png"
              style={{ display: "none" }}
              disabled={enviando}
              onChange={(e) => {
                const arquivos = Array.from(e.target.files ?? []);
                e.target.value = "";
                if (arquivos.length) enviarArquivos(arquivos);
              }}
            />
          </label>
          <button
            type="button"
            className="botao discreto mini"
            disabled={enviando}
            onClick={() => setCameraAberta(true)}
          >
            📷 Tirar foto
          </button>
        </div>
      )}

      <CapturarFoto
        aberto={cameraAberta}
        aoFechar={() => setCameraAberta(false)}
        aoCapturar={(arquivo) => enviarArquivos([arquivo])}
        permitirVarias
      />
    </div>
  );
}
