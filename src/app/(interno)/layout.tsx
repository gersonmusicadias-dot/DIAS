import { redirect } from "next/navigation";
import CascaInterna from "@/components/CascaInterna";
import { sessaoAtual } from "@/lib/auth/sessao";

/**
 * Porta da área interna. O middleware confere só a assinatura do cookie;
 * aqui a sessão é conferida contra o banco, e é esta checagem que decide
 * quem entra.
 */
export default async function LayoutInterno({ children }: { children: React.ReactNode }) {
  const sessao = await sessaoAtual();
  // Cookie sem sessao viva atras dele: passa pela rota que o apaga, senao o
  // middleware devolve a pessoa para ca e o redirecionamento vira laco.
  if (!sessao) redirect("/api/auth/encerrar");
  if (sessao.trocarSenha) redirect("/primeiro-acesso");

  return (
    <CascaInterna nome={sessao.nome} email={sessao.email} papel={sessao.papel}>
      {children}
    </CascaInterna>
  );
}
