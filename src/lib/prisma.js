import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

let client = null;

/** PrismaClient — ilk çağrıda oluşturulur */
export function getPrisma() {
  if (!client) {
    if (globalThis.prisma) {
      client = globalThis.prisma;
    } else {
      const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
      const adapter = new PrismaPg(pool);
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
