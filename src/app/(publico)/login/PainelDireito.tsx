/** Painel ilustrativo da direita: mesma regra do esquerdo, sem valores. */

const MODULOS = [
  { rotulo: "Contabilidade", desenho: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 7h8" /><path d="M8 11h8" /><path d="M8 15h5" /></> },
  { rotulo: "Fiscal", desenho: <><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v5h5" /><path d="M9 13h6" /></> },
  { rotulo: "Controle", desenho: <><path d="M3 21h18" /><path d="M5 21V9l7-6 7 6v12" /><path d="M10 21v-6h4v6" /></> },
  { rotulo: "Análises", desenho: <><path d="M3 3v16a2 2 0 0 0 2 2h16" /><path d="m7 14 4-4 4 4 4-6" /></> },
  { rotulo: "Planejamento", desenho: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1" /></> },
];

export default function PainelDireito() {
  return (
    <aside className="painel-lateral direito" aria-hidden="true">
      <div className="bloco-ilustra">
        <p className="rotulo-ilustra">Acompanhamento financeiro</p>
        <svg viewBox="0 0 300 130" className="ilustra">
          {[46, 62, 54, 82, 70, 96, 88, 118].map((altura, i) => (
            <rect
              key={i} x={12 + i * 36} y={118 - altura} width={20} height={altura}
              rx="3" fill="var(--primaria)" opacity="0.85"
            />
          ))}
          <polyline
            points="22,74 58,58 94,66 130,40 166,50 202,26 238,34 274,10"
            fill="none" stroke="#7fd4ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          />
          <polyline
            points="22,92 58,86 94,80 130,72 166,64 202,54 238,44 274,32"
            fill="none" stroke="var(--ambar)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          />
          {["Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"].map((mes, i) => (
            <text key={mes} x={22 + i * 36} y={128} className="ilustra-eixo" textAnchor="middle">
              {mes}
            </text>
          ))}
        </svg>
      </div>

      <ul className="modulos-ilustra">
        {MODULOS.map((m) => (
          <li key={m.rotulo}>
            <span className="hexagono">
              <svg viewBox="0 0 24 24">{m.desenho}</svg>
            </span>
            {m.rotulo}
          </li>
        ))}
      </ul>
    </aside>
  );
}
