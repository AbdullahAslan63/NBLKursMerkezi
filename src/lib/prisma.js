import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

let client = null;

/** PrismaClient — ilk çağrıda oluşturulur */
export function getPrisma() {
  if (!client) {
    if (globalThis.prisma) {
      client = globalThis.prisma;
    } else {
      const url = process.env.DATABASE_URL || 'file:./dev.db';
      const adapter = new PrismaBetterSqlite3({ url });
      client = new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
      });
    }

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
