import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import type { CurrentIdentity } from '../../common/auth/auth.identity.js';
import { createInvitationCode, hashInvitationCode } from '../../common/security/invitation-code.js';

@Injectable()
export class ClassesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async mine(user: CurrentIdentity) {
    if (user.role === 'TEACHER') {
      return this.prisma.schoolClass.findMany({ where: { teacherId: user.id }, select: { id: true, name: true, _count: { select: { students: true } } }, orderBy: { name: 'asc' } });
    }
    return this.prisma.schoolClass.findMany({ where: { students: { some: { parentId: user.id } } }, select: { id: true, name: true, teacher: { select: { name: true } } }, orderBy: { name: 'asc' } });
  }

  async create(user: CurrentIdentity, name: string) {
    this.requireTeacher(user);
    const { code, codeHash } = createInvitationCode('KELAS');
    try {
      const schoolClass = await this.prisma.schoolClass.create({ data: { name, teacherId: user.id, joinCodeHash: codeHash }, select: { id: true, name: true } });
      return { ...schoolClass, classCode: code };
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2002')
        throw new ConflictException('Nama kelas tersebut sudah digunakan oleh Anda.');
      throw error;
    }
  }

  async enrollParent(user: CurrentIdentity, classCode: string, studentName: string) {
    if (user.role !== 'PARENT') throw new ForbiddenException();
    const schoolClass = await this.prisma.schoolClass.findUnique({
      where: { joinCodeHash: hashInvitationCode(classCode) },
      select: { id: true },
    });
    if (!schoolClass) throw new NotFoundException('Kode kelas tidak ditemukan. Periksa kembali kode dari guru.');
    const student = await this.prisma.student.create({
      data: { name: studentName, classId: schoolClass.id, parentId: user.id },
      select: { id: true, name: true, classId: true },
    });
    return student;
  }

  private requireTeacher(user: CurrentIdentity) {
    if (user.role !== 'TEACHER') throw new ForbiddenException();
  }
}
