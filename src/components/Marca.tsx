/** Identidade oficial FluxoMed Maricá: coração com traçado ECG. */
export default function Marca({
  tamanho = 64,
  comNome = true,
}: {
  tamanho?: number;
  comNome?: boolean;
}) {
  return (
    <div className="marca">
      <svg
        className="marca-simbolo"
        width={tamanho}
        height={tamanho}
        viewBox="0 0 72 64"
        fill="none"
        aria-hidden="true"
      >
        {/* coração */}
        <path
          d="M36 57S8 41 8 20.5C8 11.4 14.8 6 22.7 6 28.3 6 33 9.2 36 14c3-4.8 7.7-8 13.3-8C57.2 6 64 11.4 64 20.5 64 41 36 57 36 57Z"
          stroke="currentColor"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* ECG oficial — mesma cor do coração */}
        <path
          d="M3 32h18l4.5-9 6.5 19 7-26 6 21 4-5H69"
          stroke="currentColor"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {comNome && (
        <div className="marca-texto">
          <div className="marca-nome">FLUXOMED</div>
          <div className="marca-sub">Maricá</div>
        </div>
      )}
    </div>
  );
}



