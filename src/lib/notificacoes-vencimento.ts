import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { enviarEmail } from "@/lib/email";
import { financeiroDoCusto, financeiroDaNota, financeiroDoRecibo } from "@/lib/financeiro/motor";
import { paraEventos } from "@/lib/financeiro/eventos";

export const DIAS_DE_ALERTA = [15, 10, 5, 3, 2, 1, 0] as const;
const DIAS_VALIDOS = new Set<number>(DIAS_DE_ALERTA);
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

type Direcao = "pagar" | "receber";

type AlertaVencimento = {
  direcao: Direcao;
  origem: "Custo" | "Nota Fiscal" | "Recibo";
  registroId: string;
  titulo: string;
  detalhe: string;
  vencimento: string;
  dias: number;
  valor: number;
  destino: string;
};

function hojeEmSaoPaulo(): string {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const valor = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}

function diasEntre(de: string, ate: string): number {
  const [a1, m1, d1] = de.split("-").map(Number);
  const [a2, m2, d2] = ate.split("-").map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86400000);
}

function dataBR(iso: string): string {
  return iso.split("-").reverse().join("/");
}

function real(valor: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
}

function frasePrazo(dias: number): string {
  if (dias < 0) {
    const atraso = Math.abs(dias);
    return atraso === 1 ? "venceu há 1 dia" : `venceu há ${atraso} dias`;
  }
  if (dias === 0) return "vence hoje";
  if (dias === 1) return "vence amanhã";
  return `vence em ${dias} dias`;
}

function mensagemDoAlerta(a: AlertaVencimento): string {
  const tipo = a.direcao === "pagar" ? "Conta a pagar" : "Conta a receber";
  const valor = a.direcao === "pagar" ? "Valor a pagar" : "Valor a receber";
  return `${tipo} ${frasePrazo(a.dias)} · ${a.titulo} · ${dataBR(a.vencimento)} · ${valor}: ${real(a.valor)}.`;
}

function htmlDoAlerta(nome: string, a: AlertaVencimento): string {
  const tipo = a.direcao === "pagar" ? "Conta a pagar" : "Conta a receber";
  const linkBase = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  const link = linkBase ? `${linkBase}${a.destino}` : null;
  return `
  <div style="margin:0;padding:32px 16px;background:#f2f6fa;font-family:Segoe UI,Helvetica,Arial,sans-serif">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #dbe4ee;border-radius:14px;overflow:hidden">
      <div style="padding:24px;text-align:center;border-bottom:1px solid #eef3f8">
        <div style="font-size:18px;font-weight:700;letter-spacing:.14em;color:#0d2440">FLUXOMED</div>
        <div style="font-size:11px;font-weight:600;letter-spacing:.35em;color:#0f7fb5;margin-top:2px">MARICÁ</div>
      </div>
      <div style="padding:28px 24px;color:#0d2440;font-size:14px;line-height:1.6">
        <p style="margin:0 0 14px">Olá, <strong>${nome}</strong>.</p>
        <p style="margin:0 0 18px">Há um compromisso financeiro próximo do vencimento.</p>
        <div style="padding:16px;border:1px solid #dbe4ee;border-radius:10px;background:#f7fbfe">
          <strong>${tipo} — ${frasePrazo(a.dias)}</strong><br>
          ${a.titulo}<br>
          <span style="color:#6b8299">${a.detalhe}</span><br>
          Vencimento: <strong>${dataBR(a.vencimento)}</strong><br>
          ${a.direcao === "pagar" ? "Valor a pagar" : "Valor a receber"}: <strong>${real(a.valor)}</strong>
        </div>
        ${link ? `<p style="text-align:center;margin:22px 0 0"><a href="${link}" style="display:inline-block;padding:12px 24px;border-radius:10px;background:#0f7fb5;color:#fff;font-weight:600;text-decoration:none">Abrir no FluxoMed</a></p>` : ""}
      </div>
      <div style="padding:16px 24px;border-top:1px solid #eef3f8;color:#6b8299;font-size:11px;text-align:center">Gestão financeira · mensagem automática, não responda a este e-mail.</div>
    </div>
  </div>`;
}

