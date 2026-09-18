import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirSessao, podeGravar } from "@/lib/auth/guarda";
import { registrarAuditoria } from "@/lib/auditoria";

export const runtime = "nodejs";

const LIMITE_BYTES = 10 * 1024 * 1024;
const TIPOS_ACEITOS = new Set(["application/pdf", "image/jpeg", "image/png"]);

type TipoLancamento = "custo" | "medicao" | "nota" | "recibo";

function validarTipo(tipo: string): tipo is TipoLancamento {
  return ["custo", "medicao", "nota", "recibo"].includes(tipo);
}

function nomeModulo(tipo: TipoLancamento) {
  switch (tipo) {
    case "custo":
      return "Custos";
    case "medicao":
      return "Medições";
    case "nota":
      return "Notas Fiscais";
    case "recibo":
      return "Recibos";
  }
}

function nomeRegistro(
  tipo: TipoLancamento,
  registro: { id: string; descricao?: string | null; identificador?: string | null; numero?: string | null },
) {
  switch (tipo) {
    case "custo":
      return registro.descricao ?? registro.id;
    case "medicao":
      return registro.identificador ?? registro.id;
    case "nota":
      return registro.numero ?? registro.id;
    case "recibo":
      return registro.identificador ?? registro.id;
  }
}

async function localizarAnexo(tipo: TipoLancamento, id: string) {
  switch (tipo) {
    case "custo":
      return prisma.anexoLancamento.findUnique({
        where: { custoId: id },
      });

    case "medicao":
      return prisma.anexoLancamento.findUnique({
        where: { medicaoId: id },
      });

    case "nota":
      return prisma.anexoLancamento.findUnique({
        where: { notaFiscalId: id },
      });

    case "recibo":
      return prisma.anexoLancamento.findUnique({
        where: { reciboId: id },
      });
  }
}

