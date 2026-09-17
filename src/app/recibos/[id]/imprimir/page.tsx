import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { sessaoAtual } from "@/lib/auth/sessao";
import { valorPorExtenso } from "@/lib/valorPorExtenso";
import BotaoImprimir from "./BotaoImprimir";
import Marca from "@/components/Marca";

function moeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);
}

function dataBR(data?: string | null) {
  if (!data) return "—";
  const [ano, mes, dia] = data.split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : data;
}

function cnpjBR(cnpj?: string | null) {
  if (!cnpj) return "Não informado";
  const n = cnpj.replace(/\D/g, "");
  if (n.length !== 14) return cnpj;
  return n.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5"
  );
}

export default async function ImprimirRecibo({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const sessao = await sessaoAtual();
  if (!sessao) redirect("/api/auth/encerrar");
  if (sessao.trocarSenha) redirect("/primeiro-acesso");

  const recibo = await prisma.recibo.findUnique({
    where: { id },
    include: {
      cliente: true,
      medicao: {
        select: {
          identificador: true,
          periodoInicio: true,
          periodoFim: true,
          descricaoServicos: true,
        },
      },
      substitui: {
        select: { identificador: true },
      },
      substituidoPor: {
        select: { identificador: true },
      },
    },
  });

  if (!recibo) notFound();

  const valor =
    recibo.status === "PREVISTO"
      ? recibo.valorPrevisto
      : recibo.valorRecibo;

  const ehSubstituido = Boolean(recibo.substituidoPor);
  const ehSubstituto = Boolean(recibo.substitui);

  return (
    <>
      <main className="pagina-recibo">
        <BotaoImprimir />

        <article className="folha">
          {ehSubstituido && (
            <div className="marca-substituido">DOCUMENTO SUBSTITUÍDO</div>
          )}

          <header className="cabecalho">
            <div className="marca-recibo">
              <Marca tamanho={56} comNome />
            </div>

            <div className="titulo">
              <span>RECIBO</span>
              <strong>{recibo.identificador}</strong>
            </div>
          </header>

          <section className="valor-destaque">
            <span>VALOR DO RECIBO</span>
            <strong>{moeda(valor)}</strong>
            <p>{valorPorExtenso(valor)}</p>
          </section>

          <section className="bloco">
            <h2>Dados do cliente</h2>

            <div className="grade">
              <div className="recibo-campo dois">
                <span>Razão Social</span>
                <strong>{recibo.cliente.razaoSocial}</strong>
              </div>

              <div className="recibo-campo">
                <span>Nome Fantasia</span>
                <strong>{recibo.cliente.nomeFantasia}</strong>
              </div>

              <div className="recibo-campo">
                <span>CNPJ</span>
                <strong>{cnpjBR(recibo.cliente.cnpj)}</strong>
              </div>
            </div>
          </section>

          <section className="bloco">
            <h2>Dados do recibo</h2>

            <div className="grade">
              <div className="recibo-campo">
                <span>Data de emissão</span>
                <strong>{dataBR(recibo.dataEmissao)}</strong>
              </div>

              <div className="recibo-campo">
                <span>Origem</span>
                <strong>
                  {recibo.origem === "MEDICAO"
                    ? "Medição"
                    : "Recibo avulso"}
                </strong>
              </div>

              <div className="recibo-campo">
                <span>Previsão de recebimento</span>
                <strong>{dataBR(recibo.previsaoRecebimento)}</strong>
              </div>

              <div className="recibo-campo">
                <span>Situação</span>
                <strong>
                  {ehSubstituido
                    ? "Substituído"
                    : recibo.status === "PREVISTO"
                    ? "Previsto"
                    : "Emitido"}
                </strong>
              </div>
            </div>
          </section>

          {recibo.medicao && (
            <section className="bloco">
              <h2>Referência da medição</h2>

              <div className="grade">
                <div className="recibo-campo">
                  <span>Medição</span>
                  <strong>{recibo.medicao.identificador}</strong>
                </div>

                <div className="recibo-campo">
                  <span>Período</span>
                  <strong>
                    {dataBR(recibo.medicao.periodoInicio)} a{" "}
                    {dataBR(recibo.medicao.periodoFim)}
                  </strong>
                </div>
              </div>

              {recibo.medicao.descricaoServicos && (
                <div className="descricao-medicao">
                  <span>Serviços da medição</span>
                  <p>{recibo.medicao.descricaoServicos}</p>
                </div>
              )}
            </section>
          )}

          <section className="bloco">
            <h2>Descrição</h2>
            <div className="descricao">
              {recibo.descricao}
            </div>
          </section>

          {(ehSubstituto || ehSubstituido) && (
            <section className="bloco substituicao">
              <h2>Controle de substituição</h2>

              {recibo.substitui && (
                <p>
                  Este recibo substitui o documento{" "}
                  <strong>{recibo.substitui.identificador}</strong>.
                </p>
              )}

              {recibo.substituidoPor && (
                <p>
                  Este documento foi substituído por{" "}
                  <strong>{recibo.substituidoPor.identificador}</strong>.
                </p>
              )}

              {recibo.motivoSubstituicao && (
                <p>
                  <strong>Motivo:</strong> {recibo.motivoSubstituicao}
                </p>
              )}
            </section>
          )}

          <section className="declaracao">
            <h2>Declaração</h2>
            <p>
              Para fins de registro e controle financeiro, declaramos que
              este documento corresponde aos serviços e valores descritos
              acima.
            </p>
          </section>

          <footer className="rodape-recibo">
            <div className="assinatura">
              <span />
              <strong>FluxoMed Maricá</strong>
              <small>Responsável pelo documento</small>
            </div>

            <div className="identificacao-final">
              <span>Documento</span>
              <strong>{recibo.identificador}</strong>
            </div>
          </footer>
        </article>
      </main>

      <style>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background: #e8edf2;
          color: #142238;
          font-family: Arial, Helvetica, sans-serif;
        }

        .pagina-recibo {
          padding: 28px 16px 50px;
        }

        .acoes-impressao {
          width: 210mm;
          max-width: 100%;
          margin: 0 auto 18px;
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }

        .acoes-impressao button {
          border: 0;
          border-radius: 8px;
          padding: 11px 18px;
          background: #0b1630;
          color: white;
          font-weight: 700;
          cursor: pointer;
        }

        .acoes-impressao button.secundario {
          background: white;
          color: #0b1630;
          border: 1px solid #cad4df;
        }

        .folha {
          position: relative;
          width: 210mm;
          min-height: 297mm;
          margin: 0 auto;
          padding: 17mm 18mm 16mm;
          background: white;
          box-shadow: 0 12px 35px rgba(11, 22, 48, .14);
          overflow: hidden;
        }

        .marca-substituido {
          position: absolute;
          top: 48mm;
          left: 18mm;
          width: 174mm;
          transform: rotate(-25deg);
          text-align: center;
          border: 3px solid rgba(180, 30, 30, .15);
          color: rgba(180, 30, 30, .15);
          font-size: 20px;
          font-weight: 900;
          letter-spacing: 2px;
          padding: 7px;
          pointer-events: none;
        }

        .cabecalho {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 15px;
          border-bottom: 3px solid #0b1630;
        }

        .marca {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .marca img {
          width: 52px;
          height: 52px;
        }

        .marca div {
          display: flex;
          flex-direction: column;
        }

        .marca strong {
          color: #0b1630;
          font-size: 18px;
          letter-spacing: .6px;
        }

        .marca span {
          color: #557087;
          margin-top: 3px;
          font-size: 12px;
        }

                .marca-recibo .marca {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #0b1630;
        }

        .marca-recibo .marca-simbolo {
          flex: 0 0 auto;
          color: #0b1630;
        }

        .marca-recibo .marca-texto {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }

        .marca-recibo .marca-nome {
          color: #0b1630;
          font-size: 18px;
          font-weight: 800;
          line-height: 1;
          letter-spacing: .5px;
        }

        .marca-recibo .marca-sub {
          margin-top: 5px;
          color: #00b6ff;
          font-size: 10px;
          font-weight: 800;
          line-height: 1;
          letter-spacing: .32em;
        }

        .titulo {
          text-align: right;
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .titulo span {
          color: #00a8ef;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 2px;
        }

        .titulo strong {
          color: #0b1630;
          font-size: 18px;
        }

        .valor-destaque {
          margin: 22px 0 18px;
          padding: 18px 20px;
          border-radius: 10px;
          background: #f3f8fb;
          border-left: 5px solid #00b6ff;
        }

        .valor-destaque span {
          display: block;
          color: #60778c;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1.2px;
        }

        .valor-destaque strong {
          display: block;
          color: #0b1630;
          font-size: 30px;
          margin: 4px 0;
        }

        .valor-destaque p {
          margin: 0;
          color: #496174;
          font-size: 12px;
          text-transform: capitalize;
        }

        .bloco {
          margin-top: 18px;
        }

        .bloco h2,
        .declaracao h2 {
          margin: 0 0 9px;
          padding-bottom: 5px;
          border-bottom: 1px solid #dce4eb;
          color: #0b1630;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: .8px;
        }

        .grade {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px 18px;
        }

        .recibo-campo {
          min-width: 0;
        }

        .recibo-campo.dois {
          grid-column: 1 / -1;
        }

        .recibo-campo span,
        .descricao-medicao span {
          display: block;
          color: #708396;
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          margin-bottom: 3px;
        }

        .recibo-campo strong {
          color: #1b2b3d;
          font-size: 12px;
          line-height: 1.35;
        }

        .descricao,
        .descricao-medicao {
          border: 1px solid #dce4eb;
          background: #fafcfd;
          border-radius: 7px;
          padding: 11px 13px;
          color: #2e4152;
          font-size: 12px;
          line-height: 1.55;
          white-space: pre-wrap;
        }

        .descricao-medicao {
          margin-top: 10px;
        }

        .descricao-medicao p {
          margin: 0;
        }

        .substituicao {
          border: 1px solid #efd4d4;
          background: #fff9f9;
          border-radius: 7px;
          padding: 11px 13px;
        }

        .substituicao h2 {
          color: #9c3434;
        }

        .substituicao p {
          margin: 5px 0;
          font-size: 11px;
          line-height: 1.45;
        }

        .declaracao {
          margin-top: 22px;
          padding-top: 2px;
        }

        .declaracao p {
          margin: 0;
          color: #43586a;
          font-size: 11px;
          line-height: 1.55;
          text-align: justify;
        }

        .rodape-recibo {
          margin-top: 34px;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 30px;
        }

        .assinatura {
          width: 78mm;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .assinatura > span {
          width: 100%;
          border-top: 1px solid #627487;
          margin-bottom: 6px;
        }

        .assinatura strong {
          font-size: 11px;
          color: #0b1630;
        }

        .assinatura small {
          margin-top: 2px;
          font-size: 9px;
          color: #778a9a;
        }

        .identificacao-final {
          text-align: right;
          display: flex;
          flex-direction: column;
        }

        .identificacao-final span {
          color: #8393a1;
          font-size: 9px;
          text-transform: uppercase;
        }

        .identificacao-final strong {
          margin-top: 3px;
          color: #0b1630;
          font-size: 10px;
        }

        @media print {
          @page {
            size: A4;
            margin: 0;
          }

          body {
            background: white;
          }

          .pagina-recibo {
            padding: 0;
          }

          .acoes-impressao {
            display: none !important;
          }

          .folha {
            width: 210mm;
            min-height: 297mm;
            margin: 0;
            box-shadow: none;
          }
        }

        @media screen and (max-width: 850px) {
          .folha {
            width: 100%;
            min-height: auto;
            padding: 22px;
          }

          .acoes-impressao {
            width: 100%;
          }

          .grade {
            grid-template-columns: 1fr;
          }

          .recibo-campo.dois {
            grid-column: auto;
          }

          .cabecalho {
            align-items: flex-start;
          }

          .titulo strong {
            font-size: 14px;
          }
        }
      `}</style>
    </>
  );
}