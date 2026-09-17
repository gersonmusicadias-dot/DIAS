import bcrypt from "bcryptjs";
import { randomInt } from "crypto";

// 12 rodadas: custo alto o bastante para tornar força bruta cara, baixo o
// bastante para o login continuar instantâneo.
const RODADAS = 12;

export async function gerarHash(senha: string): Promise<string> {
  return bcrypt.hash(senha, RODADAS);
}

export async function conferirSenha(senha: string, hash: string): Promise<boolean> {
  return bcrypt.compare(senha, hash);
}

/**
 * Política mínima. Vale tanto para a senha provisória gerada pelo sistema
 * quanto para a que o usuário escolhe.
 */
export function validarForcaDaSenha(senha: string): string | null {
  if (senha.length < 8) return "A senha precisa de pelo menos 8 caracteres.";
  if (!/[a-z]/.test(senha)) return "A senha precisa de pelo menos uma letra minúscula.";
  if (!/[A-Z]/.test(senha)) return "A senha precisa de pelo menos uma letra maiúscula.";
  if (!/[0-9]/.test(senha)) return "A senha precisa de pelo menos um número.";
  return null;
}

// Sem caracteres ambíguos (0/O, 1/l/I): a senha provisória vai ser lida de
// um e-mail e digitada à mão.
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

/**
 * Senha provisória. Usa randomInt do módulo crypto — Math.random não serve
 * para nada que proteja acesso.
 */
export function gerarSenhaProvisoria(tamanho = 12): string {
  let senha = "";
  // Garante um de cada classe exigida pela política.
  senha += "ABCDEFGHJKLMNPQRSTUVWXYZ"[randomInt(24)];
  senha += "abcdefghijkmnpqrstuvwxyz"[randomInt(24)];
  senha += "23456789"[randomInt(8)];
  while (senha.length < tamanho) senha += ALFABETO[randomInt(ALFABETO.length)];

  // Embaralha para as classes não ficarem sempre nas mesmas posições.
  const letras = senha.split("");
  for (let i = letras.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [letras[i], letras[j]] = [letras[j], letras[i]];
  }
  return letras.join("");
}
