import { randomBytes, randomUUID } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaModule } from '../src/infrastructure/database/prisma.module.js';
import { PrismaService } from '../src/infrastructure/database/prisma.service.js';
import { testDatabaseUrl } from '../src/infrastructure/database/database-env.js';
import { seedDatabase, seedIds } from '../prisma/seed-data.js';
import { verifyPassword } from '../src/common/security/password.js';

describe('PostgreSQL foundation (real database)', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let originalUrl: string | undefined;

  beforeAll(async () => {
    const url = testDatabaseUrl();
    originalUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = url;
    module = await Test.createTestingModule({
      imports: [PrismaModule],
    }).compile();
    await module.init();
    prisma = module.get(PrismaService);
    const password = randomBytes(24).toString('hex');
    await seedDatabase(prisma, password);
    await seedDatabase(prisma, password);
  });

  afterAll(async () => {
    await module?.close();
    if (originalUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalUrl;
  });

  it('seeds the exact fictional graph twice without duplicates or plaintext passwords', async () => {
    expect(await prisma.user.count()).toBe(3);
    expect(await prisma.schoolClass.count()).toBe(2);
    expect(await prisma.student.count()).toBe(3);
    expect(await prisma.leaveRequest.count()).toBe(0);
    const users = await prisma.user.findMany();
    expect(users.filter((u) => u.role === 'TEACHER')).toHaveLength(1);
    expect(users.filter((u) => u.role === 'PARENT')).toHaveLength(2);
    expect(
      users.every((u) =>
        /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(u.passwordHash),
      ),
    ).toBe(true);
    expect(
      await prisma.schoolClass.count({ where: { teacherId: seedIds.teacher } }),
    ).toBe(2);
  });

  it('queries one parent with Prisma and obtains the equivalent parameterized SQL JOIN', async () => {
    const students = await prisma.student.findMany({
      where: { parentId: seedIds.parentA },
      select: {
        id: true,
        name: true,
        schoolClass: {
          select: { name: true, teacher: { select: { name: true } } },
        },
      },
      orderBy: { id: 'asc' },
    });
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        className: string;
        teacherName: string;
      }>
    >`
      SELECT s.id, s.name, c.name AS "className", t.name AS "teacherName"
      FROM "Student" s
      JOIN "SchoolClass" c ON c.id = s."classId"
      JOIN "User" t ON t.id = c."teacherId"
      WHERE s."parentId" = ${seedIds.parentA}::uuid
      ORDER BY s.id
    `;
    expect(
      students.map((s) => ({
        id: s.id,
        name: s.name,
        className: s.schoolClass.name,
        teacherName: s.schoolClass.teacher.name,
      })),
    ).toEqual(rows);
    expect(students.map((s) => s.id)).toEqual([seedIds.studentA]);
    const otherParent = await prisma.student.findMany({
      where: { parentId: seedIds.parentB },
      select: { id: true },
    });
    expect(otherParent.map((student) => student.id)).toEqual([
      seedIds.studentB,
      seedIds.studentC,
    ]);
    expect(
      await prisma.student.count({ where: { parentId: randomUUID() } }),
    ).toBe(0);
  });

  it('rejects duplicate user email', async () => {
    await expect(
      prisma.user.create({
        data: {
          name: 'Duplikat Fiktif',
          email: 'teacher@example.test',
          passwordHash: 'unusable-test-hash',
          role: 'TEACHER',
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('rejects duplicate class name', async () => {
    await expect(
      prisma.schoolClass.create({
        data: { name: 'Kelas Fiktif A', teacherId: seedIds.teacher },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it.each(['parentId', 'classId'] as const)(
    'rejects a missing Student.%s reference',
    async (field) => {
      await expect(
        prisma.student.create({
          data: {
            name: 'Siswa Uji Fiktif',
            parentId: seedIds.parentA,
            classId: seedIds.classA,
            [field]: randomUUID(),
          },
        }),
      ).rejects.toMatchObject({ code: 'P2003' });
    },
  );

  it('rejects a missing class teacher', async () => {
    await expect(
      prisma.schoolClass.create({
        data: { name: 'Kelas Uji Fiktif', teacherId: randomUUID() },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  const leaveData = () => ({
    studentId: seedIds.studentA,
    submittedById: seedIds.parentA,
    absenceDate: new Date('2099-01-02T00:00:00Z'),
    type: 'SICK' as const,
    reason: 'Alasan fiktif untuk pengujian',
  });

  it.each(['studentId', 'submittedById', 'reviewedById'] as const)(
    'rejects a missing LeaveRequest.%s reference',
    async (field) => {
      await expect(
        prisma.leaveRequest.create({
          data: { ...leaveData(), [field]: randomUUID() },
        }),
      ).rejects.toMatchObject({ code: 'P2003' });
    },
  );

  it('enforces student/date uniqueness in PostgreSQL and rolls back the attempted transaction', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.leaveRequest.create({ data: leaveData() });
        await tx.leaveRequest.create({ data: leaveData() });
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
    expect(await prisma.leaveRequest.count()).toBe(0);
  });

  it('persists DATE, PENDING defaults and nullable review fields; other students/dates remain valid', async () => {
    const rollback = new Error('Rollback successful verification fixtures');
    await expect(
      prisma.$transaction(async (tx) => {
        const leave = await tx.leaveRequest.create({ data: leaveData() });
        expect(leave.absenceDate.toISOString()).toBe(
          '2099-01-02T00:00:00.000Z',
        );
        expect(leave.status).toBe('PENDING');
        expect(leave.reviewedById).toBeNull();
        expect(leave.reviewedAt).toBeNull();
        expect(leave.decisionReason).toBeNull();
        await tx.leaveRequest.create({
          data: { ...leaveData(), studentId: seedIds.studentB },
        });
        await tx.leaveRequest.create({
          data: {
            ...leaveData(),
            absenceDate: new Date('2099-01-03T00:00:00Z'),
            reviewedById: seedIds.teacher,
          },
        });
        expect(await tx.leaveRequest.count()).toBe(3);
        throw rollback;
      }),
    ).rejects.toBe(rollback);
    const columns = await prisma.$queryRaw<Array<{ data_type: string }>>`
      SELECT data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'LeaveRequest' AND column_name = 'absenceDate'
    `;
    expect(columns).toEqual([{ data_type: 'date' }]);
    expect(await prisma.leaveRequest.count()).toBe(0);
  });

  it('restricts deletion of referenced users/classes/students, preserving history', async () => {
    await expect(
      prisma.user.delete({ where: { id: seedIds.teacher } }),
    ).rejects.toMatchObject({ code: 'P2003' });
    await expect(
      prisma.schoolClass.delete({ where: { id: seedIds.classA } }),
    ).rejects.toMatchObject({ code: 'P2003' });
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.leaveRequest.create({ data: leaveData() });
        await tx.student.delete({ where: { id: seedIds.studentA } });
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  it('requires at least eight seed password characters before changing records', async () => {
    await expect(seedDatabase(prisma, '1234567')).rejects.toThrow(
      'SEED_PASSWORD must contain at least 8 characters.',
    );
    expect(await prisma.user.count()).toBe(3);
  });

  it('accepts an eight-character seed password and applies it when reseeding', async () => {
    const password = 'demo1234';
    await seedDatabase(prisma, password);
    const teacher = await prisma.user.findUniqueOrThrow({
      where: { id: seedIds.teacher },
      select: { passwordHash: true },
    });
    expect(await verifyPassword(password, teacher.passwordHash)).toBe(true);
  });
});
