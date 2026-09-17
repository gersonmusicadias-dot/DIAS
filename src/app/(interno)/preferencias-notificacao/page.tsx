import { sessaoAtual } from "@/lib/auth/sessao";
import PreferenciasNotificacao from "./PreferenciasNotificacao";

export const metadata = { title: "Preferências de Notificação · FluxoMed Maricá" };
export const dynamic = "force-dynamic";

export default async function PaginaPreferenciasNotificacao() {
  const sessao = await sessaoAtual();
  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1 className="titulo-pagina">Preferências de Notificação</h1>
          <p className="sub-pagina">Configure os alertas financeiros que deseja receber por e-mail.</p>
        </div>
      </div>
      <PreferenciasNotificacao email={sessao?.email ?? ""} />
    </>
  );
}
