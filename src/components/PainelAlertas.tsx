import Link from "next/link";
import { comoDizerOPrazo, type Alerta, type Alertas } from "@/lib/financeiro/alertas";
import { formatarReal } from "@/lib/financeiro/dados";

/**
 * O que precisa de atenção, no topo da Visão Geral.
 *
 * Não é caixa de notificações: não há "marcar como lida", nem envio, nem
 * agendamento — nada disso existiria de verdade sem um processo rodando no
 * servidor. Cada linha é uma conta feita agora sobre os lançamentos, e some
 * sozinha quando o documento é pago ou recebido.
 */

function dataBR(iso: string) {
  return iso.split("-").reverse().join("/");
}

function Linha({ alerta }: { alerta: Alerta }) {
  const vencido = alerta.gravidade === "vencido";
  return (
    <Link href={alerta.destino} className={`alerta ${vencido ? "grave" : ""}`}>
      <span className="alerta-marca" aria-hidden="true" />
      <span className="alerta-texto">
        <strong>{alerta.titulo}</strong>
        <small>
          {alerta.detalhe} · {alerta.direcao === "pagar" ? "a pagar" : "a receber"} ·{" "}
          {dataBR(alerta.data)}
        </small>
      </span>
      <span className="alerta-lado">
        <strong>{formatarReal(alerta.valor)}</strong>
        <small>{comoDizerOPrazo(alerta.dias)}</small>
      </span>
    </Link>
  );
}

export default function PainelAlertas({
  alertas, janela,
}: { alertas: Alertas; janela: number }) {
  const { vencidos, proximos } = alertas;
  if (vencidos.length === 0 && proximos.length === 0) return null;

  // Uma lista longa demais deixa de ser aviso e vira relatório. O que
  // sobra continua acessível na tela do próprio documento.
  const TETO = 5;

  return (
    <>
      <p className="rotulo-secao">Precisa de atenção</p>

      {vencidos.length > 0 && (
        <div className="cartao bloco-alertas" style={{ marginBottom: 12 }}>
          <div className="alerta-cabecalho">
            <strong>{vencidos.length} em atraso</strong>
            <span>
              {alertas.aPagarVencido > 0 && <>a pagar {formatarReal(alertas.aPagarVencido)}</>}
              {alertas.aPagarVencido > 0 && alertas.aReceberVencido > 0 && " · "}
              {alertas.aReceberVencido > 0 && <>a receber {formatarReal(alertas.aReceberVencido)}</>}
            </span>
          </div>
          {vencidos.slice(0, TETO).map((a) => <Linha key={a.id} alerta={a} />)}
          {vencidos.length > TETO && (
            <p className="alerta-sobra">
              e mais {vencidos.length - TETO} — abra a tela do documento para ver a lista inteira.
            </p>
          )}
        </div>
      )}

      {proximos.length > 0 && (
        <div className="cartao bloco-alertas">
          <div className="alerta-cabecalho">
            <strong>{proximos.length} nos próximos {janela} dias</strong>
          </div>
          {proximos.slice(0, TETO).map((a) => <Linha key={a.id} alerta={a} />)}
          {proximos.length > TETO && (
            <p className="alerta-sobra">
              e mais {proximos.length - TETO} — abra a tela do documento para ver a lista inteira.
            </p>
          )}
        </div>
      )}
    </>
  );
}