async function localizarRegistro(tipo: TipoLancamento, id: string) {
  switch (tipo) {
    case "custo":
      return prisma.custo.findUnique({ where: { id } });

    case "medicao":
      return prisma.medicao.findUnique({ where: { id } });

    case "nota":
      return prisma.notaFiscal.findUnique({ where: { id } });

    case "recibo":
      return prisma.recibo.findUnique({ where: { id } });
  }
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ tipo: string; id: string }> },
) {
  const guarda = await exigirSessao();
  if (guarda.erro) return guarda.erro;

  const { tipo, id } = await context.params;

  if (!validarTipo(tipo)) {
    return NextResponse.json(
      { erro: "Tipo de lançamento inválido." },
      { status: 400 },
    );
  }

  const anexo = await localizarAnexo(tipo, id);

  if (!anexo) {
    return NextResponse.json(
      { erro: "Nenhum anexo encontrado para este lançamento." },
      { status: 404 },
    );
  }

  return new NextResponse(Buffer.from(anexo.conteudo), {
    status: 200,
    headers: {
      "Content-Type": anexo.mimeType || "application/pdf",
      "Content-Length": String(anexo.tamanhoBytes),
      "Content-Disposition": `inline; filename="${encodeURIComponent(anexo.nomeArquivo)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export async function POST(
  req: Request,
  context: { params: Promise<{ tipo: string; id: string }> },
) {
  const guarda = await podeGravar();
  if (guarda.erro) return guarda.erro;

  const { tipo, id } = await context.params;

  if (!validarTipo(tipo)) {
    return NextResponse.json(
      { erro: "Tipo de lançamento inválido." },
      { status: 400 },
    );
  }

  const registro = await localizarRegistro(tipo, id);

  if (!registro) {
    return NextResponse.json(
      { erro: "Lançamento não encontrado." },
      { status: 404 },
    );
  }

  const formData = await req.formData();
  const arquivo = formData.get("arquivo");

  if (!(arquivo instanceof File)) {
    return NextResponse.json(
      { erro: "Selecione um arquivo PDF, JPEG ou PNG." },
      { status: 400 },
    );
  }

  if (!TIPOS_ACEITOS.has(arquivo.type)) {
    return NextResponse.json(
      { erro: "Somente arquivos PDF, JPEG ou PNG são permitidos." },
      { status: 400 },
    );
  }

  if (arquivo.size <= 0) {
    return NextResponse.json(
      { erro: "O arquivo está vazio." },
      { status: 400 },
    );
  }

  if (arquivo.size > LIMITE_BYTES) {
    return NextResponse.json(
      { erro: "O arquivo não pode ultrapassar 10 MB." },
      { status: 400 },
    );
  }

  const conteudo = Buffer.from(await arquivo.arrayBuffer());
  const dadosBase = {
    nomeArquivo: arquivo.name || "documento",
    mimeType: arquivo.type,
    tamanhoBytes: arquivo.size,
    conteudo,
  };

  const anexoAnterior = await localizarAnexo(tipo, id);

  let anexo;

  switch (tipo) {
    case "custo":
      anexo = await prisma.anexoLancamento.upsert({
        where: { custoId: id },
        create: { ...dadosBase, custoId: id },
        update: dadosBase,
      });
      break;

    case "medicao":
      anexo = await prisma.anexoLancamento.upsert({
        where: { medicaoId: id },
        create: { ...dadosBase, medicaoId: id },
        update: dadosBase,
      });
      break;

    case "nota":
      anexo = await prisma.anexoLancamento.upsert({
        where: { notaFiscalId: id },
        create: { ...dadosBase, notaFiscalId: id },
        update: dadosBase,
      });
      break;

    case "recibo":
      anexo = await prisma.anexoLancamento.upsert({
        where: { reciboId: id },
        create: { ...dadosBase, reciboId: id },
        update: dadosBase,
      });
      break;
  }

  await registrarAuditoria({
    sessao: guarda.sessao,
    modulo: nomeModulo(tipo),
    acao: anexoAnterior ? "substituir_anexo" : "anexar_arquivo",
    registroId: id,
    descricao: `${anexoAnterior ? "Anexo substituído" : "Anexo adicionado"} no lançamento ${nomeRegistro(tipo, registro)}.`,
    depois: {
      id: anexo.id,
      nomeArquivo: anexo.nomeArquivo,
      tamanhoBytes: anexo.tamanhoBytes,
      tipo,
      registroId: id,
    },
  });

  return NextResponse.json({
    ok: true,
    anexo: {
      id: anexo.id,
      nomeArquivo: anexo.nomeArquivo,
      tamanhoBytes: anexo.tamanhoBytes,
      mimeType: anexo.mimeType,
      criadoEm: anexo.criadoEm,
      atualizadoEm: anexo.atualizadoEm,
    },
  });
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ tipo: string; id: string }> },
) {
  const guarda = await podeGravar();
  if (guarda.erro) return guarda.erro;

  const { tipo, id } = await context.params;

  if (!validarTipo(tipo)) {
    return NextResponse.json(
      { erro: "Tipo de lançamento inválido." },
      { status: 400 },
    );
  }

  const anexo = await localizarAnexo(tipo, id);

  if (!anexo) {
    return NextResponse.json(
      { erro: "Nenhum anexo encontrado para este lançamento." },
      { status: 404 },
    );
  }

  await prisma.anexoLancamento.delete({
    where: { id: anexo.id },
  });

  await registrarAuditoria({
    sessao: guarda.sessao,
    modulo: nomeModulo(tipo),
    acao: "remover_anexo",
    registroId: id,
    descricao: `Anexo removido do lançamento ${id}.`,
    antes: {
      id: anexo.id,
      nomeArquivo: anexo.nomeArquivo,
      tamanhoBytes: anexo.tamanhoBytes,
      tipo,
      registroId: id,
    },
  });

  return NextResponse.json({ ok: true });
}
