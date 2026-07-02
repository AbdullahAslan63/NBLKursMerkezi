import { PrismaClient } from '@prisma/client';

let client = null;

/** PrismaClient — ilk çağrıda oluşturulur */
export function getPrisma() {
  if (!client) {
    client =
      globalThis.prisma ??
      new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
      });

    if (process.env.NODE_ENV !== 'production') {
      globalThis.prisma = client;
    }
  }
  return client;
}

/** Testlerde mock enjekte et */
export function setPrisma(mock) {
  client = mock;
}

/** Test sonrası sıfırla */
export function resetPrisma() {
  client = null;
}