export async function listarAlertasDeVencimento(hoje = hojeEmSaoPaulo()): Promise<AlertaVencimento[]> {
  const [custos, notas, recibos] = await Promise.all([
    prisma.custo.findMany({ include: { categoria: { select: { nome: true } }, pagamentos: true } }),
    prisma.notaFiscal.findMany({ include: { cliente: { select: { nomeFantasia: true } }, recebimentos: true } }),
    prisma.recibo.findMany({ where: { substituidoPor: null }, include: { cliente: { select: { nomeFantasia: true } }, recebimentos: true } }),
  ]);

  const alertas: AlertaVencimento[] = [];

  for (const c of custos) {
    if (!DATA_ISO.test(c.vencimento)) continue;
    const saldo = financeiroDoCusto({
      id: c.id, descricao: c.descricao, tipo: c.tipo, competencia: c.competencia,
      vencimento: c.vencimento, valorPrevisto: c.valorPrevisto, categoriaNome: c.categoria?.nome,
      pagamentos: paraEventos(c.pagamentos),
    }).saldo;
    const dias = diasEntre(hoje, c.vencimento);
    if (saldo <= 0 || (dias >= 0 && !DIAS_VALIDOS.has(dias))) continue;
    alertas.push({ direcao: "pagar", origem: "Custo", registroId: c.id, titulo: c.descricao, detalhe: c.categoria?.nome ?? c.tipo, vencimento: c.vencimento, dias, valor: saldo, destino: "/custos" });
  }

  for (const n of notas) {
    if (!n.dataEmissao || !n.previsaoRecebimento || !DATA_ISO.test(n.previsaoRecebimento)) continue;
    const saldo = financeiroDaNota({
      id: n.id, numero: n.numero, competencia: n.competencia, dataEmissao: n.dataEmissao,
      status: n.status, valorPrevisto: n.valorPrevisto, valorNota: n.valorNota,
      previsaoRecebimento: n.previsaoRecebimento, clienteNome: n.cliente.nomeFantasia,
      recebimentos: paraEventos(n.recebimentos),
    }).saldo;
    const dias = diasEntre(hoje, n.previsaoRecebimento);
    if (saldo <= 0 || (dias >= 0 && !DIAS_VALIDOS.has(dias))) continue;
    alertas.push({ direcao: "receber", origem: "Nota Fiscal", registroId: n.id, titulo: `NF ${n.numero}`, detalhe: n.cliente.nomeFantasia, vencimento: n.previsaoRecebimento, dias, valor: saldo, destino: "/notas-fiscais" });
  }

  for (const r of recibos) {
    if (!r.dataEmissao || !r.previsaoRecebimento || !DATA_ISO.test(r.previsaoRecebimento)) continue;
    const saldo = financeiroDoRecibo({
      id: r.id, identificador: r.identificador, competencia: r.competencia, dataEmissao: r.dataEmissao,
      valorPrevisto: r.valorPrevisto, valorRecibo: r.valorRecibo,
      previsaoRecebimento: r.previsaoRecebimento, clienteNome: r.cliente.nomeFantasia,
      recebimentos: paraEventos(r.recebimentos),
    }).saldo;
    const dias = diasEntre(hoje, r.previsaoRecebimento);
    if (saldo <= 0 || (dias >= 0 && !DIAS_VALIDOS.has(dias))) continue;
    alertas.push({ direcao: "receber", origem: "Recibo", registroId: r.id, titulo: r.identificador, detalhe: r.cliente.nomeFantasia, vencimento: r.previsaoRecebimento, dias, valor: saldo, destino: "/recibos" });
  }

  return alertas.sort((a, b) => a.dias - b.dias || b.valor - a.valor);
}

export async function processarNotificacoesVencimento(hoje = hojeEmSaoPaulo()) {
  const [alertas, usuarios] = await Promise.all([
    listarAlertasDeVencimento(hoje),
    prisma.usuario.findMany({ where: { ativo: true }, include: { preferenciaNotificacao: true } }),
  ]);

  let criadas = 0;
  let emailsEnviados = 0;
  let emailsFalharam = 0;

  for (const usuario of usuarios) {
    const pref = usuario.preferenciaNotificacao;
    for (const alerta of alertas) {
      if (alerta.direcao === "pagar" && pref?.notificarPagar === false) continue;
      if (alerta.direcao === "receber" && pref?.notificarReceber === false) continue;
      if (alerta.dias < 0 && pref?.notificarVencidos === false) continue;

      // Alertas futuros têm marcos próprios (15, 10, 5...). Para vencidos,
      // usa uma chave única por documento/vencimento para não criar um novo
      // aviso a cada dia de atraso.
      const marco = alerta.dias < 0 ? "vencido" : String(alerta.dias);
      const chave = `venc:${usuario.id}:${alerta.origem}:${alerta.registroId}:${alerta.vencimento}:${marco}`;
      const mensagem = mensagemDoAlerta(alerta);
      let notificacao = await prisma.notificacaoFinanceira.findUnique({ where: { chave } });

      if (!notificacao) {
        try {
          notificacao = await prisma.notificacaoFinanceira.create({
            data: {
              chave, usuarioId: usuario.id, direcao: alerta.direcao, origem: alerta.origem,
              registroId: alerta.registroId, titulo: alerta.titulo, mensagem,
              vencimento: alerta.vencimento, diasAntecedencia: alerta.dias,
              valor: alerta.valor, destino: alerta.destino,
            },
          });
          criadas++;
        } catch (erro) {
          if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
            notificacao = await prisma.notificacaoFinanceira.findUnique({ where: { chave } });
          } else {
            throw erro;
          }
        }
      }

      if (!notificacao) continue;

      const receberEmail = pref?.receberEmail ?? false;
      if (receberEmail && !notificacao.emailEnviadoEm) {
        const para = pref?.emailNotificacao || usuario.email;
        const assunto = `[FluxoMed] ${alerta.direcao === "pagar" ? "Pagamento" : "Recebimento"} ${frasePrazo(alerta.dias)}`;
        const envio = await enviarEmail(para, assunto, htmlDoAlerta(usuario.nome, alerta));
        if (envio.enviado) {
          await prisma.notificacaoFinanceira.update({ where: { id: notificacao.id }, data: { emailEnviadoEm: new Date(), emailErro: null } });
          emailsEnviados++;
        } else {
          await prisma.notificacaoFinanceira.update({ where: { id: notificacao.id }, data: { emailErro: envio.motivo?.slice(0, 1000) ?? "Falha não identificada no envio." } });
          emailsFalharam++;
        }
      }
    }
  }

  return { hoje, usuarios: usuarios.length, alertas: alertas.length, criadas, emailsEnviados, emailsFalharam };
}
