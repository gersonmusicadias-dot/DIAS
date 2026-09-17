import { redirect } from "next/navigation";
import { sessaoAtual } from "@/lib/auth/sessao";
import GerenciarLogs from "./GerenciarLogs";

export const metadata = { title: "Logs · FluxoMed Maricá" };

export default async function PaginaLogs() {
  const sessao = await sessaoAtual();

  if (!sessao) redirect("/api/auth/encerrar");
  if (sessao.papel !== "ADMIN") redirect("/painel");

  return (
    <>
      <h1 className="titulo-pagina">Central de Logs</h1>
      <p className="sub-pagina">
        Consulte acessos, alterações e eventos importantes realizados no sistema.
      </p>

      <GerenciarLogs />
    </>
  );
}
