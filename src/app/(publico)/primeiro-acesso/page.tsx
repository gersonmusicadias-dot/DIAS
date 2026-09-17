import { redirect } from "next/navigation";
import Marca from "@/components/Marca";
import FormularioNovaSenha from "./FormularioNovaSenha";
import { sessaoAtual } from "@/lib/auth/sessao";

export const metadata = { title: "Definir senha · FluxoMed Maricá" };

export default async function PaginaPrimeiroAcesso() {
  const sessao = await sessaoAtual();
  if (!sessao) redirect("/api/auth/encerrar");

  return (
    <main className="tela-login">
      <div />
      <section className="coluna-central">
        <div className="marca-topo">
          <Marca tamanho={64} />
        </div>

        <div className="cartao-acesso">
          <h1>Defina sua senha</h1>
          <p className="subtitulo">
            {sessao?.nome ? `Bem-vindo, ${sessao.nome}. ` : ""}
            A senha provisória serve só para este primeiro acesso.
          </p>
          <FormularioNovaSenha />
        </div>

        <p className="rodape-login">Gestão Financeira · v1.0.0</p>
      </section>
      <div />
    </main>
  );
}
