import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

/**
 * Sessão em cookie httpOnly, conferida contra o banco a cada uso.
 *
 * Por que cookie httpOnly e não localStorage: o que está em localStorage é
 * legível por qualquer script da página. Um cookie httpOnly não é — é a
 * diferença entre um XSS roubar a sessão de todo mundo ou não.
 *
 * Por que conferir no banco e não confiar só no JWT: um JWT é uma foto do
 * usuário no instante do login, e vale até expirar. Se o acesso fosse
 * decidido só por ele, demitir alguém não tiraria o acesso da pessoa, e
 * rebaixar um ADMIN para LEITURA não tiraria os poderes — os dois só
 * valeriam dias depois, quando o token vencesse. Então o token diz apenas
 * QUAL sessão é; quem a pessoa é hoje, e o que ela pode hoje, vem sempre
 * da linha do banco. É uma consulta por requisição, por índice primário.
 */

const NOME_COOKIE = "fluxomed_sessao";
const DURACAO_DIAS = 7;
const INATIVIDADE_MINUTOS = 15;

function segredo(): Uint8Array {
  const valor = process.env.JWT_SECRET;
  if (!valor || valor.length < 32) {
    // Falhar aqui é melhor do que assinar com um segredo fraco e achar que
    // está protegido.
    throw new Error(
      "JWT_SECRET ausente ou curto demais. Defina um valor de 32+ caracteres no .env.local."
    );
  }
  return new TextEncoder().encode(valor);
}

export interface Sessao extends JWTPayload {
  sub: string;
  /** Linha da tabela Sessao. É o que torna a revogação possível. */
  sid: string;
  nome: string;
  email: string;
  papel: string;
  trocarSenha: boolean;
}

export function sha256(valor: string): string {
  return createHash("sha256").update(valor).digest("hex");
}

export function gerarTokenBruto(): string {
  return randomBytes(32).toString("hex");
}

export async function assinarSessao(dados: Omit<Sessao, "iat" | "exp">): Promise<string> {
  return new SignJWT(dados)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DURACAO_DIAS}d`)
    .sign(segredo());
}

/** Confere só a assinatura. Não diz se a sessão ainda vale. */
export async function lerSessao(token: string): Promise<Sessao | null> {
  try {
    const { payload } = await jwtVerify(token, segredo());
    return payload as Sessao;
  } catch {
    return null;
  }
}

export async function gravarCookie(token: string) {
  const jar = await cookies();
  jar.set(NOME_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DURACAO_DIAS * 24 * 60 * 60,
  });
}

export async function limparCookie() {
  const jar = await cookies();
  jar.set(NOME_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function tokenDoCookie(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(NOME_COOKIE)?.value ?? null;
}

/**
 * Abre uma sessão: cria a linha, assina o token com o id dela e guarda o
 * hash do token que foi entregue. Guardar o hash — e não o token — significa
 * que um vazamento do banco não devolve sessões utilizáveis a ninguém.
 */
export async function abrirSessao(
  usuario: { id: string; nome: string; email: string; papel: string; trocarSenha: boolean },
  contexto: { navegador?: string; ip?: string } = {}
): Promise<string> {
  const linha = await prisma.sessao.create({
    data: {
      usuarioId: usuario.id,
      // Provisório e único; substituído pelo hash do token logo abaixo.
      tokenHash: gerarTokenBruto(),
      navegador: contexto.navegador,
      ip: contexto.ip,
      expiraEm: new Date(Date.now() + DURACAO_DIAS * 24 * 60 * 60 * 1000),
    },
  });

  const token = await assinarSessao({
    sub: usuario.id,
    sid: linha.id,
    nome: usuario.nome,
    email: usuario.email,
    papel: usuario.papel,
    trocarSenha: usuario.trocarSenha,
  });

  await prisma.sessao.update({
    where: { id: linha.id },
    data: { tokenHash: sha256(token) },
  });

  await gravarCookie(token);
  return token;
}

/**
 * Reemite o token da MESMA sessão — usado quando algo do usuário muda no
 * meio do caminho (a troca de senha). O token anterior deixa de valer,
 * porque o hash guardado passa a ser o do novo.
 */
export async function renovarSessao(
  sid: string,
  usuario: { id: string; nome: string; email: string; papel: string; trocarSenha: boolean }
): Promise<string> {
  const token = await assinarSessao({
    sub: usuario.id,
    sid,
    nome: usuario.nome,
    email: usuario.email,
    papel: usuario.papel,
    trocarSenha: usuario.trocarSenha,
  });
  await prisma.sessao.update({ where: { id: sid }, data: { tokenHash: sha256(token) } });
  await gravarCookie(token);
  return token;
}

export async function revogarSessao(sid: string) {
  await prisma.sessao.updateMany({
    where: { id: sid, revogadaEm: null },
    data: { revogadaEm: new Date() },
  });
}

/** Derruba todas as sessões do usuário, opcionalmente poupando uma. */
export async function revogarSessoesDoUsuario(usuarioId: string, exceto?: string) {
  await prisma.sessao.updateMany({
    where: {
      usuarioId,
      revogadaEm: null,
      ...(exceto ? { NOT: { id: exceto } } : {}),
    },
    data: { revogadaEm: new Date() },
  });
}

/**
 * A sessão válida agora, com os dados de AGORA — não os do login.
 * Devolve null se qualquer uma destas coisas for verdade:
 * token inválido, sessão revogada, sessão vencida, token substituído por
 * outro mais novo, usuário apagado ou usuário inativado.
 */
export async function sessaoAtual(): Promise<Sessao | null> {
  const token = await tokenDoCookie();
  if (!token) return null;

  const assinada = await lerSessao(token);
  if (!assinada?.sid) return null;

  const linha = await prisma.sessao.findUnique({
    where: { id: assinada.sid },
    include: { usuario: true },
  });

  if (!linha) return null;
  if (linha.revogadaEm) return null;
  if (linha.expiraEm.getTime() <= Date.now()) return null;
  if (linha.ultimaAtividadeEm.getTime() + INATIVIDADE_MINUTOS * 60 * 1000 <= Date.now()) return null;
  if (linha.usuarioId !== assinada.sub) return null;
  if (linha.tokenHash !== sha256(token)) return null;

  const usuario = linha.usuario;
  if (!usuario.ativo) return null;

  await prisma.sessao.update({
    where: { id: linha.id },
    data: { ultimaAtividadeEm: new Date() },
  });

  return {
    sub: usuario.id,
    sid: linha.id,
    nome: usuario.nome,
    email: usuario.email,
    papel: usuario.papel,
    trocarSenha: usuario.trocarSenha,
  };
}

export const COOKIE_SESSAO = NOME_COOKIE;
export const DURACAO_SESSAO_DIAS = DURACAO_DIAS;
