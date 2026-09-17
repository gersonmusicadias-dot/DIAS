/**
 * Permissões nas APIs, contra o servidor rodando.
 *
 * O que precisa ser provado: nenhuma rota financeira responde a quem não
 * deveria — nem sem sessão, nem com senha provisória pendente, nem com
 * perfil de leitura tentando gravar.
 *
 *   npm run dev        (em outro terminal)
 *   npm run testar-permissoes
 */
import { PrismaClient } from "@prisma/client";
import { gerarHash } from "../src/lib/auth/senha";

const prisma = new PrismaClient();
const BASE = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3100";
const MARCA = "teste.perm.";

let ok = 0;
let falhas = 0;

function checar(nome: string, condicao: boolean, detalhe = "") {
  if (condicao) { ok += 1; console.log("  [OK]  " + nome + (detalhe ? "   -> " + detalhe : "")); }
  else { falhas += 1; console.log("  [FALHA] " + nome + (detalhe ? "   -> " + detalhe : "")); }
}

/** Sessão isolada: guarda o cookie desta "pessoa" e o envia nas chamadas. */
function criarSessao() {
  let cookie = "";
  return {
    async chamar(caminho: string, init: RequestInit = {}) {
      const r = await fetch(BASE + caminho, {
        ...init,
        headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}), ...(init.headers ?? {}) },
        redirect: "manual",
      });
      const set = r.headers.get("set-cookie");
      if (set) cookie = set.split(";")[0];
      return r;
    },
    limpar() { cookie = ""; },
  };
}

const ROTAS_LEITURA = ["/api/custos", "/api/medicoes", "/api/notas", "/api/recibos",
  "/api/clientes", "/api/categorias", "/api/fluxo-caixa"];

async function limpar() {
  await prisma.sessao.deleteMany({ where: { usuario: { email: { startsWith: MARCA } } } });
  await prisma.registroAcesso.deleteMany({ where: { email: { startsWith: MARCA } } });
  await prisma.usuario.deleteMany({ where: { email: { startsWith: MARCA } } });
}

async function principal() {
  console.log("=".repeat(72));
  console.log("PERMISSÕES — quem pode o quê, em cada rota");
  console.log("=".repeat(72));
  console.log("");

  const ligado = await fetch(BASE + "/login").then(() => true).catch(() => false);
  if (!ligado) {
    console.log("  Servidor não está no ar em " + BASE);
    console.log("  Rode 'npm run dev' em outro terminal e tente de novo.");
    process.exit(2);
  }

  await limpar();

  // ---------------- Sem sessão ----------------
  const anonimo = criarSessao();
  for (const rota of ROTAS_LEITURA) {
    const r = await anonimo.chamar(rota);
    checar(`1. Sem sessão, ${rota} recusa`, r.status === 401, String(r.status));
  }

  // ---------------- Com troca de senha pendente ----------------
  const senhaProv = "Provisoria2031";
  await prisma.usuario.create({
    data: {
      nome: "Teste Pendente", email: MARCA + "pendente@exemplo.com",
      senhaHash: await gerarHash(senhaProv), papel: "ADMIN", trocarSenha: true,
    },
  });
  const pendente = criarSessao();
  await pendente.chamar("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: MARCA + "pendente@exemplo.com", senha: senhaProv }),
  });
  for (const rota of ROTAS_LEITURA) {
    const r = await pendente.chamar(rota);
    checar(`2. Senha provisória pendente, ${rota} recusa`, r.status === 403, String(r.status));
  }

  const impressaoPrimeiroAcesso = await pendente.chamar("/recibos/id-inexistente-f06/imprimir");
checar("2b. Impressao bloqueia primeiro acesso", impressaoPrimeiroAcesso.status === 307 && (impressaoPrimeiroAcesso.headers.get("location") ?? "").includes("/primeiro-acesso"), String(impressaoPrimeiroAcesso.status) + " -> " + (impressaoPrimeiroAcesso.headers.get("location") ?? "sem location"));

