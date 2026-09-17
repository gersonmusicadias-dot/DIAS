/**
 * Cria o PRIMEIRO administrador — o único que não pode ser convidado por
 * ninguém, porque ainda não existe quem convide.
 *
 *   npm run criar-admin -- "Seu Nome" seu@email.com
 *
 * A senha provisória é gerada aqui e mostrada UMA vez no terminal. Nada de
 * senha padrão no código: senha padrão em sistema publicado é porta aberta.
 */
import { PrismaClient } from "@prisma/client";
import { gerarHash, gerarSenhaProvisoria } from "../src/lib/auth/senha";

const prisma = new PrismaClient();

async function principal() {
  const [nome, email] = process.argv.slice(2);

  if (!nome || !email) {
    console.error('Uso: npm run criar-admin -- "Seu Nome" seu@email.com');
    process.exit(1);
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error("E-mail inválido: " + email);
    process.exit(1);
  }

  const alvo = email.toLowerCase().trim();
  if (await prisma.usuario.findUnique({ where: { email: alvo } })) {
    console.error("Já existe um usuário com este e-mail: " + alvo);
    process.exit(1);
  }

  const senha = gerarSenhaProvisoria();
  await prisma.usuario.create({
    data: {
      nome: nome.trim(),
      email: alvo,
      senhaHash: await gerarHash(senha),
      papel: "ADMIN",
      trocarSenha: true,
    },
  });

  console.log("");
  console.log("  Administrador criado.");
  console.log("  ------------------------------------------");
  console.log("  E-mail:           " + alvo);
  console.log("  Senha provisória: " + senha);
  console.log("  ------------------------------------------");
  console.log("  Anote agora: esta senha não é mostrada de novo.");
  console.log("  No primeiro acesso o sistema vai exigir a troca.");
  console.log("");
}

principal()
  .catch((erro) => {
    console.error(erro);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
