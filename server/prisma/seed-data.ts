import { hashPassword } from '../src/common/security/password.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';

export const seedIds = {
  teacher: '10000000-0000-4000-8000-000000000001',
  parentA: '10000000-0000-4000-8000-000000000002',
  parentB: '10000000-0000-4000-8000-000000000003',
  classA: '20000000-0000-4000-8000-000000000001',
  classB: '20000000-0000-4000-8000-000000000002',
  studentA: '30000000-0000-4000-8000-000000000001',
  studentB: '30000000-0000-4000-8000-000000000002',
  studentC: '30000000-0000-4000-8000-000000000003',
} as const;

export async function seedDatabase(prisma: PrismaClient, password: string) {
  if (password.length < 8)
    throw new Error('SEED_PASSWORD must contain at least 8 characters.');
  await prisma.$transaction(async (tx) => {
    const users = [
      {
        id: seedIds.teacher,
        name: 'Guru Fiktif',
        email: 'teacher@example.test',
        role: 'TEACHER' as const,
      },
      {
        id: seedIds.parentA,
        name: 'Orang Tua Fiktif A',
        email: 'parent.a@example.test',
        role: 'PARENT' as const,
      },
      {
        id: seedIds.parentB,
        name: 'Orang Tua Fiktif B',
        email: 'parent.b@example.test',
        role: 'PARENT' as const,
      },
    ];
    for (const user of users) {
      const passwordHash = await hashPassword(password);
      await tx.user.upsert({
        where: { id: user.id },
        create: { ...user, passwordHash },
        update: { ...user, passwordHash },
      });
    }
    for (const schoolClass of [
      {
        id: seedIds.classA,
        name: 'Kelas Fiktif A',
        teacherId: seedIds.teacher,
      },
      {
        id: seedIds.classB,
        name: 'Kelas Fiktif B',
        teacherId: seedIds.teacher,
      },
    ]) {
      await tx.schoolClass.upsert({
        where: { id: schoolClass.id },
        create: schoolClass,
        update: schoolClass,
      });
    }
    for (const student of [
      {
        id: seedIds.studentA,
        name: 'Siswa Fiktif A',
        parentId: seedIds.parentA,
        classId: seedIds.classA,
      },
      {
        id: seedIds.studentB,
        name: 'Siswa Fiktif B',
        parentId: seedIds.parentB,
        classId: seedIds.classB,
      },
      {
        id: seedIds.studentC,
        name: 'Siswa Fiktif C',
        parentId: seedIds.parentB,
        classId: seedIds.classB,
      },
    ]) {
      await tx.student.upsert({
        where: { id: student.id },
        create: student,
        update: student,
      });
    }
  });
}
