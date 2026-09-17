/**
 * Vocabulário fixo do domínio.
 *
 * Estava repetido em cinco arquivos, com uma ordem diferente em cada um.
 * Repetido assim, uma correção futura teria de acertar todos, e bastaria
 * esquecer um para que a validação do servidor e a lista da tela deixassem
 * de concordar.
 */

export const TIPOS_CUSTO = ["Custo Fixo", "Custo Direto", "Custo Indireto"] as const;
export type TipoCusto = (typeof TIPOS_CUSTO)[number];

export const TIPO_CUSTO_PADRAO: TipoCusto = "Custo Fixo";
