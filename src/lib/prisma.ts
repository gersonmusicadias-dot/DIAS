import { PrismaClient } from "@prisma/client";

// Em desenvolvimento o Next recarrega o módulo a cada alteração. Sem este
// cache, cada recarga abriria uma conexão nova até esgotar o banco.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
