import { PrismaClient } from '@prisma/client';
import { createAdapter } from '../../src/lib/prisma.js';

export function createTestPrisma() {
  process.env.AUTH_ENABLED = 'false';
  const url = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL_TEST veya DATABASE_URL tanımlı değil');
  }
  return new PrismaClient({ adapter: createAdapter(url) });
}

/** FK sırasına göre tabloları temizle */
export async function resetDatabase(prisma) {
  await prisma.$transaction([
    prisma.studySessionStudent.deleteMany(),
    prisma.studySession.deleteMany(),
    prisma.student.deleteMany(),
    prisma.teacher.deleteMany(),
    prisma.schoolClass.deleteMany(),
  ]);
}

export async function isDatabaseAvailable(prisma) {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (err) {
    console.error('Database connection check failed:', err);
    return false;
  }
}
