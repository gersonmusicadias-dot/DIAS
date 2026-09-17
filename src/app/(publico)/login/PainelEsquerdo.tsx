/**
 * Painel ilustrativo da esquerda.
 *
 * É decoração da tela de acesso: mostra a FORMA dos relatórios que existem
 * dentro do sistema, sem número nenhum. A referência trazia valores em reais
 * aqui; não foram reproduzidos de propósito — número em tela de login não
 * corresponde a dado de ninguém, e inventar cifra financeira é o tipo de
 * coisa que confunde quem olha rápido.
 */
export default function PainelEsquerdo() {
  return (
    <aside className="painel-lateral esquerdo" aria-hidden="true">
      <div className="bloco-ilustra">
        <p className="rotulo-ilustra">Evolução do caixa</p>
        <svg viewBox="0 0 260 70" className="ilustra">
          <polyline
            points="4,52 36,46 68,49 100,38 132,42 164,30 196,33 228,22 256,18"
            fill="none"
            stroke="var(--primaria)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {["Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"].map((mes, i) => (
            <text key={mes} x={10 + i * 35} y={66} className="ilustra-eixo">
              {mes}
            </text>
          ))}
        </svg>
      </div>

      <div className="bloco-ilustra">
        <p className="rotulo-ilustra">Receitas x Despesas</p>
        <div className="rosca-linha">
          <svg viewBox="0 0 80 80" className="rosca">
            <circle cx="40" cy="40" r="28" fill="none" stroke="var(--superficie-3)" strokeWidth="13" />
            <circle
              cx="40" cy="40" r="28" fill="none" stroke="var(--primaria)" strokeWidth="13"
              strokeDasharray="105 71" transform="rotate(-90 40 40)" strokeLinecap="round"
            />
          </svg>
          <ul className="legenda-ilustra">
            <li><i style={{ background: "var(--primaria)" }} />Receitas</li>
            <li><i style={{ background: "var(--superficie-3)" }} />Despesas</li>
            <li><i style={{ background: "var(--ambar)" }} />Resultado</li>
          </ul>
        </div>
      </div>

      <div className="bloco-ilustra">
        <p className="rotulo-ilustra">Composição do resultado</p>
        <div className="barras-ilustra">
          {[62, 34, 78, 45, 88, 52].map((altura, i) => (
            <span key={i} style={{ height: `${altura}%` }} />
          ))}
        </div>
      </div>
    </aside>
  );
}
