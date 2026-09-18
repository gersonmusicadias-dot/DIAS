"use client";

import { useEffect, useMemo, useState } from "react";

interface EventoLog {
  id: string;
  tipo: "acesso" | "auditoria";
  criadoEm: string;
  usuario: string;
  email: string | null;
  modulo: string;
  acao: string;
  sucesso: boolean;
  descricao: string | null;
  registroId: string | null;
  antes: string | null;
  depois: string | null;
  ip: string | null;
}

function formatarData(valor: string) {
  return new Date(valor).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  });
}

/**
 * `criadoEm` chega em UTC; um evento das 22h locais já é outro dia em UTC.
 * O filtro de data precisa comparar contra o mesmo dia que `formatarData`
 * mostra na tela — os dois usam o fuso local do navegador, não o de `slice`.
 */
function dataLocal(valor: string) {
  const d = new Date(valor);
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function rotuloAcao(acao: string) {
  const mapa: Record<string, string> = {
    login: "Login",
    logout: "Logout",
    "trocar-senha": "Troca de senha",
    criar: "Criação",
    ativar: "Ativação",
    inativar: "Inativação",
    editar: "Alteração",
    excluir: "Exclusão",
    estornar: "Estorno",
    cancelar: "Cancelamento",
    medir: "Medição realizada",
    emitir: "Emissão",
    substituir: "Substituição",
    "registrar-pagamento": "Pagamento",
    "registrar-recebimento": "Recebimento",
    "redefinir-senha": "Redefinição de senha",
    "senha-redefinida": "Redefinição de senha",
    "alteracao-conta": "Alteração de conta",
    "exclusao-conta": "Exclusão de conta",
    convite: "Convite",
  };

  return mapa[acao] ?? acao;
}

export default function GerenciarLogs() {
  const [eventos, setEventos] = useState<EventoLog[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [modulo, setModulo] = useState("");
  const [acao, setAcao] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  async function carregar() {
    setCarregando(true);
    setErro(null);

    try {
      const resposta = await fetch("/api/logs", { cache: "no-store" });
      const dados = await resposta.json();

      if (!resposta.ok) {
        setErro(dados.erro ?? "Não foi possível carregar os logs.");
        return;
      }

      setEventos(dados.eventos ?? []);
    } catch {
      setErro("Não foi possível carregar os logs.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  const modulos = useMemo(() => Array.from(new Set(eventos.map((e) => e.modulo))).sort(), [eventos]);
  const acoes = useMemo(() => Array.from(new Set(eventos.map((e) => e.acao))).sort(), [eventos]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return eventos.filter((evento) => {
      const data = dataLocal(evento.criadoEm);
      if (modulo && evento.modulo !== modulo) return false;
      if (acao && evento.acao !== acao) return false;
      if (dataInicio && data < dataInicio) return false;
      if (dataFim && data > dataFim) return false;
      if (!termo) return true;
      return [evento.usuario, evento.email, evento.modulo, evento.acao, evento.descricao, evento.ip]
        .filter(Boolean)
        .some((valor) => String(valor).toLowerCase().includes(termo));
    });
  }, [eventos, busca, modulo, acao, dataInicio, dataFim]);

  return (
    <>
      <div className="cartao">
        <div className="cartao-corpo">
          <div className="grade-form">
            <div>
              <label className="rotulo">Pesquisar</label>
              <div className="campo">
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Usuário, módulo, ação, descrição ou IP"
                />
              </div>
            </div>

            <div><label className="rotulo">Módulo</label><div className="campo"><select value={modulo} onChange={(e) => setModulo(e.target.value)}><option value="">Todos</option>{modulos.map((m) => <option key={m} value={m}>{m}</option>)}</select></div></div>
            <div><label className="rotulo">Ação</label><div className="campo"><select value={acao} onChange={(e) => setAcao(e.target.value)}><option value="">Todas</option>{acoes.map((a) => <option key={a} value={a}>{rotuloAcao(a)}</option>)}</select></div></div>
            <div><label className="rotulo">Data inicial</label><div className="campo"><input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} /></div></div>
            <div><label className="rotulo">Data final</label><div className="campo"><input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} /></div></div>
            <div className="form-acao">
              <button
                className="botao discreto"
                type="button"
                onClick={carregar}
                disabled={carregando}
              >
                {carregando ? "Atualizando…" : "Atualizar"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {erro && <div className="erro">{erro}</div>}

      <div className="cartao tabela-rolagem">
        <div className="cartao-corpo">
          <h2>
            {carregando
              ? "Carregando…"
              : `${filtrados.length} evento${filtrados.length === 1 ? "" : "s"}`}
          </h2>
        </div>

        <table>
          <thead>
            <tr>
              <th>Data e hora</th>
              <th>Usuário</th>
              <th>Módulo</th>
              <th>Ação</th>
              <th>Resultado</th>
              <th>Descrição</th>
              <th>IP</th>
            </tr>
          </thead>

          <tbody>
            {!carregando && filtrados.length === 0 && (
              <tr>
                <td colSpan={7}>Nenhum evento encontrado.</td>
              </tr>
            )}

            {filtrados.map((evento) => (
              <tr key={evento.id}>
                <td>{formatarData(evento.criadoEm)}</td>
                <td>
                  <strong>{evento.usuario}</strong>
                  {evento.email && evento.email !== evento.usuario && (
                    <div>{evento.email}</div>
                  )}
                </td>
                <td>{evento.modulo}</td>
                <td>{rotuloAcao(evento.acao)}</td>
                <td>
                  <span className={`selo ${evento.sucesso ? "ok" : "off"}`}>
                    {evento.sucesso ? "Sucesso" : "Falha"}
                  </span>
                </td>
                <td>{evento.descricao ?? "—"}</td>
                <td>{evento.ip ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
