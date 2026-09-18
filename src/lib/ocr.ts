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

async function pdfParaCanvas(arquivo: File): Promise<HTMLCanvasElement> {
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

async function imagemParaCanvas(arquivo: File): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(arquivo);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas;
}

const LARGURA_MINIMA_OCR = 1800;

function paraCinza(canvas: HTMLCanvasElement): { cinza: Float32Array; width: number; height: number } {
  const contexto = canvas.getContext("2d")!;
  const { width, height } = canvas;
  const dados = contexto.getImageData(0, 0, width, height).data;
  const cinza = new Float32Array(width * height);
  for (let i = 0, p = 0; p < cinza.length; i += 4, p++) {
    cinza[p] = 0.299 * dados[i] + 0.587 * dados[i + 1] + 0.114 * dados[i + 2];
  }
  return { cinza, width, height };
}

/**
 * Uma foto de celular tem ruído de sensor (grão), mais visível com pouca
 * luz — exatamente a situação de um cupom fotografado dentro de um
 * estabelecimento. Uma média 3x3 suaviza esse grão sem borrar de verdade o
 * traço das letras, que é bem mais largo que um pixel de ruído.
 */
function desfoqueCaixa3x3(cinza: Float32Array, width: number, height: number): Float32Array {
  const saida = new Float32Array(cinza.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let soma = 0;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= width) continue;
          soma += cinza[yy * width + xx];
          n++;
        }
      }
      saida[y * width + x] = soma / n;
    }
  }
  return saida;
}

/**
 * Esticar o contraste pelo mínimo/máximo absolutos é frágil: um único pixel
 * de ruído mais escuro ou mais claro que o normal já distorce a escala
 * inteira. Usar os percentis 2% e 98% em vez dos extremos ignora esses
 * poucos pixels fora da curva e mantém o restante da imagem bem distribuído
 * entre preto e branco.
 */
function contrastePorPercentil(cinza: Float32Array): Uint8ClampedArray {
  // Histograma de 256 baldes em vez de ordenar milhões de pixels: uma foto em
  // resolução alta tem pixels demais para um sort caber num orçamento de
  // tempo razoável na thread principal, e um histograma dá o mesmo percentil
  // com uma única passada.
  const histograma = new Uint32Array(256);
  for (let i = 0; i < cinza.length; i++) {
    histograma[Math.max(0, Math.min(255, Math.round(cinza[i])))]++;
  }
  const alvoBaixo = cinza.length * 0.02;
  const alvoAlto = cinza.length * 0.98;
  let acumulado = 0;
  let p2 = 0;
  let p98 = 255;
  for (let v = 0; v < 256; v++) {
    acumulado += histograma[v];
    if (acumulado >= alvoBaixo) { p2 = v; break; }
  }
  acumulado = 0;
  for (let v = 0; v < 256; v++) {
    acumulado += histograma[v];
    if (acumulado >= alvoAlto) { p98 = v; break; }
  }

  const amplitude = Math.max(1, p98 - p2);
  const saida = new Uint8ClampedArray(cinza.length);
  for (let i = 0; i < cinza.length; i++) {
    saida[i] = Math.round(((cinza[i] - p2) * 255) / amplitude);
  }
  return saida;
}

/**
 * Fotos tiradas com o celular costumam ter letra pequena em relação ao
 * tamanho da imagem e ruído/contraste fraco por causa da iluminação — o que
 * mais atrapalha o Tesseract. Antes de ler: tons de cinza, um desfoque leve
 * para tirar o grão do sensor, contraste esticado pelos percentis (preto e
 * branco bem definidos sem depender de pixels isolados) e, só então, a
 * ampliação para o texto ficar grande o bastante para o reconhecimento.
 */
function prepararParaOcr(origem: HTMLCanvasElement): HTMLCanvasElement {
  const { cinza, width, height } = paraCinza(origem);
  const desfocado = desfoqueCaixa3x3(cinza, width, height);
  const contrastado = contrastePorPercentil(desfocado);

  const base = document.createElement("canvas");
  base.width = width;
  base.height = height;
  const contextoBase = base.getContext("2d");
  if (!contextoBase) return origem;
  const imagemBase = contextoBase.createImageData(width, height);
  for (let p = 0, i = 0; p < contrastado.length; p++, i += 4) {
    imagemBase.data[i] = contrastado[p];
    imagemBase.data[i + 1] = contrastado[p];
    imagemBase.data[i + 2] = contrastado[p];
    imagemBase.data[i + 3] = 255;
  }
  contextoBase.putImageData(imagemBase, 0, 0);

  if (width >= LARGURA_MINIMA_OCR) return base;

  const fator = LARGURA_MINIMA_OCR / width;
  const ampliado = document.createElement("canvas");
  ampliado.width = Math.round(width * fator);
  ampliado.height = Math.round(height * fator);
  const contextoAmpliado = ampliado.getContext("2d");
  if (!contextoAmpliado) return base;
  contextoAmpliado.imageSmoothingEnabled = true;
  contextoAmpliado.imageSmoothingQuality = "high";
  contextoAmpliado.drawImage(base, 0, 0, ampliado.width, ampliado.height);
  return ampliado;
}

async function paraImagemReconhecivel(arquivo: File): Promise<HTMLCanvasElement> {
  const canvas = arquivo.type === "application/pdf"
    ? await pdfParaCanvas(arquivo)
    : await imagemParaCanvas(arquivo);
  return prepararParaOcr(canvas);
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

  // 1ª prioridade: uma linha com "valor total" ou "total a pagar" explícito.
  for (const linha of linhas) {
    const linhaBaixa = linha.toLowerCase();
    if (
      (linhaBaixa.includes("valor total") || linhaBaixa.includes("total a pagar") || linhaBaixa.includes("a pagar")) &&
      !ehLinhaDeItensOuSubtotal(linhaBaixa)
    ) {
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
  const { createWorker, PSM } = await import("tesseract.js");
  const imagem = await paraImagemReconhecivel(arquivo);

  const worker = await createWorker("por");
  try {
    // Cupom fiscal é essencialmente uma coluna única de texto (largura
    // estreita) — um bloco uniforme funciona melhor que a segmentação
    // automática, que tende a espalhar as linhas de um recibo estreito.
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
    const resultado = await worker.recognize(imagem);
    const texto = resultado.data.text || "";
    return { data: extrairData(texto), valor: extrairValor(texto), texto };
  } finally {
    await worker.terminate();
  }
}
