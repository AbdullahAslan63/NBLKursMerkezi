import { normalizeClassName, isValidClassName } from '../lib/className.js';

/** İçe aktarma için hedef sınıfı çöz */
export async function resolveTargetClass(prisma, { classId, className }) {
  if (classId) {
    const id = Number(classId);
    if (!Number.isInteger(id) || id < 1) return null;
    return prisma.schoolClass.findUnique({ where: { id } });
  }

  const name = normalizeClassName(className);
  if (!isValidClassName(name)) return null;

  return prisma.schoolClass.upsert({
    where: { name },
    create: { name },
    update: {},
  });
}
