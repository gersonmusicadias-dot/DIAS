"use client";

import { TIPOS_CUSTO, TIPO_CUSTO_PADRAO } from "@/lib/financeiro/constantes";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SelectPadrao from "@/components/SelectPadrao";

/** Clientes e Categorias: mesma mecânica de cadastro simples com ativar/inativar. */

interface Registro {
  id: string; ativo: boolean;
  razaoSocial?: string; nomeFantasia?: string; cnpj?: string | null; temVinculos?: boolean;
  nome?: string; tipo?: string; custosVinculados?: number;
}

const formatarCnpj = (v?: string | null) => {
  if (!v) return "—";
  const d = v.replace(/\D/g, "");
  return d.length === 14
    ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")
    : v;
};

export default function GerenciarCadastro({
  tipo, somenteLeitura,
}: { tipo: "cliente" | "categoria"; somenteLeitura: boolean }) {
  const router = useRouter();
  const rota = tipo === "cliente" ? "/api/clientes" : "/api/categorias";
  const chave = tipo === "cliente" ? "clientes" : "categorias";

  const [itens, setItens] = useState<Registro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState("");
  const [formAberto, setFormAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  const [razaoSocial, setRazaoSocial] = useState("");
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [nome, setNome] = useState("");
  const [tipoCusto, setTipoCusto] = useState<string>(TIPO_CUSTO_PADRAO);

  async function carregar() {
    setCarregando(true);
    const r = await fetch(rota);
    if (r.ok) {
      const d = await r.json();
      setItens((d[chave] as Registro[]).map((x) => ({ ...x, ativo: x.ativo ?? (x as { ativa?: boolean }).ativa ?? true })));
    }
    setCarregando(false);
  }
  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [tipo]);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);

    try {
      const editandoCategoria = tipo === "categoria" && !!editandoId;
      const corpo = tipo === "cliente"
        ? { razaoSocial, nomeFantasia, cnpj }
        : editandoCategoria
          ? { id: editandoId, nome, tipo: tipoCusto }
          : { nome, tipo: tipoCusto };

      const r = await fetch(rota, {
        method: editandoCategoria ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });

      const d = await r.json();
      if (!r.ok) {
        setErro(d.erro);
        return;
      }

      setRazaoSocial("");
      setNomeFantasia("");
      setCnpj("");
      setNome("");
      setTipoCusto(TIPO_CUSTO_PADRAO);
      setEditandoId(null);
      setFormAberto(false);
      await carregar();
      router.refresh();
    } finally {
      setSalvando(false);
    }
  }
  function abrirNovo() {
    setErro(null);
    setEditandoId(null);
    setRazaoSocial("");
    setNomeFantasia("");
    setCnpj("");
    setNome("");
    setTipoCusto(TIPO_CUSTO_PADRAO);
    setFormAberto(true);
  }

  function abrirEdicao(item: Registro) {
    if (tipo !== "categoria") return;
    setErro(null);
    setEditandoId(item.id);
    setNome(item.nome ?? "");
    setTipoCusto(item.tipo ?? TIPO_CUSTO_PADRAO);
    setFormAberto(true);
  }

  function fecharFormulario() {
    if (salvando) return;
    setFormAberto(false);
    setEditandoId(null);
    setNome("");
    setTipoCusto(TIPO_CUSTO_PADRAO);
  }

  async function excluirCategoria(item: Registro) {
    if (tipo !== "categoria") return;

    setErro(null);

    if ((item.custosVinculados ?? 0) > 0) {
      setErro(
        `Não é possível excluir a categoria "${item.nome}" porque existem ${item.custosVinculados} custo(s) vinculado(s). Você pode inativá-la.`
      );
      return;
    }

    const confirmou = window.confirm(
      `Excluir definitivamente a categoria "${item.nome}"? Esta ação não poderá ser desfeita.`
    );
    if (!confirmou) return;

    const r = await fetch(rota, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id }),
    });

    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      setErro(d.erro ?? "Não foi possível excluir a categoria.");
      return;
    }

    await carregar();
    router.refresh();
  }
  async function alternar(item: Registro) {
    setErro(null);
    const corpo = tipo === "cliente"
      ? { id: item.id, ativo: !item.ativo }
      : { id: item.id, ativa: !item.ativo };
    const r = await fetch(rota, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo),
    });
    if (!r.ok) { setErro((await r.json()).erro); return; }
    await carregar(); router.refresh();
  }

  const visiveis = itens.filter((i) => {
    const texto = `${i.nomeFantasia ?? ""} ${i.razaoSocial ?? ""} ${i.nome ?? ""}`.toLowerCase();
    return !busca || texto.includes(busca.toLowerCase());
  });

  return (
    <>
      {erro && <div className="aviso erro-aviso">{erro}</div>}

      <div className="fm-cadastro-toolbar">
        <div className="fm-cadastro-contagem">
          <span>{carregando ? "Carregando..." : `${visiveis.length} registro${visiveis.length === 1 ? "" : "s"}`}</span>
          <small>{tipo === "cliente" ? "Clientes cadastrados" : "Categorias cadastradas"}</small>
        </div>
        {!somenteLeitura && <button type="button" className="botao fm-botao-novo" onClick={abrirNovo}>+ Novo {tipo === "cliente" ? "Cliente" : "Categoria"}</button>}
      </div>

      <div className="fm-filtros-operacionais fm-cadastro-filtros">
        <div className="fm-busca-operacional"><span aria-hidden="true">⌕</span><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={`Buscar ${tipo}...`} /></div>
      </div>

      <div className="cartao tabela-rolagem fm-tabela-operacional fm-cadastro-tabela">
        <table>
          <thead>
            <tr>
              {tipo === "cliente"
                ? <><th>Nome fantasia</th><th>Razão social</th><th>CNPJ</th><th>Vínculos</th></>
                : <><th>Nome</th><th>Tipo</th><th>Custos</th></>}
              <th>Situação</th>
              {!somenteLeitura && <th style={{ textAlign: "center" }}>Ações</th>}
            </tr>
          </thead>
          <tbody>
            {visiveis.map((i) => (
              <tr key={i.id}>
                {tipo === "cliente" ? (
                  <>
                    <td><strong>{i.nomeFantasia}</strong></td>
                    <td>{i.razaoSocial}</td>
                    <td>{formatarCnpj(i.cnpj)}</td>
                    <td>{i.temVinculos ? "Com documentos" : "—"}</td>
                  </>
                ) : (
                  <>
                    <td><strong>{i.nome}</strong></td>
                    <td>{i.tipo}</td>
                    <td>{i.custosVinculados ?? 0}</td>
                  </>
                )}
                <td><span className={`selo ${i.ativo ? "ok" : "off"}`}>{i.ativo ? "Ativo" : "Inativo"}</span></td>
                {!somenteLeitura && (
                  <td className="fm-col-acoes">
                    {tipo === "categoria" && (
                      <>
                        <button
                          type="button"
                          className="botao discreto mini"
                          onClick={() => abrirEdicao(i)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="botao discreto mini"
                          onClick={() => excluirCategoria(i)}
                          title={
                            (i.custosVinculados ?? 0) > 0
                              ? "Categoria com custos vinculados não pode ser excluída."
                              : "Excluir categoria"
                          }
                        >
                          Excluir
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      className="botao discreto mini"
                      onClick={() => alternar(i)}
                    >
                      {i.ativo ? "Inativar" : "Reativar"}
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {!carregando && visiveis.length === 0 && (
              <tr><td colSpan={6}><div className="vazio">Nenhum registro.</div></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {formAberto && !somenteLeitura && (
        <div className="fm-custo-modal-overlay" role="dialog" aria-modal="true" aria-label={editandoId && tipo === "categoria" ? "Editar Categoria" : `Novo ${tipo}`} onMouseDown={fecharFormulario}>
          <div className="fm-custo-modal fm-cadastro-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="fm-custo-modal-cabecalho"><h2>{editandoId && tipo === "categoria" ? "Editar · Categoria" : `Novo · ${tipo === "cliente" ? "Cliente" : "Categoria"}`}</h2><button type="button" className="fm-custo-modal-fechar" aria-label="Fechar" onClick={fecharFormulario}>×</button></div>
            <form onSubmit={criar}>
              <div className="fm-custo-modal-corpo"><section className="fm-custo-secao"><div className="fm-custo-secao-titulo">Identificação</div><div className="fm-custo-grid">
                {tipo === "cliente" ? <>
                  <div className="fm-custo-campo"><label>Razão social <b>*</b></label><input value={razaoSocial} onChange={(e) => setRazaoSocial(e.target.value)} placeholder="Nome jurídico completo" required disabled={salvando} /></div>
                  <div className="fm-custo-campo"><label>Nome fantasia <b>*</b></label><input value={nomeFantasia} onChange={(e) => setNomeFantasia(e.target.value)} placeholder="Como aparece nas telas" required disabled={salvando} /></div>
                  <div className="fm-custo-campo"><label>CNPJ</label><input value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="Opcional" disabled={salvando} /></div>
                </> : <>
                  <div className="fm-custo-campo"><label>Nome <b>*</b></label><input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Aluguel" required disabled={salvando} /></div>
                  <div className="fm-custo-campo"><label>Tipo <b>*</b></label><SelectPadrao value={tipoCusto} onChange={setTipoCusto} disabled={salvando} options={TIPOS_CUSTO.map((t) => ({ value: t, label: t }))} ariaLabel="Tipo de custo" /></div>
                </>}
              </div></section></div>
              <div className="fm-custo-modal-rodape"><button type="button" className="botao discreto" onClick={fecharFormulario} disabled={salvando}>Cancelar</button><button type="submit" className="botao" disabled={salvando}>{salvando ? "Salvando…" : editandoId && tipo === "categoria" ? "Salvar alterações" : "Cadastrar"}</button></div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}



