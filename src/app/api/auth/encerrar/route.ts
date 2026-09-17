import { NextResponse } from "next/server";
import { limparCookie, sessaoAtual, tokenDoCookie } from "@/lib/auth/sessao";

/**
 * Saída de emergência para o cookie que ainda tem assinatura válida mas não
 * corresponde mais a uma sessão viva — conta apagada, conta inativada,
 * sessão revogada.
 *
 * Sem esta rota haveria um laço: o middleware, que só sabe conferir a
 * assinatura, mandaria a pessoa para o painel; o layout, que confere no
 * banco, mandaria de volta para o login; e assim por diante. Aqui o cookie
 * morto é apagado antes do redirecionamento, e o laço não começa.
 */
export async function GET(req: Request) {
  const tinhaCookie = Boolean(await tokenDoCookie());
  const valida = await sessaoAtual();

  await limparCookie();

  const destino = new URL("/login", req.url);
  if (tinhaCookie && !valida) destino.searchParams.set("encerrada", "1");
  return NextResponse.redirect(destino);
}
