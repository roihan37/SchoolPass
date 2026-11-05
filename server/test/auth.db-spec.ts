import { randomBytes, randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/infrastructure/database/prisma.service.js';
import { testDatabaseUrl } from '../src/infrastructure/database/database-env.js';
import { hashPassword } from '../src/common/security/password.js';

describe('authentication and ownership (real PostgreSQL + HTTP)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  const ids = {
    parent: randomUUID(),
    other: randomUUID(),
    teacher: randomUUID(),
    otherTeacher: randomUUID(),
    empty: randomUUID(),
    rateLimited: randomUUID(),
    schoolClass: randomUUID(),
    otherClass: randomUUID(),
    student: randomUUID(),
    otherStudent: randomUUID(),
    unassignedStudent: randomUUID(),
  };
  const password = randomBytes(24).toString('hex');
  const email = (id: string) => `${id}@example.test`;
  let parentToken: string;
  let teacherToken: string;

  beforeAll(async () => {
    vi.stubEnv('DATABASE_URL', testDatabaseUrl());
    vi.stubEnv('JWT_SECRET', randomBytes(32).toString('hex'));
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
    const passwordHash = await hashPassword(password);
    await prisma.$transaction(async (tx) => {
      for (const id of [
        ids.parent,
        ids.other,
        ids.teacher,
        ids.otherTeacher,
        ids.empty,
        ids.rateLimited,
      ]) {
        await tx.user.create({
          data: {
            id,
            name: 'Akun Uji Fiktif',
            email: email(id),
            passwordHash,
            role:
              id === ids.teacher || id === ids.otherTeacher
                ? 'TEACHER'
                : 'PARENT',
          },
        });
      }
      await tx.schoolClass.create({
        data: {
          id: ids.schoolClass,
          name: `Kelas Uji ${ids.schoolClass}`,
          teacherId: ids.teacher,
        },
      });
      await tx.schoolClass.create({
        data: {
          id: ids.otherClass,
          name: `Kelas Lain ${ids.otherClass}`,
          teacherId: ids.otherTeacher,
        },
      });
      for (const [id, parentId] of [
        [ids.student, ids.parent],
        [ids.otherStudent, ids.other],
      ]) {
        await tx.student.create({
          data: {
            id,
            name: 'Siswa Uji Fiktif',
            parentId,
            classId: ids.schoolClass,
          },
        });
      }
      await tx.student.create({
        data: {
          id: ids.unassignedStudent,
          name: 'Siswa Kelas Lain Fiktif',
          parentId: ids.other,
          classId: ids.otherClass,
        },
      });
    });
    parentToken = (await login(ids.parent)).body.accessToken as string;
    teacherToken = (await login(ids.teacher)).body.accessToken as string;
  });

  const login = (id: string) =>
    request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: email(id), password })
      .expect(200);
  const get = (path: string, token: string) =>
    request(app.getHttpServer())
      .get(`/api/v1/${path}`)
      .auth(token, { type: 'bearer' });

  afterAll(async () => {
    try {
      if (prisma)
        await prisma.$transaction(async (tx) => {
          await tx.student.deleteMany({
            where: {
              id: {
                in: [ids.student, ids.otherStudent, ids.unassignedStudent],
              },
            },
          });
          await tx.schoolClass.deleteMany({
            where: { id: { in: [ids.schoolClass, ids.otherClass] } },
          });
          await tx.user.deleteMany({
            where: {
              id: {
                in: [
                  ids.parent,
                  ids.other,
                  ids.teacher,
                  ids.otherTeacher,
                  ids.empty,
                  ids.rateLimited,
                ],
              },
            },
          });
        });
    } finally {
      await app?.close();
      vi.unstubAllEnvs();
    }
  });

  it.each(['parent', 'teacher'] as const)(
    'logs in %s without exposing the password hash',
    async (role) => {
      const response = await login(ids[role]);
      expect(response.body).toMatchObject({
        tokenType: 'Bearer',
        expiresIn: 900,
        user: { id: ids[role], role: role.toUpperCase() },
      });
      expect(response.body.user).not.toHaveProperty('passwordHash');
      const payload = await jwt.verifyAsync(
        response.body.accessToken as string,
      );
      expect(payload.sub).toBe(ids[role]);
      expect(payload.exp - payload.iat).toBe(900);
    },
  );
  it('returns the same 401 for unknown email and wrong password', async () => {
    const wrong = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: email(ids.parent), password: 'incorrect' })
      .expect(401);
    const unknown = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: email(randomUUID()), password })
      .expect(401);
    expect(unknown.body).toEqual(wrong.body);
  });
  it('limits repeated login attempts and returns the cooldown', async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: email(ids.rateLimited), password: 'incorrect' })
        .expect(401);
    }

    const blocked = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: email(ids.rateLimited), password: 'incorrect' })
      .expect(429);

    expect(blocked.body.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.body.retryAfterSeconds).toBeLessThanOrEqual(15 * 60);
  });
  it.each([
    { email: 'invalid', password: '1234567' },
    { email: 'a@example.test', password: '1234567' },
    { email: 'a@example.test' },
    { email: 'a@example.test', password: 123 },
    { email: 'a@example.test', password: '1234567', role: 'TEACHER' },
    { email: 'a@example.test', password: 'x'.repeat(257) },
  ])('rejects malformed credentials', async (body) => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send(body)
      .expect(400);
  });
  it('requires authentication for me and students', async () => {
    for (const path of ['auth/me', 'students/mine'])
      await request(app.getHttpServer()).get(`/api/v1/${path}`).expect(401);
  });
  it('rejects malformed, tampered, expired and invalid-claim tokens', async () => {
    const tokens = [
      'invalid',
      `${parentToken}tampered`,
      await jwt.signAsync({ sub: ids.parent }, { expiresIn: -1 }),
      await jwt.signAsync({ sub: ids.parent }, { issuer: 'other' }),
      await jwt.signAsync({ sub: ids.parent }, { audience: 'other' }),
      await jwt.signAsync({ sub: ids.parent }, { algorithm: 'HS384' }),
      await new JwtService({ secret: process.env.JWT_SECRET }).signAsync({
        sub: ids.parent,
        iss: 'schoolpass',
        aud: 'schoolpass-api',
      }),
      await jwt.signAsync({ sub: 'not-a-uuid' }),
      await jwt.signAsync({ sub: randomUUID() }),
      await jwt.signAsync(
        { sub: ids.parent },
        { secret: randomBytes(32).toString('hex') },
      ),
    ];
    for (const token of tokens) await get('auth/me', token).expect(401);
  });
  it('returns current identity without hashes', async () => {
    const response = await get('auth/me', parentToken).expect(200);
    expect(response.body).toEqual({
      id: ids.parent,
      name: 'Akun Uji Fiktif',
      email: email(ids.parent),
      role: 'PARENT',
    });
  });
  it('ignores forged parentId and returns only the authenticated parent children', async () => {
    const response = await get(
      `students/mine?parentId=${ids.other}`,
      parentToken,
    ).expect(200);
    expect(response.body.map((student: { id: string }) => student.id)).toEqual([
      ids.student,
    ]);
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
    const otherToken = (await login(ids.other)).body.accessToken as string;
    const other = await get('students/mine', otherToken).expect(200);
    expect(
      other.body.map((student: { id: string }) => student.id).sort(),
    ).toEqual([ids.otherStudent, ids.unassignedStudent].sort());
  });
  it('returns an empty list for a parent without children', async () => {
    const token = (await login(ids.empty)).body.accessToken as string;
    await get('students/mine', token).expect(200).expect([]);
  });
  it('forbids teacher access to parent-only children', async () => {
    await get('students/mine', teacherToken).expect(403);
  });
  it('lists only students in classes assigned to the authenticated teacher', async () => {
    const response = await get('students/assigned', teacherToken).expect(200);
    expect(
      response.body.map((student: { id: string }) => student.id).sort(),
    ).toEqual([ids.student, ids.otherStudent].sort());
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: ids.student,
          parent: expect.objectContaining({ email: email(ids.parent) }),
        }),
      ]),
    );
    expect(JSON.stringify(response.body)).not.toContain(email(ids.unassignedStudent));
    await get('students/assigned', parentToken).expect(403);
    await request(app.getHttpServer())
      .get('/api/v1/students/assigned')
      .expect(401);
  });
  it('uses current DB role even with an older token', async () => {
    await prisma.user.update({
      where: { id: ids.empty },
      data: { role: 'TEACHER' },
    });
    const token = await jwt.signAsync({ sub: ids.empty, role: 'PARENT' });
    await get('students/mine', token).expect(403);
  });
  it('keeps liveness public', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect({ status: 'ok' });
  });
  it('registers both roles and supports teacher multi-class / parent multi-class enrollment', async () => {
    const teacher = randomUUID();
    const parent = randomUUID();
    const anotherParent = randomUUID();
    const register = async (id: string, role: 'PARENT' | 'TEACHER') =>
      request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ name: `Akun Uji ${role}`, email: email(id), password, role })
        .expect(201);
    const teacherResult = await register(teacher, 'TEACHER');
    const parentResult = await register(parent, 'PARENT');
    const anotherParentResult = await register(anotherParent, 'PARENT');
    const teacherAuth = teacherResult.body.accessToken as string;
    const parentAuth = parentResult.body.accessToken as string;
    const anotherParentAuth = anotherParentResult.body.accessToken as string;
    const post = (path: string, token: string, body: object) =>
      request(app.getHttpServer())
        .post(`/api/v1/${path}`)
        .auth(token, { type: 'bearer' })
        .send(body);
    const createdClasses: Array<{ id: string; name: string; classCode: string }> = [];
    try {
      expect(teacherResult.body.user.role).toBe('TEACHER');
      expect(parentResult.body.user.role).toBe('PARENT');
      const first = await post('classes', teacherAuth, { name: 'Kelas Satu' }).expect(201);
      const second = await post('classes', teacherAuth, { name: 'Kelas Dua' }).expect(201);
      createdClasses.push(first.body, second.body);
      expect(first.body.classCode).toBeTruthy();
      expect(second.body.classCode).not.toBe(first.body.classCode);
      await post('classes/enroll', parentAuth, { classCode: first.body.classCode, studentName: 'Anak Satu' }).expect(201);
      await post('classes/enroll', parentAuth, { classCode: second.body.classCode, studentName: 'Anak Dua' }).expect(201);
      await post('classes/enroll', anotherParentAuth, { classCode: first.body.classCode, studentName: 'Anak Tiga' }).expect(201);
      const parentClasses = await get('classes/mine', parentAuth).expect(200);
      expect(parentClasses.body.map((item: { name: string }) => item.name).sort()).toEqual(['Kelas Dua', 'Kelas Satu']);
      const teacherClasses = await get('classes/mine', teacherAuth).expect(200);
      expect(teacherClasses.body).toHaveLength(2);
      expect(teacherClasses.body[0]._count.students + teacherClasses.body[1]._count.students).toBe(3);
      expect(JSON.stringify(teacherClasses.body)).not.toContain(first.body.classCode);
      await post('classes', parentAuth, { name: 'Tidak Diizinkan' }).expect(403);
      await post('classes/enroll', teacherAuth, { classCode: first.body.classCode, studentName: 'Siswa' }).expect(403);
      await post('classes/enroll', parentAuth, { classCode: 'KELAS-kode-tidak-valid', studentName: 'Siswa' }).expect(404);
      const enrolled = await get('students/mine', parentAuth).expect(200);
      expect(enrolled.body.map((item: { name: string }) => item.name).sort()).toEqual(['Anak Dua', 'Anak Satu']);
    } finally {
      await prisma.$transaction(async (tx) => {
        await tx.student.deleteMany({
          where: {
            OR: [
              { parentId: { in: [parent, anotherParent] } },
              { classId: { in: createdClasses.map(item => item.id) } },
            ],
          },
        });
        await tx.schoolClass.deleteMany({ where: { id: { in: createdClasses.map(item => item.id) } } });
        await tx.user.deleteMany({ where: { id: { in: [teacher, parent, anotherParent] } } });
      });
    }
  });
});
