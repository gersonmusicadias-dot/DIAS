import { redirect } from "next/navigation";
import { sessaoAtual } from "@/lib/auth/sessao";
import GerenciarUsuarios from "./GerenciarUsuarios";

export const metadata = { title: "Usuários · FluxoMed Maricá" };

export default async function PaginaUsuarios() {
  const sessao = await sessaoAtual();
  if (!sessao) redirect("/api/auth/encerrar");
  // Terceira tranca: middleware, layout e aqui. Cadastrar usuário é a ação
  // mais sensível do sistema.
  if (sessao.papel !== "ADMIN") redirect("/painel");

  return (
    <>
      <h1 className="titulo-pagina">Usuários</h1>
      <p className="sub-pagina">
        Cadastre pelo e-mail pessoal. A pessoa recebe uma senha provisória e é obrigada a
        trocá-la no primeiro acesso.
      </p>
      <GerenciarUsuarios meuId={sessao.sub} />
    </>
  );
}
