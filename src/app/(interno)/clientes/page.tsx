import { sessaoAtual } from "@/lib/auth/sessao";
import GerenciarCadastro from "@/components/GerenciarCadastro";

export const metadata = { title: "Clientes · FluxoMed Maricá" };
export const dynamic = "force-dynamic";

export default async function PaginaClientes() {
  const sessao = await sessaoAtual();
  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1 className="titulo-pagina">Clientes</h1>
          <p className="sub-pagina">
            Cliente com documento não é apagado — é inativado, para o histórico financeiro continuar de pé.
          </p>
        </div>
      </div>
      <GerenciarCadastro tipo="cliente" somenteLeitura={sessao?.papel === "LEITURA"} />
    </>
  );
}
