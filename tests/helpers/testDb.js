import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

export function createTestPrisma() {
  process.env.AUTH_ENABLED = 'false';
  const url = process.env.DATABASE_URL_TEST || "file:./test.db";
  const adapter = new PrismaBetterSqlite3({ url });
  return new PrismaClient({ adapter });
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