// ---------------- Perfil LEITURA ----------------
  const senhaLeitura = "Leitura2031Abc";
  await prisma.usuario.create({
    data: {
      nome: "Teste Leitura", email: MARCA + "leitura@exemplo.com",
      senhaHash: await gerarHash(senhaLeitura), papel: "LEITURA", trocarSenha: false,
    },
  });
  const leitor = criarSessao();
  await leitor.chamar("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: MARCA + "leitura@exemplo.com", senha: senhaLeitura }),
  });

  const podeLer = await leitor.chamar("/api/custos");
  checar("3. Perfil LEITURA consegue consultar", podeLer.status === 200, String(podeLer.status));

  const gravacoes: [string, unknown][] = [
    ["/api/custos", { descricao: "x", tipo: "Custo Fixo", competencia: "2031-01", vencimento: "2031-01-10", valorPrevisto: 1 }],
    ["/api/clientes", { razaoSocial: "xx", nomeFantasia: "xx" }],
    ["/api/categorias", { nome: "xx", tipo: "Custo Fixo" }],
    ["/api/medicoes", { clienteId: "x", identificador: "x", competencia: "2031-01", periodoInicio: "2031-01-01", periodoFim: "2031-01-31", valorPrevisto: 1 }],
    ["/api/notas", { clienteId: "x", numero: "x", competencia: "2031-01", valorPrevisto: 1 }],
    ["/api/recibos", { clienteId: "x", identificador: "x", descricao: "xx", competencia: "2031-01", valorPrevisto: 1 }],
    ["/api/fluxo-caixa", { valor: 1, dataReferencia: "2031-01-01" }],
  ];
  for (const [rota, corpo] of gravacoes) {
    const r = await leitor.chamar(rota, { method: "POST", body: JSON.stringify(corpo) });
    checar(`3b. LEITURA não grava em ${rota}`, r.status === 403, String(r.status));
  }

  const usuariosParaLeitor = await leitor.chamar("/api/usuarios");
  checar("3c. LEITURA não enxerga a lista de usuários", usuariosParaLeitor.status === 403,
    String(usuariosParaLeitor.status));

  // ---------------- Perfil OPERADOR ----------------
  const senhaOp = "Operador2031Ab";
  await prisma.usuario.create({
    data: {
      nome: "Teste Operador", email: MARCA + "operador@exemplo.com",
      senhaHash: await gerarHash(senhaOp), papel: "OPERADOR", trocarSenha: false,
    },
  });
  const operador = criarSessao();
  await operador.chamar("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: MARCA + "operador@exemplo.com", senha: senhaOp }),
  });

  const opCategoria = await operador.chamar("/api/categorias", {
    method: "POST", body: JSON.stringify({ nome: MARCA + "cat", tipo: "Custo Fixo" }),
  });
  checar("4. OPERADOR grava no financeiro", opCategoria.status === 200, String(opCategoria.status));
  if (opCategoria.status === 200) {
    await prisma.categoria.deleteMany({ where: { nome: { startsWith: MARCA } } });
  }

  const opUsuarios = await operador.chamar("/api/usuarios");
  checar("4b. OPERADOR não administra usuários", opUsuarios.status === 403, String(opUsuarios.status));

  const opConvite = await operador.chamar("/api/usuarios", {
    method: "POST", body: JSON.stringify({ nome: "Invasor", email: "invasor@x.com", papel: "ADMIN" }),
  });
  checar("4c. OPERADOR não se promove cadastrando um ADMIN", opConvite.status === 403,
    String(opConvite.status));

  const impressaoAutorizada = await operador.chamar("/recibos/cmtqnef6j0001j7ww3v2r8h56/imprimir");
