import { sessaoAtual } from "@/lib/auth/sessao";
import VerFluxoCaixa from "./VerFluxoCaixa";

export const metadata = { title: "Fluxo de Caixa \u00b7 FluxoMed Maric\u00e1" };
export const dynamic = "force-dynamic";

export default async function PaginaFluxo() {
  const sessao = await sessaoAtual();
  return (
    <>
      <div className="cabecalho-pagina fm-caixa-v41-cabecalho">
        <div>
          <h1 className="titulo-pagina">Fluxo de Caixa</h1>
          <p className="sub-pagina">{"Movimenta\u00e7\u00f5es derivadas automaticamente dos lan\u00e7amentos."}</p>
        </div>
      </div>
      <VerFluxoCaixa somenteLeitura={sessao?.papel === "LEITURA"} />
    </>
  );
}
