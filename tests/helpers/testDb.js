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
  await prisma.studySessionStudent.deleteMany();
  await prisma.studySession.deleteMany();
  await prisma.student.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.schoolClass.deleteMany();
}

export async function isDatabaseAvailable(prisma) {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
