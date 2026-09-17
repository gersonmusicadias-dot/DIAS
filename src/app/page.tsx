import { redirect } from "next/navigation";
import { sessaoAtual } from "@/lib/auth/sessao";

/**
 * Raiz do site. Sem esta rota, quem já estava autenticado e chegava em "/"
 * via 404 — o middleware só redireciona quem NÃO tem sessão.
 */
export default async function Raiz() {
  const sessao = await sessaoAtual();
  if (!sessao) redirect("/api/auth/encerrar");
  if (sessao.trocarSenha) redirect("/primeiro-acesso");
  redirect("/painel");
}
