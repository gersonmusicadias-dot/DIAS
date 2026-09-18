/** Formatação e utilidades de tela, num lugar só. */

export const real = (v: number) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

export const dataBR = (d?: string | null) =>
  d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d.split("-").reverse().join("/") : "—";

export const compBR = (c?: string | null) =>
  c && /^\d{4}-\d{2}$/.test(c) ? `${c.slice(5)}/${c.slice(0, 4)}` : "—";

/**
 * `toISOString()` sempre devolve a data em UTC — em Maricá (UTC-3), das 21h
 * à meia-noite ela já mostra o dia seguinte. Fixamos o fuso explicitamente
 * para essas datas padrão de formulário baterem com o dia local de verdade.
 */
const hojeEmSaoPaulo = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

export const hojeISO = () => hojeEmSaoPaulo();
export const competenciaHoje = () => hojeEmSaoPaulo().slice(0, 7);

/**
 * Lê um valor digitado por gente, no formato brasileiro.
 *
 *   "8.000,00" -> 8000      "1.234,56" -> 1234.56      "8.000" -> 8000
 *   "1234,56"  -> 1234.56   "1234.56"  -> 1234.56      "12"    -> 12
 *
 * O ponto é ambíguo: em "8.000" separa milhar, em "1234.56" separa decimal.
 * A desambiguação é pelo formato — ponto seguido de exatamente três dígitos,
 * e nada depois, é milhar. Errar isso não dá erro na tela: grava um valor mil
 * vezes menor e ninguém percebe até fechar o mês.
 */
export const paraNumero = (texto: string): number => {
  const bruto = String(texto).trim().replace(/\s/g, "");
  if (!bruto) return NaN;
  if (!/^-?[\d.,]+$/.test(bruto)) return NaN;

  const negativo = bruto.startsWith("-");
  const corpo = negativo ? bruto.slice(1) : bruto;

  let limpo: string;
  if (corpo.includes(",")) {
    // Tem vírgula: ela é a decimal, e todo ponto é separador de milhar.
    if ((corpo.match(/,/g) || []).length > 1) return NaN;
    limpo = corpo.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(corpo)) {
    // Só pontos, todos separando grupos de três: milhar.
    limpo = corpo.replace(/\./g, "");
  } else {
    // Um ponto solto em outra posição: decimal.
    if ((corpo.match(/\./g) || []).length > 1) return NaN;
    limpo = corpo;
  }

  const n = Number(limpo);
  return Number.isFinite(n) ? (negativo ? -n : n) : NaN;
};

export const classeSelo = (situacao: string): string => {
  const s = situacao.toUpperCase();
  if (s.includes("RECEBID") && !s.includes("PARCIAL")) return "ok";
  if (s === "PAGO" || s === "MEDIDA") return "ok";
  if (s.includes("PARCIAL")) return "espera";
  if (s === "EMITIDA" || s === "EMITIDO") return "espera";
  return "off";
};
