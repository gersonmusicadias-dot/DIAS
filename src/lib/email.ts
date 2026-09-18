import nodemailer from "nodemailer";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

/**
 * Envio de e-mail.
 *
 * Enquanto o SMTP não estiver configurado, NADA é enviado e nada finge que
 * foi: a mensagem é gravada em .outbox/ e a função devolve enviado:false.
 * Quem chamou decide o que mostrar ao administrador. Não existe "e-mail
 * silenciosamente perdido" aqui.
 */

export interface ResultadoEnvio {
  enviado: boolean;
  motivo?: string;
  arquivo?: string;
}

function smtpConfigurado(): boolean {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.EMAIL_REMETENTE
  );
}

// Em hospedagem serverless o disco é somente leitura: falhar ao gravar a
// cópia local não pode esconder nem derrubar o resultado real do envio.
async function gravarNaCaixaDeSaida(
  para: string,
  assunto: string,
  html: string
): Promise<string | undefined> {
  try {
    return await gravarArquivoDeSaida(para, assunto, html);
  } catch {
    return undefined;
  }
}

async function gravarArquivoDeSaida(
  para: string,
  assunto: string,
  html: string
): Promise<string> {
  const pasta = path.join(process.cwd(), ".outbox");
  await mkdir(pasta, { recursive: true });
  const nome = `${Date.now()}-${para.replace(/[^a-z0-9]/gi, "_")}.html`;
  const destino = path.join(pasta, nome);
  await writeFile(
    destino,
    `<!doctype html><meta charset="utf-8">\n<!-- Para: ${para} -->\n<!-- Assunto: ${assunto} -->\n${html}`,
    "utf8"
  );
  return destino;
}

export async function enviarEmail(
  para: string,
  assunto: string,
  html: string
): Promise<ResultadoEnvio> {
  if (!smtpConfigurado()) {
    const arquivo = await gravarNaCaixaDeSaida(para, assunto, html);
    return {
      enviado: false,
      motivo: "SMTP não configurado — a mensagem foi gravada em .outbox/ para conferência.",
      arquivo,
    };
  }

  try {
    const porta = Number(process.env.SMTP_PORT);
    const transporte = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: porta,
      secure: porta === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transporte.sendMail({
      from: process.env.EMAIL_REMETENTE,
      to: para,
      subject: assunto,
      html,
    });
    return { enviado: true };
  } catch (erro) {
    const arquivo = await gravarNaCaixaDeSaida(para, assunto, html);
    return {
      enviado: false,
      motivo: `Falha no envio: ${(erro as Error).message}`,
      arquivo,
    };
  }
}

const CORPO = (conteudo: string) => `
<div style="margin:0;padding:32px 16px;background:#f2f6fa;font-family:Segoe UI,Helvetica,Arial,sans-serif">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #dbe4ee;border-radius:14px;overflow:hidden">
    <div style="padding:24px;text-align:center;border-bottom:1px solid #eef3f8">
      <div style="font-size:18px;font-weight:700;letter-spacing:.14em;color:#0d2440">FLUXOMED</div>
      <div style="font-size:11px;font-weight:600;letter-spacing:.35em;color:#0f7fb5;margin-top:2px">MARICÁ</div>
    </div>
    <div style="padding:28px 24px;color:#0d2440;font-size:14px;line-height:1.6">${conteudo}</div>
    <div style="padding:16px 24px;border-top:1px solid #eef3f8;color:#6b8299;font-size:11px;text-align:center">
      Gestão financeira · mensagem automática, não responda a este e-mail.
    </div>
  </div>
</div>`;

export function emailDeConvite(nome: string, senha: string, link: string): string {
  return CORPO(`
    <p style="margin:0 0 14px">Olá, <strong>${nome}</strong>.</p>
    <p style="margin:0 0 18px">Seu acesso ao FluxoMed Maricá foi criado. Use a senha provisória
      abaixo para entrar; assim que acessar, o sistema vai pedir que você defina uma senha só sua.</p>

    <div style="margin:0 0 22px;padding:16px;border:1px dashed #b9cddd;border-radius:10px;background:#f7fbfe;text-align:center">
      <div style="font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#6b8299">Senha provisória</div>
      <div style="margin-top:6px;font-size:22px;font-weight:700;letter-spacing:.08em;font-family:Consolas,Menlo,monospace;color:#0d2440">${senha}</div>
    </div>

    <div style="text-align:center;margin:0 0 20px">
      <a href="${link}" style="display:inline-block;padding:13px 30px;border-radius:10px;background:#0f7fb5;color:#ffffff;font-weight:600;text-decoration:none">
        Acessar o sistema
      </a>
    </div>

    <p style="margin:0;color:#6b8299;font-size:12px">
      A senha provisória só serve para o primeiro acesso e expira quando você define a sua.
      Se você não esperava este convite, ignore esta mensagem.
    </p>
  `);
}

export function emailDeNovaSenhaProvisoria(nome: string, senha: string, link: string): string {
  return CORPO(`
    <p style="margin:0 0 14px">Olá, <strong>${nome}</strong>.</p>
    <p style="margin:0 0 18px">Um administrador redefiniu a sua senha do FluxoMed Maricá.
      A senha anterior não vale mais. Use a provisória abaixo para entrar; ao acessar,
      o sistema vai pedir que você defina uma senha só sua.</p>

    <div style="margin:0 0 22px;padding:16px;border:1px dashed #b9cddd;border-radius:10px;background:#f7fbfe;text-align:center">
      <div style="font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#6b8299">Senha provisória</div>
      <div style="margin-top:6px;font-size:22px;font-weight:700;letter-spacing:.08em;font-family:Consolas,Menlo,monospace;color:#0d2440">${senha}</div>
    </div>

    <div style="text-align:center;margin:0 0 20px">
      <a href="${link}" style="display:inline-block;padding:13px 30px;border-radius:10px;background:#0f7fb5;color:#ffffff;font-weight:600;text-decoration:none">
        Acessar o sistema
      </a>
    </div>

    <p style="margin:0;color:#6b8299;font-size:12px">
      Se você não pediu esta redefinição, avise o administrador: alguém com acesso de
      administrador alterou a sua conta.
    </p>
  `);
}
