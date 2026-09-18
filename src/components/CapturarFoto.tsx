"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Câmera com pré-visualização antes de salvar: tira a foto para um canvas
 * (sem enviar nada ainda), mostra como ficou, e só vira um File de verdade
 * quando a pessoa confirma — "Tirar novamente" descarta e reabre a câmera.
 */
export default function CapturarFoto({
  aberto, aoFechar, aoCapturar,
}: {
  aberto: boolean;
  aoFechar: () => void;
  aoCapturar: (arquivo: File) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [foto, setFoto] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto) return;
    setFoto(null);
    setErro(null);
    let cancelado = false;

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((stream) => {
        if (cancelado) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => setErro("Não foi possível acessar a câmera. Verifique a permissão do navegador."));

    return () => {
      cancelado = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [aberto]);

  function capturar() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    setFoto(canvas.toDataURL("image/jpeg", 0.92));
  }

  function usarFoto() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        aoCapturar(new File([blob], `foto-${Date.now()}.jpg`, { type: "image/jpeg" }));
        fecharTudo();
      },
      "image/jpeg",
      0.92
    );
  }

  function fecharTudo() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setFoto(null);
    aoFechar();
  }

  if (!aberto) return null;

  return (
    <div className="fm-camera-overlay" role="dialog" aria-modal="true" aria-label="Tirar foto do comprovante" onClick={(e) => { if (e.target === e.currentTarget) fecharTudo(); }}>
      <div className="fm-camera-caixa" onClick={(e) => e.stopPropagation()}>
        <div className="fm-camera-cabecalho">
          <h3>Tirar foto do comprovante</h3>
          <button type="button" className="fm-custo-modal-fechar" onClick={fecharTudo} aria-label="Fechar">×</button>
        </div>

        {erro && <div className="aviso erro-aviso">{erro}</div>}

        <div className="fm-camera-visor">
          {foto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={foto} alt="Prévia da foto capturada" />
          ) : (
            <video ref={videoRef} autoPlay playsInline muted />
          )}
        </div>
        <canvas ref={canvasRef} style={{ display: "none" }} />

        <div className="fm-camera-acoes">
          {foto ? (
            <>
              <button type="button" className="botao discreto" onClick={() => setFoto(null)}>Tirar novamente</button>
              <button type="button" className="botao" onClick={usarFoto}>Usar esta foto</button>
            </>
          ) : (
            <button type="button" className="botao" onClick={capturar} disabled={!!erro}>Capturar</button>
          )}
        </div>
      </div>
    </div>
  );
}
