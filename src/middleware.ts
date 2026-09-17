import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

/**
 * Guarda de rotas.
 *
 * Roda antes de qualquer página. Três decisões:
 *   sem sessão            -> vai para /login
 *   senha provisória      -> só pode /primeiro-acesso
 *   sessão normal         -> /login e /primeiro-acesso redirecionam para /painel
 *
 * Isto é o que garante que o usuário convidado não consegue pular a troca
 * de senha digitando a URL do painel na barra do navegador.
 */

const COOKIE = "fluxomed_sessao";
const PUBLICAS = ["/login"];

async function lerSessao(token: string) {
  try {
    const segredo = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, segredo);
    return payload as { sub: string; trocarSenha?: boolean };
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(COOKIE)?.value;
  const sessao = token ? await lerSessao(token) : null;

  const ehPublica = PUBLICAS.some((rota) => pathname.startsWith(rota));

  if (!sessao) {
    if (ehPublica) return NextResponse.next();
    const destino = new URL("/login", req.url);
    if (pathname !== "/") destino.searchParams.set("de", pathname);
    return NextResponse.redirect(destino);
  }

  if (sessao.trocarSenha && pathname !== "/primeiro-acesso") {
    return NextResponse.redirect(new URL("/primeiro-acesso", req.url));
  }

  if (!sessao.trocarSenha && (ehPublica || pathname === "/primeiro-acesso")) {
    return NextResponse.redirect(new URL("/painel", req.url));
  }

  return NextResponse.next();
}

export const config = {
  // Fora do guard: assets, e as rotas de API (que checam a sessão por conta
  // própria e precisam poder responder 401 em vez de redirecionar).
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.svg).*)"],
};
