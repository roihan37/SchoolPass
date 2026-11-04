import { randomBytes, randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/infrastructure/database/prisma.service.js';
import { testDatabaseUrl } from '../src/infrastructure/database/database-env.js';
import { hashPassword } from '../src/common/security/password.js';
import { MinioStorageService } from '../src/infrastructure/storage/minio-storage.service.js';
import { RedisCacheService } from '../src/infrastructure/cache/redis-cache.service.js';

describe('leave workflow (real PostgreSQL + HTTP)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const ids = {
    parent: randomUUID(),
    other: randomUUID(),
    empty: randomUUID(),
    teacher: randomUUID(),
    otherTeacher: randomUUID(),
    classA: randomUUID(),
    classB: randomUUID(),
    student: randomUUID(),
    otherStudent: randomUUID(),
    secondStudent: randomUUID(),
  };
  const students = [ids.student, ids.otherStudent, ids.secondStudent];
  const users = [
    ids.parent,
    ids.other,
    ids.empty,
    ids.teacher,
    ids.otherTeacher,
  ];
  const tokens: Record<string, string> = {};
  const storage = {
    put: vi.fn(async () => `attachments/${randomUUID()}`),
    remove: vi.fn(async () => undefined),
    signDownload: vi.fn(async () => 'http://127.0.0.1:9000/signed-private-url'),
  };
  const base = '/api/v1/leave-requests';
  const notificationsBase = '/api/v1/notifications';
  const dashboardBase = '/api/v1/dashboard/summary';
  const valid = {
    studentId: ids.student,
    absenceDate: '2026-11-04',
    type: 'SICK',
    reason: 'Demam fiktif',
  };

  beforeAll(async () => {
    vi.stubEnv('DATABASE_URL', testDatabaseUrl());
    vi.stubEnv('JWT_SECRET', randomBytes(32).toString('hex'));
    const module = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MinioStorageService)
      .useValue(storage)
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    prisma = app.get(PrismaService);
    const passwordHash = await hashPassword(randomBytes(24).toString('hex'));
    await prisma.$transaction(async (tx) => {
      for (const id of users) {
        await tx.user.create({
          data: {
            id,
            name: 'Akun Uji Fiktif',
            email: `${id}@example.test`,
            passwordHash,
            role: [ids.teacher, ids.otherTeacher].includes(id)
              ? 'TEACHER'
              : 'PARENT',
          },
        });
      }
      for (const [id, teacherId] of [
        [ids.classA, ids.teacher],
        [ids.classB, ids.otherTeacher],
      ]) {
        await tx.schoolClass.create({
          data: { id, teacherId, name: `Kelas Uji ${id}` },
        });
      }
      for (const [id, parentId, classId] of [
        [ids.student, ids.parent, ids.classA],
        [ids.otherStudent, ids.other, ids.classA],
        [ids.secondStudent, ids.parent, ids.classB],
      ]) {
        await tx.student.create({
          data: { id, parentId, classId, name: 'Siswa Uji Fiktif' },
        });
      }
    });
    for (const id of users)
      tokens[id] = await app.get(JwtService).signAsync({ sub: id });
  });

  const create = (body: object = valid, actor = ids.parent) =>
    request(app.getHttpServer())
      .post(base)
      .auth(tokens[actor], { type: 'bearer' })
      .send(body);
  const get = (suffix = '', actor = ids.parent) =>
    request(app.getHttpServer())
      .get(`${base}${suffix}`)
      .auth(tokens[actor], { type: 'bearer' });
  const decide = (
    id: string,
    body: object = { status: 'APPROVED' },
    actor = ids.teacher,
  ) =>
    request(app.getHttpServer())
      .patch(`${base}/${id}/decision`)
      .auth(tokens[actor], { type: 'bearer' })
      .send(body);
  const pending = async () => (await create().expect(201)).body.id as string;
  const upload = (
    id: string,
    actor = ids.parent,
    bytes = Buffer.from('%PDF-1.7\n'),
  ) =>
    request(app.getHttpServer())
      .post(`${base}/${id}/attachment`)
      .auth(tokens[actor], { type: 'bearer' })
      .attach('file', bytes, {
        filename: 'bukti-fiktif.pdf',
        contentType: 'application/pdf',
      });

  beforeEach(async () => {
    storage.put.mockClear();
    storage.remove.mockClear();
    storage.signDownload.mockClear();
    await prisma.notification.deleteMany({
      where: { leaveRequest: { studentId: { in: students } } },
    });
    await prisma.attachment.deleteMany({
      where: { leaveRequest: { studentId: { in: students } } },
    });
    await prisma.leaveRequest.deleteMany({
      where: { studentId: { in: students } },
    });
  });

  afterAll(async () => {
    try {
      if (prisma)
        await prisma.$transaction(async (tx) => {
          await tx.notification.deleteMany({
            where: { leaveRequest: { studentId: { in: students } } },
          });
          await tx.attachment.deleteMany({
            where: { leaveRequest: { studentId: { in: students } } },
          });
          await tx.leaveRequest.deleteMany({
            where: { studentId: { in: students } },
          });
          await tx.student.deleteMany({ where: { id: { in: students } } });
          await tx.schoolClass.deleteMany({
            where: { id: { in: [ids.classA, ids.classB] } },
          });
          await tx.user.deleteMany({ where: { id: { in: users } } });
        });
    } finally {
      await app?.close();
      vi.unstubAllEnvs();
    }
  });

  it.each(['SICK', 'PERMISSION'])(
    'creates a one-day %s request with trusted ownership and initial status',
    async (type) => {
      const result = await create({
        ...valid,
        type,
        reason: '  Alasan fiktif  ',
      }).expect(201);
      expect(result.body).toMatchObject({
        studentId: ids.student,
        submittedById: ids.parent,
        absenceDate: valid.absenceDate,
        type,
        reason: 'Alasan fiktif',
        status: 'PENDING',
        reviewedById: null,
        reviewedAt: null,
        decisionReason: null,
      });
      const stored = await prisma.leaveRequest.findUniqueOrThrow({
        where: { id: result.body.id as string },
      });
      expect(stored.absenceDate.toISOString()).toBe('2026-11-04T00:00:00.000Z');
    },
  );

  it.each([
    { studentId: 'bad' },
    { studentId: null },
    { type: 'OTHER' },
    { type: null },
    { absenceDate: '2026-02-29' },
    { absenceDate: '2026-11-31' },
    { absenceDate: '2026-11-04T00:00:00Z' },
    { absenceDate: '2026-1-1' },
    { absenceDate: null },
    { absenceDate: '0000-01-01' },
    { reason: '' },
    { reason: ' \n\t ' },
    { reason: 123 },
    { reason: null },
    { reason: 'x'.repeat(2001) },
    { status: 'APPROVED' },
    { submittedById: ids.other },
    { parentId: ids.other },
    { reviewedById: ids.teacher },
  ])('rejects invalid or forged creation fields: %j', async (patch) => {
    await create({ ...valid, ...patch }).expect(400);
    expect(
      await prisma.leaveRequest.count({
        where: { studentId: { in: students } },
      }),
    ).toBe(0);
  });

  it('accepts a real leap day without date shifting', async () => {
    const result = await create({ ...valid, absenceDate: '2028-02-29' }).expect(
      201,
    );
    expect(result.body.absenceDate).toBe('2028-02-29');
  });

  it('requires JWT on every leave route', async () => {
    await request(app.getHttpServer()).post(base).send(valid).expect(401);
    await request(app.getHttpServer()).get(base).expect(401);
    await request(app.getHttpServer())
      .get(`${base}/${randomUUID()}`)
      .expect(401);
    await request(app.getHttpServer())
      .patch(`${base}/${randomUUID()}/decision`)
      .send({ status: 'APPROVED' })
      .expect(401);
  });

  it('uses 404 for unrelated or absent students, and 403 for a wrong role', async () => {
    await create({ ...valid, studentId: ids.otherStudent }).expect(404);
    await create({ ...valid, studentId: randomUUID() }).expect(404);
    await create(valid, ids.teacher).expect(403);
    await decide(await pending(), { status: 'APPROVED' }, ids.parent).expect(
      403,
    );
  });

  it('returns 409 for duplicates regardless of type or final status, but allows another day', async () => {
    const id = await pending();
    await create({ ...valid, type: 'PERMISSION' }).expect(409);
    await decide(id).expect(200);
    await create().expect(409);
    await create({ ...valid, absenceDate: '2026-11-05' }).expect(201);
  });

  it('allows only one simultaneous create per student/date', async () => {
    const results = await Promise.all([create(), create()]);
    expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([
      201, 409,
    ]);
    expect(
      await prisma.leaveRequest.count({ where: { studentId: ids.student } }),
    ).toBe(1);
  });

  it('stores a private attachment and signs only for the owner or assigned teacher', async () => {
    const id = await pending();
    const uploaded = await upload(id).expect(201);
    expect(uploaded.body).toMatchObject({
      leaveRequestId: id,
      fileName: 'bukti-fiktif.pdf',
      mimeType: 'application/pdf',
    });
    expect(uploaded.body.objectKey).toBeUndefined();
    expect(
      await prisma.attachment.count({ where: { leaveRequestId: id } }),
    ).toBe(1);

    await get(`/${id}/attachment-url`, ids.parent)
      .expect(200)
      .expect(({ body }) => {
        expect(body.url).toBe('http://127.0.0.1:9000/signed-private-url');
        expect(body.expiresIn).toBe(300);
      });
    await get(`/${id}/attachment-url`, ids.teacher).expect(200);
    await get(`/${id}/attachment-url`, ids.other).expect(404);
    await get(`/${id}/attachment-url`, ids.otherTeacher).expect(404);
    expect(storage.signDownload).toHaveBeenCalledTimes(2);
    await upload(id).expect(409);
  });

  it('rejects mismatched signatures and uploads only for a pending owned request', async () => {
    const id = await pending();
    await upload(id, ids.parent, Buffer.from('not a PDF')).expect(400);
    expect(storage.put).not.toHaveBeenCalled();
    await upload(id, ids.other).expect(404);
    await upload(id, ids.teacher).expect(403);
    await decide(id).expect(200);
    await upload(id).expect(409);
  });

  it('rejects an attachment larger than five megabytes', async () => {
    const id = await pending();
    const tooLarge = Buffer.alloc(5 * 1024 * 1024 + 1, 0x41);
    await upload(id, ids.parent, tooLarge).expect(413);
    expect(storage.put).not.toHaveBeenCalled();
  });

  it('filters lists and details by parent and assigned class, ignoring forged query filters', async () => {
    const own = await pending();
    const other = (
      await create({ ...valid, studentId: ids.otherStudent }, ids.other).expect(
        201,
      )
    ).body.id as string;
    const second = (
      await create({ ...valid, studentId: ids.secondStudent }).expect(201)
    ).body.id as string;
    for (const [actor, expected] of [
      [ids.parent, [own, second]],
      [ids.other, [other]],
      [ids.teacher, [own, other]],
      [ids.otherTeacher, [second]],
      [ids.empty, []],
    ] as const) {
      const result = await get(
        `?parentId=${ids.other}&teacherId=${ids.otherTeacher}`,
        actor,
      ).expect(200);
      expect(result.body.map((row: { id: string }) => row.id).sort()).toEqual(
        [...expected].sort(),
      );
      expect(JSON.stringify(result.body)).not.toMatch(
        /passwordHash|accessToken|@example\.test/,
      );
      for (const id of expected) await get(`/${id}`, actor).expect(200);
    }
    for (const actor of [ids.other, ids.otherTeacher, ids.empty])
      await get(`/${own}`, actor).expect(404);
    await get(`/${randomUUID()}`).expect(404);
    await get('/invalid-id').expect(400);
  });

  it('does not let another class teacher decide or reveal a final request', async () => {
    const id = await pending();
    await decide(id, { status: 'APPROVED' }, ids.otherTeacher).expect(404);
    expect((await get(`/${id}`).expect(200)).body.status).toBe('PENDING');
    await decide(id).expect(200);
    await decide(id, { status: 'APPROVED' }, ids.otherTeacher).expect(404);
    await decide(randomUUID()).expect(404);
    await decide('invalid-id').expect(400);
  });

  it('completes the Parent → Teacher → Parent demo flow with ownership checks', async () => {
    const created = await create().expect(201);
    const id = created.body.id as string;

    await get(`/${id}`, ids.parent).expect(200).expect(({ body }) => {
      expect(body.status).toBe('PENDING');
    });
    await get(`/${id}`, ids.teacher).expect(200);
    await get(`/${id}`, ids.other).expect(404);

    await decide(id, { status: 'APPROVED' }, ids.teacher).expect(200);
    await get(`/${id}`, ids.parent).expect(200).expect(({ body }) => {
      expect(body).toMatchObject({
        id,
        status: 'APPROVED',
        submittedById: ids.parent,
        reviewedById: ids.teacher,
      });
    });
  });

  it.each([
    {},
    { status: 'PENDING' },
    { status: 'INVALID' },
    { status: null },
    { status: 'REJECTED' },
    { status: 'REJECTED', decisionReason: '' },
    { status: 'REJECTED', decisionReason: ' \n ' },
    { status: 'REJECTED', decisionReason: null },
    { status: 'APPROVED', decisionReason: 123 },
    { status: 'APPROVED', decisionReason: null },
    { status: 'APPROVED', decisionReason: 'x'.repeat(2001) },
    { status: 'APPROVED', reviewedById: ids.otherTeacher },
  ])(
    'rejects malformed decisions without modifying the request: %j',
    async (body) => {
      const id = await pending();
      await decide(id, body).expect(400);
      expect((await get(`/${id}`).expect(200)).body).toMatchObject({
        status: 'PENDING',
        reviewedById: null,
        reviewedAt: null,
      });
    },
  );

  it.each([
    { status: 'APPROVED' },
    { status: 'APPROVED', decisionReason: '  Disetujui fiktif  ' },
    { status: 'REJECTED', decisionReason: '  Alasan penolakan fiktif  ' },
  ])(
    'persists a final decision visible to the parent, and rejects retries: %j',
    async (body) => {
      const id = await pending();
      const decided = await decide(id, body).expect(200);
      expect(decided.body).toMatchObject({
        id,
        status: body.status,
        reviewedById: ids.teacher,
        decisionReason: body.decisionReason?.trim() ?? null,
      });
      expect(
        Number.isFinite(Date.parse(decided.body.reviewedAt as string)),
      ).toBe(true);
      expect((await get(`/${id}`).expect(200)).body).toEqual(decided.body);
      await decide(id, {
        status: 'REJECTED',
        decisionReason: 'Percobaan ulang',
      }).expect(409);
      expect((await get(`/${id}`).expect(200)).body).toEqual(decided.body);
    },
  );

  it('allows exactly one concurrent decision and preserves its complete audit fields', async () => {
    const id = await pending();
    const results = await Promise.all([
      decide(id, { status: 'APPROVED', decisionReason: 'Disetujui fiktif' }),
      decide(id, { status: 'REJECTED', decisionReason: 'Ditolak fiktif' }),
    ]);
    expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([
      200, 409,
    ]);
    const winner = results.find((r) => r.status === 200)!;
    expect((await get(`/${id}`).expect(200)).body).toEqual(winner.body);
    expect(winner.body).toMatchObject({ reviewedById: ids.teacher });
    expect(winner.body.decisionReason).toBe(
      winner.body.status === 'APPROVED' ? 'Disetujui fiktif' : 'Ditolak fiktif',
    );
  });

  it('lists notifications only for the authenticated user and is idempotent under replay', async () => {
    const ownRequest = await pending();
    const otherRequest = (
      await create({ ...valid, studentId: ids.otherStudent }, ids.other).expect(
        201,
      )
    ).body.id as string;
    const { NotificationProcessor } = await import(
      '../src/modules/notifications/notification.processor.js'
    );
    const processor = new NotificationProcessor(prisma);
    const ownJob = {
      userId: ids.parent,
      leaveRequestId: ownRequest,
      status: 'APPROVED' as const,
    };
    await processor.process(ownJob);
    await processor.process(ownJob);
    await processor.process({
      userId: ids.other,
      leaveRequestId: otherRequest,
      status: 'REJECTED',
    });

    const own = await request(app.getHttpServer())
      .get(notificationsBase)
      .auth(tokens[ids.parent], { type: 'bearer' })
      .expect(200);
    expect(own.body).toHaveLength(1);
    expect(own.body[0]).toMatchObject({
      leaveRequestId: ownRequest,
      type: 'LEAVE_DECIDED',
      message: 'Permintaan izin Anda disetujui.',
    });
    expect(own.body[0]).not.toHaveProperty('userId');
    await request(app.getHttpServer())
      .get(notificationsBase)
      .auth(tokens[ids.other], { type: 'bearer' })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toHaveLength(1);
        expect(body[0].leaveRequestId).toBe(otherRequest);
      });
    await request(app.getHttpServer()).get(notificationsBase).expect(401);
  });

  it('caches only assigned-class counts and invalidates them after a decision', async () => {
    const cache = app.get(RedisCacheService);
    await cache.delete(`dashboard:summary:${ids.teacher}`);
    await cache.delete(`dashboard:summary:${ids.otherTeacher}`);
    const id = await pending();
    const getSummary = (actor: string) =>
      request(app.getHttpServer())
        .get(dashboardBase)
        .auth(tokens[actor], { type: 'bearer' });

    const first = await getSummary(ids.teacher).expect(200);
    expect(first.body).toMatchObject({
      totals: { total: 1, pending: 1, approved: 0, rejected: 0 },
    });
    expect(
      first.body.classes.map((item: { classId: string }) => item.classId),
    ).toEqual([ids.classA]);
    const otherTeacher = await getSummary(ids.otherTeacher).expect(200);
    expect(otherTeacher.body).toMatchObject({
      totals: { total: 0, pending: 0, approved: 0, rejected: 0 },
      classes: [{ classId: ids.classB }],
    });
    await getSummary(ids.parent).expect(403);
    await request(app.getHttpServer()).get(dashboardBase).expect(401);

    await decide(id).expect(200);
    const refreshed = await getSummary(ids.teacher).expect(200);
    expect(refreshed.body.totals).toEqual({
      total: 1,
      pending: 0,
      approved: 1,
      rejected: 0,
    });
  });
});