checar("4d. Usuario autorizado continua acessando impressao de recibo",
  impressaoAutorizada.status === 200, String(impressaoAutorizada.status));

  // ---------------- Revogação: o que o administrador faz vale AGORA ----------------
  // Um JWT é uma foto do login, e vale até expirar. Se o acesso fosse
  // decidido só por ele, tirar alguém do sistema não tiraria o acesso da
  // pessoa — só dias depois, quando o token vencesse.
  const senhaChefe = "Chefia2031Abc";
  const chefe = await prisma.usuario.create({
    data: {
      nome: "Teste Chefe", email: MARCA + "chefe@exemplo.com",
      senhaHash: await gerarHash(senhaChefe), papel: "ADMIN", trocarSenha: false,
    },
  });
  const sessaoChefe = criarSessao();
  await sessaoChefe.chamar("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: MARCA + "chefe@exemplo.com", senha: senhaChefe }),
  });

  const senhaRev = "Revogado2031Ab";
  const revogado = await prisma.usuario.create({
    data: {
      nome: "Teste Revogado", email: MARCA + "revogado@exemplo.com",
      senhaHash: await gerarHash(senhaRev), papel: "ADMIN", trocarSenha: false,
    },
  });
  const vitima = criarSessao();
  await vitima.chamar("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: MARCA + "revogado@exemplo.com", senha: senhaRev }),
  });
  checar("5. Sessão recém-aberta funciona",
    (await vitima.chamar("/api/custos")).status === 200);

  const sessaoInativa = await prisma.sessao.findFirst({
  where: { usuarioId: revogado.id, revogadaEm: null },
  orderBy: { criadaEm: "desc" },
});
if (!sessaoInativa) throw new Error("Sessao de teste nao encontrada para validar inatividade");

await prisma.sessao.update({
  where: { id: sessaoInativa.id },
  data: { ultimaAtividadeEm: new Date(Date.now() - 16 * 60 * 1000) },
});

const respostaImpressaoInativa = await vitima.chamar("/recibos/id-inexistente-f06/imprimir");
checar(
  "5a. Impressao bloqueia sessao inativa antes de consultar recibo",
  respostaImpressaoInativa.status >= 300 && respostaImpressaoInativa.status < 400 && (respostaImpressaoInativa.headers.get("location") ?? "").includes("/api/auth/encerrar"),
  String(respostaImpressaoInativa.status) + " -> " + (respostaImpressaoInativa.headers.get("location") ?? "sem location")
);

const respostaInatividade = await vitima.chamar("/api/custos");
checar(
  "5a. Sessao expira apos 15 minutos de inatividade",
  respostaInatividade.status === 401,
  String(respostaInatividade.status)
);

await vitima.chamar("/api/auth/login", {
  method: "POST",
  body: JSON.stringify({ email: MARCA + "revogado@exemplo.com", senha: senhaRev }),
});
// Rebaixar o perfil: sem novo login, o poder tem de cair na hora.
  await sessaoChefe.chamar(`/api/usuarios/${revogado.id}`, {
    method: "PATCH", body: JSON.stringify({ papel: "LEITURA" }),
  });
  const depoisDoRebaixamento = await vitima.chamar("/api/categorias", {
    method: "POST", body: JSON.stringify({ nome: MARCA + "x", tipo: "Custo Fixo" }),
  });
  checar("5b. Rebaixado para LEITURA perde a gravação sem precisar relogar",
    depoisDoRebaixamento.status === 403, String(depoisDoRebaixamento.status));
  checar("5c. E perde a administração de usuários",
    (await vitima.chamar("/api/usuarios")).status === 403, "");
  checar("5d. Mas continua conseguindo consultar",
    (await vitima.chamar("/api/custos")).status === 200, "rebaixar não é expulsar");

  // Inativar a conta: o acesso acaba, com o mesmo cookie na mão.
  const inativacao = await sessaoChefe.chamar(`/api/usuarios/${revogado.id}`, {
    method: "PATCH", body: JSON.stringify({ ativo: false }),
  });
  checar("6. Inativação aceita pelo administrador", inativacao.status === 200, String(inativacao.status));
  checar("6b. E derruba na hora a sessão que já estava aberta",
    (await vitima.chamar("/api/custos")).status === 401, "");
