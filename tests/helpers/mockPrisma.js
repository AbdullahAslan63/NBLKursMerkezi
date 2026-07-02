/** Testler için in-memory Prisma mock (smoke testler) */
export function createMockPrisma() {
  return {
    studySession: {
      count: async () => 0,
      findMany: async () => [],
    },
    teacher: {
      count: async () => 0,
      findMany: async () => [],
    },
    student: {
      count: async () => 0,
      findMany: async () => [],
    },
    schoolClass: {
      findMany: async () => [],
    },
  };
}
