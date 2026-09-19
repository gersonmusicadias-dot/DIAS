"use client";

import { useEffect } from "react";

// Celular (até 720px): toda tabela com 4+ colunas vira cartão. Tablet retrato
// (até 900px): só as largas, com 6+ colunas, que não cabem na tela.
function minimoDeColunas(): number {
  const largura = window.innerWidth;
  if (largura <= 720) return 4;
  if (largura <= 900) return 6;
  return Number.POSITIVE_INFINITY;
}

// O React acrescenta uma chave "__reactFiber…" a cada elemento assim que o
// hidrata. Mexer no atributo de um elemento ainda não hidratado faz o React
// acusar divergência com o HTML do servidor; por isso só se marca o que já
// foi hidratado (ou foi criado no navegador).
function hidratado(elemento: Element): boolean {
  return Object.keys(elemento).some((chave) => chave.startsWith("__reactFiber"));
}

/**
 * No celular as tabelas largas viram cartões (uma linha = um cartão, cada
 * célula com o nome da coluna ao lado). Aqui só se marca cada tabela e se
 * copia o título da coluna para `data-label` das células; o visual em si fica
 * no CSS (`table.fm-cartoes`). A marcação se refaz sozinha quando uma tela ou
 * janela troca o conteúdo, então nenhuma tabela precisa ser alterada.
 */
export default function TabelasEmCartoes() {
  useEffect(() => {
    const raiz = document.querySelector(".casca");
    if (!raiz) return;

    function marcar() {
      raiz!.querySelectorAll("table").forEach((tabela) => {
        if (!hidratado(tabela)) return;

        const titulos = Array.from(tabela.querySelectorAll("thead th")).map(
          (th) => th.textContent?.trim() ?? ""
        );
        if (titulos.length < minimoDeColunas()) {
          tabela.classList.remove("fm-cartoes");
          return;
        }
        tabela.classList.add("fm-cartoes");
        tabela.querySelectorAll("tr").forEach((linha) => {
          Array.from(linha.children).forEach((celula, indice) => {
            if (celula.tagName !== "TD" || celula.hasAttribute("colspan")) return;
            if (!hidratado(celula)) return;
            const rotulo = titulos[indice];
            if (rotulo && celula.getAttribute("data-label") !== rotulo) {
              celula.setAttribute("data-label", rotulo);
            }
          });
        });
      });
    }

    // setTimeout (e não requestAnimationFrame) para também funcionar com a aba em segundo plano.
    let quadro = 0;
    const agendar = () => {
      window.clearTimeout(quadro);
      quadro = window.setTimeout(marcar, 60);
    };

    // Mexer no HTML antes de o React terminar de hidratá-lo faz o React acusar
    // divergência. Por isso a marcação só começa bem depois do carregamento;
    // a partir daí o observador acompanha as trocas de tela e de janela, e um
    // intervalo curto cobre partes da página que hidratam mais tarde.
    let intervalo = 0;
    let parar = 0;
    let observador: MutationObserver | null = null;
    const iniciar = window.setTimeout(() => {
      marcar();
      observador = new MutationObserver(agendar);
      observador.observe(raiz, { childList: true, subtree: true });
      window.addEventListener("resize", agendar);
      intervalo = window.setInterval(marcar, 700);
      parar = window.setTimeout(() => window.clearInterval(intervalo), 10000);
    }, document.readyState === "complete" ? 1500 : 3000);

    return () => {
      window.clearTimeout(quadro);
      window.clearTimeout(iniciar);
      window.clearInterval(intervalo);
      window.clearTimeout(parar);
      observador?.disconnect();
      window.removeEventListener("resize", agendar);
    };
  }, []);

  return null;
}