const impressaoInativada = await vitima.chamar("/recibos/id-inexistente-f06/imprimir");
checar("6b2. Impressao bloqueia conta inativada", impressaoInativada.status === 307 && (impressaoInativada.headers.get("location") ?? "").includes("/api/auth/encerrar"), String(impressaoInativada.status) + " -> " + (impressaoInativada.headers.get("location") ?? "sem location"));

  // Reativar devolve a conta, não as sessões antigas: houve um intervalo em
  // que aquela pessoa devia estar fora, e o cookie dela circulou nele.
  await sessaoChefe.chamar(`/api/usuarios/${revogado.id}`, {
    method: "PATCH", body: JSON.stringify({ ativo: true, papel: "ADMIN" }),
  });
  checar("6c. Reativar a conta não ressuscita a sessão revogada",
    (await vitima.chamar("/api/custos")).status === 401, "");

  const novaSessao = criarSessao();
  await novaSessao.chamar("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: MARCA + "revogado@exemplo.com", senha: senhaRev }),
  });
  checar("6d. Mas um login novo funciona",
    (await novaSessao.chamar("/api/custos")).status === 200, "");

  // Sair encerra a sessão de verdade, não só o cookie do navegador.
  await novaSessao.chamar("/api/auth/logout", { method: "POST" });
  checar("6e. Depois de sair, o mesmo cookie não vale mais",
    (await novaSessao.chamar("/api/custos")).status === 401, "");
  checar("6f. E a sessão do outro aparelho continua de pé",
    (await sessaoChefe.chamar("/api/custos")).status === 200,
    "sair no escritório não derruba o celular");

  // Redefinir a senha de alguém derruba as sessões daquela pessoa.
  const outroLogin = criarSessao();
  await outroLogin.chamar("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: MARCA + "revogado@exemplo.com", senha: senhaRev }),
  });
  checar("6g. Sessão aberta antes da redefinição",
    (await outroLogin.chamar("/api/custos")).status === 200, "");
  const redefinicao = await sessaoChefe.chamar(`/api/usuarios/${revogado.id}/senha`, { method: "POST" });
  checar("6h. Administrador redefine a senha", redefinicao.status === 200, String(redefinicao.status));
  checar("6i. E a sessao que usava a senha antiga cai",
  (await outroLogin.chamar("/api/custos")).status === 401, "");
const impressaoAposReset = await outroLogin.chamar("/recibos/id-inexistente-f06/imprimir");
checar("6i2. Impressao bloqueia sessao revogada por redefinicao de senha",
  impressaoAposReset.status === 307 && (impressaoAposReset.headers.get("location") ?? "").includes("/api/auth/encerrar"),
  String(impressaoAposReset.status) + " -> " + (impressaoAposReset.headers.get("location") ?? "sem location"));
  // ---------------- O administrador não se tranca para fora ----------------
  // Errar isso não dá erro nenhum na hora: a pessoa clica, sai da tela e
  // descobre depois que ninguém mais consegue cadastrar usuário.
  const seInativar = await sessaoChefe.chamar(`/api/usuarios/${chefe.id}`, {
    method: "PATCH", body: JSON.stringify({ ativo: false }),
  });
  checar("7. Administrador não inativa a própria conta",
    seInativar.status === 400, String(seInativar.status));

  const seRebaixar = await sessaoChefe.chamar(`/api/usuarios/${chefe.id}`, {
    method: "PATCH", body: JSON.stringify({ papel: "LEITURA" }),
  });
  checar("7b. Administrador não rebaixa o próprio perfil",
    seRebaixar.status === 400, String(seRebaixar.status));

  const seRedefinir = await sessaoChefe.chamar(`/api/usuarios/${chefe.id}/senha`, { method: "POST" });
  checar("7c. Nem redefine a própria senha por este caminho",
    seRedefinir.status === 400, String(seRedefinir.status));

  const outro = await prisma.usuario.findUnique({ where: { email: MARCA + "operador@exemplo.com" } });
  const promover = await sessaoChefe.chamar(`/api/usuarios/${outro!.id}`, {
    method: "PATCH", body: JSON.stringify({ papel: "ADMIN" }),
  });
  checar("7d. Mas altera o perfil de outra pessoa", promover.status === 200, String(promover.status));

  await prisma.categoria.deleteMany({ where: { nome: { startsWith: MARCA } } });

  await limpar();
  console.log("");
  console.log("-".repeat(72));
  console.log(`TOTAL: ${ok + falhas} verificacoes | ${ok} passaram | ${falhas} falharam`);
  console.log("-".repeat(72));
}

principal()
  .catch(async (erro) => { console.error(erro); await limpar().catch(() => {}); falhas += 1; })
  .finally(async () => { await prisma.$disconnect(); process.exit(falhas ? 1 : 0); });
