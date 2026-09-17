import { NextResponse } from "next/server";
import { sessaoAtual, type Sessao } from "./sessao";

/**
 * Guarda das rotas de API.
 *
 * O middleware protege as PÁGINAS, mas rotas de /api ficam fora dele de
 * propósito — precisam responder 401 em vez de redirecionar. Então a
 * verificação tem de ser feita aqui, e tem de incluir a troca de senha
 * pendente: quem só tem a senha provisória não pode chamar API nenhuma
 * antes de definir a sua. Sem isso, uma senha provisória vazada daria
 * acesso aos dados sem nunca passar pela troca.
 */

type Recusa = { erro: NextResponse; sessao?: never };
type Aprovacao = { erro?: never; sessao: Sessao };

export async function exigirSessao(): Promise<Recusa | Aprovacao> {
  const sessao = await sessaoAtual();

  if (!sessao) {
    return { erro: NextResponse.json({ erro: "Sessão expirada." }, { status: 401 }) };
  }

  if (sessao.trocarSenha) {
    return {
      erro: NextResponse.json(
        { erro: "Defina sua senha definitiva antes de continuar.", proximo: "/primeiro-acesso" },
        { status: 403 }
      ),
    };
  }

  return { sessao };
}

export async function exigirAdmin(): Promise<Recusa | Aprovacao> {
  const resultado = await exigirSessao();
  if (resultado.erro) return resultado;

  if (resultado.sessao.papel !== "ADMIN") {
    return {
      erro: NextResponse.json(
        { erro: "Esta ação é restrita a administradores." },
        { status: 403 }
      ),
    };
  }

  return resultado;
}

/**
 * Para quem vai GRAVAR. Perfil LEITURA passa em exigirSessao (pode
 * consultar) mas não pode alterar nada.
 */
export async function podeGravar(): Promise<Recusa | Aprovacao> {
  const resultado = await exigirSessao();
  if (resultado.erro) return resultado;

  if (resultado.sessao.papel === "LEITURA") {
    return {
      erro: NextResponse.json(
        { erro: "Seu perfil é somente leitura." },
        { status: 403 }
      ),
    };
  }

  return resultado;
}
