"use client";

/**
 * Leitura automática de comprovantes (PDF, foto ou imagem escaneada).
 *
 * PDF não tem "texto de imagem" pronto para o Tesseract — a primeira página é
 * primeiro desenhada num canvas (via pdf.js) e só depois lida como imagem.
 * Fotos e PNG/JPEG já vão direto para o reconhecimento.
 */

export interface ReconhecimentoComprovante {
  data: string | null; // AAAA-MM-DD
  valor: number | null;
  texto: string;
}

async function paraImagemReconhecivel(arquivo: File): Promise<File | HTMLCanvasElement> {
  if (arquivo.type !== "application/pdf") return arquivo;

  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const bytes = await arquivo.arrayBuffer();
  const documento = await pdfjsLib.getDocument({ data: bytes }).promise;
  const pagina = await documento.getPage(1);
  const viewport = pagina.getViewport({ scale: 2 });

  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const contexto = canvas.getContext("2d");
  if (!contexto) throw new Error("Não foi possível preparar o PDF para leitura.");

  await pagina.render({ canvasContext: contexto, viewport, canvas }).promise;
  return canvas;
}

/**
 * Datas em formato brasileiro (DD/MM/AAAA, DD-MM-AA etc). Entre várias
 * encontradas no texto, a primeira que forma uma data plausível vence — um
 * comprovante costuma trazer a data de emissão logo no topo.
 */
function extrairData(texto: string): string | null {
  const candidatos = Array.from(texto.matchAll(/(\d{1,2})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(\d{2,4})/g));
  for (const m of candidatos) {
    const dia = Number(m[1]);
    const mes = Number(m[2]);
    const anoBruto = m[3];
    const ano = Number(anoBruto.length === 2 ? `20${anoBruto}` : anoBruto);
    if (mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31 && ano >= 2000 && ano <= 2100) {
      return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
    }
  }
  return null;
}

/**
 * Valores em formato brasileiro (1.234,56). Entre vários números no
 * comprovante (subtotal, taxa, total...), o maior costuma ser o total —
 * heurística simples, mas melhor do que pegar o primeiro número que aparece.
 */
function extrairValor(texto: string): number | null {
  const candidatos = Array.from(texto.matchAll(/(\d{1,3}(?:\.\d{3})*,\d{2})/g))
    .map((m) => parseFloat(m[1].replace(/\./g, "").replace(",", ".")))
    .filter((v) => Number.isFinite(v) && v > 0);
  if (candidatos.length === 0) return null;
  return Math.max(...candidatos);
}

export async function reconhecerComprovante(arquivo: File): Promise<ReconhecimentoComprovante> {
  const { recognize } = await import("tesseract.js");
  const imagem = await paraImagemReconhecivel(arquivo);
  const resultado = await recognize(imagem, "por");
  const texto = resultado.data.text || "";
  return { data: extrairData(texto), valor: extrairValor(texto), texto };
}
