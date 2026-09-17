import { sessaoAtual } from "@/lib/auth/sessao";
import GerenciarCadastro from "@/components/GerenciarCadastro";

export const metadata = { title: "Categorias · FluxoMed Maricá" };
export const dynamic = "force-dynamic";

export default async function PaginaCategorias() {
  const sessao = await sessaoAtual();
  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1 className="titulo-pagina">Categorias</h1>
          <p className="sub-pagina">Classificação dos custos por natureza.</p>
        </div>
      </div>
      <GerenciarCadastro tipo="categoria" somenteLeitura={sessao?.papel === "LEITURA"} />
    </>
  );
}
