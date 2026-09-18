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

const DATA_REGEX = /(\d{1,2})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(\d{2,4})/g;
const HORA_REGEX = /\d{1,2}:\d{2}(?::\d{2})?/;

function dataValida(dia: number, mes: number, anoBruto: string): string | null {
  const ano = Number(anoBruto.length === 2 ? `20${anoBruto}` : anoBruto);
  if (mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31 && ano >= 2000 && ano <= 2100) {
    return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  }
  return null;
}

/**
 * Datas em formato brasileiro (DD/MM/AAAA, DD-MM-AA etc). Um cupom fiscal
 * (NFC-e) tem várias sequências de números que parecem data (CNPJ, número de
 * protocolo...), então a prioridade é uma data seguida de perto por um
 * horário (HH:MM ou HH:MM:SS) — isso é a assinatura da linha de emissão, e
 * dificilmente aparece por acaso num CNPJ. Só na ausência disso caímos de
 * volta para a primeira data plausível encontrada em qualquer lugar.
 */
function extrairData(texto: string): string | null {
  const candidatos = Array.from(texto.matchAll(DATA_REGEX));

  for (const m of candidatos) {
    const resto = texto.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 20);
    if (HORA_REGEX.test(resto.slice(0, 12))) {
      const data = dataValida(Number(m[1]), Number(m[2]), m[3]);
      if (data) return data;
    }
  }

  for (const m of candidatos) {
    const data = dataValida(Number(m[1]), Number(m[2]), m[3]);
    if (data) return data;
  }

  return null;
}

const VALOR_REGEX = /(\d{1,3}(?:\.\d{3})*,\d{2})/g;

function numerosDaLinha(linha: string): number[] {
  return Array.from(linha.matchAll(VALOR_REGEX))
    .map((m) => parseFloat(m[1].replace(/\./g, "").replace(",", ".")))
    .filter((v) => Number.isFinite(v) && v > 0);
}

/**
 * Valores em formato brasileiro (1.234,56). Um cupom fiscal traz vários
 * números (preço de cada item, subtotal, troco...), então em vez de pegar o
 * maior número do documento inteiro, procuramos especificamente a linha do
 * "Valor Total" — ignorando linhas como "QTD. TOTAL DE ITENS" ou "Subtotal",
 * que também contêm a palavra "total" mas não são o valor a pagar.
 */
function extrairValor(texto: string): number | null {
  const linhas = texto.split(/\r?\n/);

  const ehLinhaDeItensOuSubtotal = (linhaBaixa: string) =>
    linhaBaixa.includes("itens") || linhaBaixa.includes("quantidade") || linhaBaixa.includes("qtd") || linhaBaixa.includes("subtotal");

  // 1ª prioridade: uma linha com "valor total" explícito.
  for (const linha of linhas) {
    const linhaBaixa = linha.toLowerCase();
    if (linhaBaixa.includes("valor total") && !ehLinhaDeItensOuSubtotal(linhaBaixa)) {
      const numeros = numerosDaLinha(linha);
      if (numeros.length) return Math.max(...numeros);
    }
  }

  // 2ª prioridade: qualquer linha com "total" que não seja de itens/subtotal.
  for (const linha of linhas) {
    const linhaBaixa = linha.toLowerCase();
    if (linhaBaixa.includes("total") && !ehLinhaDeItensOuSubtotal(linhaBaixa)) {
      const numeros = numerosDaLinha(linha);
      if (numeros.length) return Math.max(...numeros);
    }
  }

  // Sem nenhuma linha de total reconhecível: cai no maior número do texto.
  const candidatos = numerosDaLinha(texto);
  return candidatos.length ? Math.max(...candidatos) : null;
}

export async function reconhecerComprovante(arquivo: File): Promise<ReconhecimentoComprovante> {
  const { recognize } = await import("tesseract.js");
  const imagem = await paraImagemReconhecivel(arquivo);
  const resultado = await recognize(imagem, "por");
  const texto = resultado.data.text || "";
  return { data: extrairData(texto), valor: extrairValor(texto), texto };
}
