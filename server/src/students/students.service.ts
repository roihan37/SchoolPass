import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CurrentIdentity } from '../auth/auth.decorators.js';

@Injectable()
export class StudentsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  mine(user: CurrentIdentity) {
    if (user.role !== 'PARENT') throw new ForbiddenException();
    return this.prisma.student.findMany({
      where: { parentId: user.id },
      select: {
        id: true,
        name: true,
        classId: true,
        schoolClass: { select: { id: true, name: true } },
      },
      orderBy: { id: 'asc' },
    });
  }
}
