import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type LeaveRequest } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import type { CurrentIdentity } from '../../common/auth/auth.identity.js';
import type { CreateLeaveRequestDto } from './dto/create-leave-request.dto.js';
import type { DecideLeaveRequestDto } from './dto/decide-leave-request.dto.js';

const response = (leave: LeaveRequest) => ({
  ...leave,
  absenceDate: leave.absenceDate.toISOString().slice(0, 10),
});

@Injectable()
export class LeaveRequestsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private visibility(user: CurrentIdentity): Prisma.LeaveRequestWhereInput {
    if (user.role === 'PARENT') {
      return { submittedById: user.id, student: { parentId: user.id } };
    }
    if (user.role === 'TEACHER') {
      return { student: { schoolClass: { teacherId: user.id } } };
    }
    throw new ForbiddenException();
  }

  async create(user: CurrentIdentity, dto: CreateLeaveRequestDto) {
    if (user.role !== 'PARENT') throw new ForbiddenException();
    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, parentId: user.id },
      select: { id: true },
    });
    if (!student) throw new NotFoundException('Student not found');

    try {
      return response(
        await this.prisma.leaveRequest.create({
          data: {
            studentId: student.id,
            submittedById: user.id,
            absenceDate: new Date(`${dto.absenceDate}T00:00:00.000Z`),
            type: dto.type,
            reason: dto.reason.trim(),
          },
        }),
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A request already exists for this student and date',
        );
      }
      throw error;
    }
  }

  async list(user: CurrentIdentity) {
    const leaves = await this.prisma.leaveRequest.findMany({
      where: this.visibility(user),
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
    return leaves.map(response);
  }

  async detail(user: CurrentIdentity, id: string) {
    const leave = await this.prisma.leaveRequest.findFirst({
      where: { id, ...this.visibility(user) },
    });
    if (!leave) throw new NotFoundException('Leave request not found');
    return response(leave);
  }

  async decide(user: CurrentIdentity, id: string, dto: DecideLeaveRequestDto) {
    if (user.role !== 'TEACHER') throw new ForbiddenException();
    if (dto.status === 'REJECTED' && !dto.decisionReason?.trim()) {
      throw new BadRequestException('A rejection requires a decision reason');
    }

    return this.prisma.$transaction(async (tx) => {
      const where = { id, ...this.visibility(user) };
      const leave = await tx.leaveRequest.findFirst({
        where,
        select: { id: true },
      });
      if (!leave) throw new NotFoundException('Leave request not found');

      // The database rechecks PENDING after any competing write has committed.
      const updated = await tx.leaveRequest.updateMany({
        where: { ...where, status: 'PENDING' },
        data: {
          status: dto.status,
          reviewedById: user.id,
          reviewedAt: new Date(),
          decisionReason: dto.decisionReason?.trim() ?? null,
        },
      });
      if (updated.count !== 1)
        throw new ConflictException('The request has already been decided');
      return response(
        await tx.leaveRequest.findUniqueOrThrow({ where: { id } }),
      );
    });
  }
}
