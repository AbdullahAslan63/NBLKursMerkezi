import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

export function createTestPrisma() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
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
  } catch {
    return false;
  }
}
