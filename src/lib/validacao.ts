import { z } from "zod";

/**
 * Mensagens de validação em português.
 *
 * Sem isto, o que chega na tela do usuário é o texto padrão do zod:
 * "Expected number, received null", "Required", "Invalid email". São
 * mensagens escritas para quem programa, não para quem está lançando uma
 * nota fiscal — e apontam para um problema que a pessoa não tem como
 * relacionar com o campo que ela preencheu.
 *
 * O mapa de erros do zod só é consultado quando o schema NÃO trouxe uma
 * mensagem própria. Ou seja: onde já escrevemos "E-mail inválido." aquele
 * texto continua valendo, e o mapa cobre só o resto.
 */

const NOMES: Record<string, string> = {
  nome: "nome",
  email: "e-mail",
  senha: "senha",
  senhaAtual: "senha atual",
  novaSenha: "nova senha",
  papel: "perfil",
  descricao: "descrição",
  tipo: "tipo",
  categoriaId: "categoria",
  clienteId: "cliente",
  medicaoId: "medição",
  competencia: "competência",
  vencimento: "vencimento",
  identificador: "identificador",
  numero: "número",
  data: "data",
  dataEmissao: "data de emissão",
  dataMedicao: "data da medição",
  dataReferencia: "data de referência",
  periodoInicio: "início do período",
  periodoFim: "fim do período",
  previsaoRecebimento: "previsão de recebimento",
  valor: "valor",
  valorPrevisto: "valor previsto",
  valorMedido: "valor medido",
  valorNota: "valor da nota",
  valorRecibo: "valor do recibo",
  motivo: "motivo",
  estornoDe: "lançamento estornado",
  razaoSocial: "razão social",
  nomeFantasia: "nome fantasia",
  cnpj: "CNPJ",
  ativo: "situação",
  ativa: "situação",
};

function nomeDoCampo(caminho: (string | number)[]): string {
  const ultimo = [...caminho].reverse().find((p) => typeof p === "string") as string | undefined;
  if (!ultimo) return "campo";
  return NOMES[ultimo] ?? ultimo;
}

const mapaEmPortugues: z.ZodErrorMap = (issue, ctx) => {
  const campo = nomeDoCampo(issue.path);

  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      // Campo em branco e campo com tipo errado chegam pelo mesmo código.
      // Para quem preencheu, é a mesma coisa: falta preencher direito.
      if (issue.received === "undefined" || issue.received === "null") {
        return { message: `Informe ${campo}.` };
      }
      if (issue.expected === "number") {
        return { message: `O ${campo} precisa ser um número.` };
      }
      return { message: `Valor inválido em ${campo}.` };

    case z.ZodIssueCode.too_small:
      if (issue.type === "string") {
        return issue.minimum === 1
          ? { message: `Informe ${campo}.` }
          : { message: `O ${campo} precisa ter pelo menos ${issue.minimum} caracteres.` };
      }
      return { message: `O ${campo} precisa ser maior que ${issue.minimum}.` };

    case z.ZodIssueCode.too_big:
      if (issue.type === "string") {
        return { message: `O ${campo} passa do limite de ${issue.maximum} caracteres.` };
      }
      return { message: `O ${campo} não pode passar de ${issue.maximum}.` };

    case z.ZodIssueCode.invalid_string:
      if (issue.validation === "email") return { message: "E-mail inválido." };
      return { message: `Formato inválido em ${campo}.` };

    case z.ZodIssueCode.invalid_enum_value:
      return { message: `Escolha um ${campo} da lista.` };

    case z.ZodIssueCode.invalid_date:
      return { message: `Data inválida em ${campo}.` };

    default:
      return { message: ctx.defaultError };
  }
};

z.setErrorMap(mapaEmPortugues);

/** A primeira coisa errada, dita de um jeito que dá para corrigir. */
export function mensagemDeValidacao(erro: z.ZodError): string {
  return erro.issues[0]?.message ?? "Dados inválidos.";
}
