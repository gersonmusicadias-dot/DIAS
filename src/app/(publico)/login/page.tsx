import "./login.css";
import { Suspense } from "react";
import FormularioLogin from "./FormularioLogin";
import TemaLogin from "./TemaLogin";

export const metadata = {
  title: "FluxoMed Maricá - Login",
  other: {
    google: "notranslate",
  },
};

function LogoFluxoMed() {
  return (
    <div className="fx-logo">
      <svg
        width="78"
        height="70"
        viewBox="0 0 72 64"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M36 57S8 41 8 20.5C8 11.4 14.8 6 22.7 6 28.3 6 33 9.2 36 14c3-4.8 7.7-8 13.3-8C57.2 6 64 11.4 64 20.5 64 41 36 57 36 57Z"
          stroke="currentColor"
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <path
          d="M3 32h18l4.5-9 6.5 19 7-26 6 21 4-5H69"
          stroke="currentColor"
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      <div className="fx-logo-texto">
        <strong>FLUXOMED</strong>
        <span>MARICÁ</span>
      </div>
    </div>
  );
}

function GraficoLinha() {
  return (
    <svg className="fx-grafico-linha" viewBox="0 0 420 80" aria-hidden="true">
      <polyline points="5,60 55,52 105,56 155,41 205,44 260,28 315,32 370,19 415,11" />
    </svg>
  );
}

function ColunaEsquerda() {
  return (
    <aside className="fx-lateral fx-esquerda">
      <div className="fx-painel-esquerdo">

        <section className="fx-bloco">
          <h3>Evolução do Caixa</h3>
          <GraficoLinha />
          <div className="fx-meses">
            <span>Mai</span><span>Jun</span><span>Jul</span><span>Ago</span>
            <span>Set</span><span>Out</span><span>Nov</span><span>Dez</span>
          </div>
        </section>

        <section className="fx-bloco">
          <h3>Receitas x Despesas</h3>

          <div className="fx-donut-area">
            <div className="fx-donut" />

            <div className="fx-legenda">
              <span><i className="receita" />Receitas</span>
              <span><i className="despesa" />Despesas</span>
              <span><i className="resultado" />Resultado</span>
            </div>
          </div>
        </section>

        <section className="fx-bloco">
          <h3>Resultado do Mês</h3>

          <strong className="fx-valor-mes">R$ 128.450,75</strong>

          <span className="fx-positivo">
            ▲ 12,5% vs mês anterior
          </span>

          <div className="fx-barras">
            <i style={{ height: "40%" }} />
            <i style={{ height: "58%" }} />
            <i style={{ height: "46%" }} />
            <i style={{ height: "72%" }} />
            <i style={{ height: "64%" }} />
            <i style={{ height: "88%" }} />
            <i style={{ height: "80%" }} />
            <i style={{ height: "96%" }} />
          </div>
        </section>

        <section className="fx-bloco fx-semana">
          <div>
            <strong className="vermelho">12</strong>
            <span>vencendo esta semana</span>
          </div>

          <div>
            <strong className="azul">8</strong>
            <span>a receber esta semana</span>
          </div>
        </section>

        <section className="fx-bloco">
          <h3>Demonstração do Resultado</h3>

          <div className="fx-dre">
            <div>
              <span>Receita Bruta</span>
              <i><b style={{ width: "100%" }} /></i>
              <strong>R$ 248.300</strong>
            </div>

            <div>
              <span>(-) Deduções</span>
              <i><b style={{ width: "17%" }} /></i>
              <strong>R$ 42.000</strong>
            </div>

            <div>
              <span>Receita Líquida</span>
              <i><b style={{ width: "83%" }} /></i>
              <strong>R$ 206.300</strong>
            </div>

            <div>
              <span>(-) Custos</span>
              <i><b style={{ width: "34%" }} /></i>
              <strong>R$ 84.500</strong>
            </div>

            <div>
              <span>(-) Despesas</span>
              <i><b style={{ width: "19%" }} /></i>
              <strong>R$ 47.030</strong>
            </div>

            <div className="fx-resultado-liquido">
              <span>Resultado Líquido</span>
              <strong>R$ 178.770,00</strong>
            </div>
          </div>
        </section>

      </div>
    </aside>
  );
}

function Modulo({
  nome,
  simbolo,
}: {
  nome: string;
  simbolo: string;
}) {
  return (
    <div className="fx-modulo">
      <div className="fx-hexagono">
        <span>{simbolo}</span>
      </div>

      <small>{nome}</small>
    </div>
  );
}

function ColunaDireita() {
  return (
    <aside className="fx-lateral fx-direita">

      <section className="fx-card-direito fx-crescimento">
        <h3>Crescimento Financeiro</h3>

        <div className="fx-grafico-crescimento">
          <div className="fx-colunas">
            <i style={{ height: "42%" }} />
            <i style={{ height: "51%" }} />
            <i style={{ height: "47%" }} />
            <i style={{ height: "67%" }} />
            <i style={{ height: "62%" }} />
            <i style={{ height: "83%" }} />
            <i style={{ height: "96%" }} />
          </div>

          <svg viewBox="0 0 420 220" aria-hidden="true">
            <polyline points="8,165 65,135 120,144 178,105 235,114 292,69 350,74 413,24" />
          </svg>
        </div>

        <div className="fx-meses">
          <span>Mai</span><span>Jun</span><span>Jul</span><span>Ago</span>
          <span>Set</span><span>Out</span><span>Nov</span>
        </div>
      </section>

      <section className="fx-modulos">
        <Modulo nome="CONTABILIDADE" simbolo="▦" />
        <Modulo nome="FISCAL" simbolo="▤" />
        <Modulo nome="CONTROLE" simbolo="▥" />
        <Modulo nome="ANÁLISES" simbolo="↗" />
        <Modulo nome="PLANEJAMENTO" simbolo="◎" />
      </section>

    </aside>
  );
}

export default function PaginaLogin() {
  return (
    <main className="fx-login notranslate" translate="no">

      <TemaLogin />

      <div className="fx-grid">

        <ColunaEsquerda />

        <section className="fx-centro">
          <div className="fx-centro-conteudo">

            <div className="fx-logo-area">
              <LogoFluxoMed />
            </div>

            <div className="fx-card-login">
              <h1>Acesso ao Sistema</h1>

              <p>
                Use suas credenciais para continuar.
              </p>

              <Suspense fallback={null}>
                <FormularioLogin />
              </Suspense>
            </div>

            <p className="fx-versao">
              Gestão Financeira · v1.0.0
            </p>

          </div>
        </section>

        <ColunaDireita />

      </div>
    </main>
  );
}

