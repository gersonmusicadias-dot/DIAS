const unidades = ["","um","dois","três","quatro","cinco","seis","sete","oito","nove"];
const dezADezenove = ["dez","onze","doze","treze","quatorze","quinze","dezesseis","dezessete","dezoito","dezenove"];
const dezenas = ["","","vinte","trinta","quarenta","cinquenta","sessenta","setenta","oitenta","noventa"];
const centenas = ["","cento","duzentos","trezentos","quatrocentos","quinhentos","seiscentos","setecentos","oitocentos","novecentos"];

function ate999(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cem";

  const partes: string[] = [];
  const c = Math.floor(n / 100);
  const resto = n % 100;

  if (c) partes.push(centenas[c]);

  if (resto) {
    let texto = "";

    if (resto < 10) {
      texto = unidades[resto];
    } else if (resto < 20) {
      texto = dezADezenove[resto - 10];
    } else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      texto = dezenas[d] + (u ? ` e ${unidades[u]}` : "");
    }

    if (partes.length) partes.push(`e ${texto}`);
    else partes.push(texto);
  }

  return partes.join(" ");
}

function inteiroPorExtenso(n: number): string {
  if (n === 0) return "zero";

  const grupos = [
    { valor: 1_000_000_000, singular: "bilhão", plural: "bilhões" },
    { valor: 1_000_000, singular: "milhão", plural: "milhões" },
    { valor: 1_000, singular: "mil", plural: "mil" },
  ];

  let restante = n;
  const partes: string[] = [];

  for (const grupo of grupos) {
    const qtd = Math.floor(restante / grupo.valor);

    if (qtd > 0) {
      if (grupo.valor === 1_000 && qtd === 1) {
        partes.push("mil");
      } else {
        partes.push(`${inteiroPorExtenso(qtd)} ${qtd === 1 ? grupo.singular : grupo.plural}`);
      }
      restante %= grupo.valor;
    }
  }

  if (restante > 0) partes.push(ate999(restante));

  return partes.join(" e ");
}

export function valorPorExtenso(valor: number): string {
  const totalCentavos = Math.round(Math.abs(valor) * 100);
  const reais = Math.floor(totalCentavos / 100);
  const centavos = totalCentavos % 100;

  const partes: string[] = [];

  if (reais > 0) {
    partes.push(`${inteiroPorExtenso(reais)} ${reais === 1 ? "real" : "reais"}`);
  }

  if (centavos > 0) {
    partes.push(`${inteiroPorExtenso(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`);
  }

  if (!partes.length) return "zero reais";

  return partes.join(" e ");
}