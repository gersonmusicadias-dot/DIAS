import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exigirSessao, podeGravar } from "@/lib/auth/guarda";
import { registrarAuditoria } from "@/lib/auditoria";

export const runtime = "nodejs";

const LIMITE_BYTES = 10 * 1024 * 1024;
const MAX_ARQUIVOS_POR_ENVIO = 10;
const TIPOS_ACEITOS =new Set(["application/pdf", "image/jpeg", "image/png"]);

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

function filtroDoLancamento(tipo: TipoLancamento, id: string) {
  switch (tipo) {
    case "custo":
      return { custoId: id };
    case "medicao":
      return { medicaoId: id };
    case "nota":
      return { notaFiscalId: id };
    case "recibo":
      return { reciboId: id };
  }
}

// Um lançamento pode ter vários anexos; o id do anexo identifica qual deles.
// Filtrar também pelo lançamento impede abrir/apagar um anexo de outro registro.
async function localizarAnexo(tipo: TipoLancamento, id: string, anexoId: string) {
  return prisma.anexoLancamento.findFirst({
    where: { id: anexoId, ...filtroDoLancamento(tipo, id) },
  });
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
  req: Request,
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

  const anexoId = new URL(req.url).searchParams.get("anexo");

  if (!anexoId) {
    const anexos = await prisma.anexoLancamento.findMany({
      where: filtroDoLancamento(tipo, id),
      select: { id: true, nomeArquivo: true, tamanhoBytes: true, mimeType: true },
      orderBy: { criadoEm: "asc" },
    });
    return NextResponse.json({ anexos });
  }

  const anexo = await localizarAnexo(tipo, id, anexoId);

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
  const arquivos = formData.getAll("arquivo");

  if (arquivos.length === 0 || !arquivos.every((a): a is File => a instanceof File)) {
    return NextResponse.json(
      { erro: "Selecione um arquivo PDF, JPEG ou PNG." },
      { status: 400 },
    );
  }

  if (arquivos.length > MAX_ARQUIVOS_POR_ENVIO) {
    return NextResponse.json(
      { erro: `Envie no máximo ${MAX_ARQUIVOS_POR_ENVIO} arquivos por vez.` },
      { status: 400 },
    );
  }

  // Valida todos antes de gravar qualquer um: um envio com um arquivo ruim
  // não deve deixar metade dos anexos salvos.
  for (const arquivo of arquivos) {
    if (!TIPOS_ACEITOS.has(arquivo.type)) {
      return NextResponse.json(
        { erro: `"${arquivo.name}": somente arquivos PDF, JPEG ou PNG são permitidos.` },
        { status: 400 },
      );
    }
    if (arquivo.size <= 0) {
      return NextResponse.json(
        { erro: `"${arquivo.name}": o arquivo está vazio.` },
        { status: 400 },
      );
    }
    if (arquivo.size > LIMITE_BYTES) {
      return NextResponse.json(
        { erro: `"${arquivo.name}": o arquivo não pode ultrapassar 10 MB.` },
        { status: 400 },
      );
    }
  }

  const criados = [];
  for (const arquivo of arquivos) {
    const anexo = await prisma.anexoLancamento.create({
      data: {
        nomeArquivo: arquivo.name || "documento",
        mimeType: arquivo.type,
        tamanhoBytes: arquivo.size,
        conteudo: Buffer.from(await arquivo.arrayBuffer()),
        ...filtroDoLancamento(tipo, id),
      },
      select: { id: true, nomeArquivo: true, tamanhoBytes: true, mimeType: true },
    });
    criados.push(anexo);

    await registrarAuditoria({
      sessao: guarda.sessao,
      modulo: nomeModulo(tipo),
      acao: "anexar_arquivo",
      registroId: id,
      descricao: `Anexo adicionado no lançamento ${nomeRegistro(tipo, registro)}.`,
      depois: { ...anexo, tipo, registroId: id },
    });
  }

  return NextResponse.json({ ok: true, anexos: criados });
}

export async function DELETE(
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

  const anexoId = new URL(req.url).searchParams.get("anexo");
  const anexo = anexoId ? await localizarAnexo(tipo, id, anexoId) : null;

  if (!anexo) {
    return NextResponse.json(
      { erro: "Anexo não encontrado neste lançamento." },
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
