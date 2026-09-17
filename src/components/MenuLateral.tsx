"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONES: Record<string, React.ReactNode> = {
  painel: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </>
  ),

  carteira: (
    <>
      <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1" />
      <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
    </>
  ),

  prancheta: (
    <>
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="m9 14 2 2 4-4" />
    </>
  ),

  documento: (
    <>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v5h5" />
      <path d="M9 13h6" />
      <path d="M9 17h6" />
    </>
  ),

  recibo: (
    <>
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
      <path d="M8 7h8" />
      <path d="M8 11h8" />
    </>
  ),

  fluxo: (
    <>
      <path d="M3 3v16a2 2 0 0 0 2 2h16" />
      <path d="m7 14 4-4 4 4 4-6" />
    </>
  ),

  tabela: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M15 3v18" />
      <path d="M21 9H3" />
      <path d="M21 15H3" />
    </>
  ),

  balanca: (
    <>
      <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
      <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
      <path d="M7 21h10" />
      <path d="M12 3v18" />
      <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
    </>
  ),

  pessoas: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    </>
  ),

  etiquetas: (
    <>
      <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
      <path d="M7 7h.01" />
    </>
  ),

  usuario: (
    <>
      <path d="M18 21a8 8 0 0 0-16 0" />
      <circle cx="10" cy="8" r="5" />
      <path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3" />
    </>
  ),

  sino: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </>
  ),

  logs: (
    <>
      <path d="M4 5h16" />
      <path d="M4 12h16" />
      <path d="M4 19h16" />
      <circle cx="7" cy="5" r="1" />
      <circle cx="7" cy="12" r="1" />
      <circle cx="7" cy="19" r="1" />
    </>
  ),
};

const GRUPOS: [string, [string, string, string][]][] = [
  ["Visão geral", [
    ["/painel", "Visão Geral", "painel"],
  ]],

  ["Custos", [
    ["/custos", "Custos", "carteira"],
  ]],

  ["Receitas", [
    ["/medicoes", "Medições", "prancheta"],
    ["/notas-fiscais", "Notas Fiscais", "documento"],
    ["/recibos", "Recibos", "recibo"],
  ]],

  ["Financeiro", [
    ["/fluxo-caixa", "Fluxo de Caixa", "fluxo"],
    ["/balancete", "Balancete", "tabela"],
    ["/balanco", "Balanço", "balanca"],
  ]],

  ["Cadastros", [
    ["/clientes", "Clientes", "pessoas"],
    ["/categorias", "Categorias", "etiquetas"],
  ]],
];

export default function MenuLateral({
  ehAdmin,
}: {
  ehAdmin: boolean;
}) {
  const caminho = usePathname();

  return (
    <nav>
      {GRUPOS.map(([grupo, itens]) => (
        <div key={grupo} className="grupo-menu">
          <p className="grupo-rotulo">
            {grupo}
          </p>

          {itens.map(([href, rotulo, icone]) => (
            <Link
              key={href}
              href={href}
              className={caminho === href ? "ativo" : ""}
              aria-current={caminho === href ? "page" : undefined}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                {ICONES[icone]}
              </svg>

              {rotulo}
            </Link>
          ))}
        </div>
      ))}

      <div className="grupo-menu">
        <p className="grupo-rotulo">
          Sistema
        </p>

        <Link
          href="/preferencias-notificacao"
          className={
            caminho === "/preferencias-notificacao"
              ? "ativo"
              : ""
          }
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {ICONES.sino}
          </svg>

          Preferências de notificação
        </Link>

        {ehAdmin && (
          <>
            <Link
              href="/usuarios"
              className={
                caminho === "/usuarios"
                  ? "ativo"
                  : ""
              }
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                {ICONES.usuario}
              </svg>

              Usuários
            </Link>

            <Link
              href="/logs"
              className={caminho === "/logs" ? "ativo" : ""}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                {ICONES.logs}
              </svg>

              Logs
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
