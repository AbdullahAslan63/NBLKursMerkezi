import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaNeon } from '@prisma/adapter-neon';
import { neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

let client = null;
let neonWsConfigured = false;

/**
 * Neon host'u veya PRISMA_ADAPTER=neon ile Neon serverless adapter seçilir;
 * aksi halde standart pg adapter kullanılır.
 */
export function isNeonConnection(url) {
  const override = (process.env.PRISMA_ADAPTER || '').toLowerCase();
  if (override === 'neon') return true;
  if (override === 'pg') return false;

  try {
    const { hostname } = new URL(url);
    return hostname.endsWith('.neon.tech');
  } catch {
    return /neon\.tech/i.test(url);
  }
}

/** DATABASE_URL'e göre Neon veya pg adapter üretir */
export function createAdapter(connectionString) {
  if (!connectionString) {
    throw new Error('DATABASE_URL tanımlı değil');
  }

  if (isNeonConnection(connectionString)) {
    if (!neonWsConfigured) {
      neonConfig.webSocketConstructor = ws;
      neonWsConfigured = true;
    }
    return new PrismaNeon({ connectionString });
  }

  return new PrismaPg({ connectionString });
}

/** PrismaClient — ilk çağrıda oluşturulur */
export function getPrisma() {
  if (!client) {
    if (globalThis.prisma) {
      client = globalThis.prisma;
    } else {
      const connectionString = process.env.DATABASE_URL;
      client = new PrismaClient({
        adapter: createAdapter(connectionString),
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
