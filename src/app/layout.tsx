import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FluxoMed Maricá",
  description: "Gestão financeira para clínicas",
  icons: { icon: "/favicon.svg" },
};

/**
 * Sem isto o navegador do celular assume uma tela imaginária de 980px e
 * desenha a página inteira reduzida, com letra ilegível — mesmo com todo o
 * CSS responsivo funcionando. É uma linha, e é o que decide se o sistema
 * serve ou não no telefone.
 *
 * `maximumScale` fica de fora de propósito: impedir o zoom tira de quem
 * enxerga pouco a única saída que a pessoa tem.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#071a2b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
