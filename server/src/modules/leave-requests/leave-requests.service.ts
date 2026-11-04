import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type LeaveRequest } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { MinioStorageService } from '../../infrastructure/storage/minio-storage.service.js';
import type { CurrentIdentity } from '../../common/auth/auth.identity.js';
import type { CreateLeaveRequestDto } from './dto/create-leave-request.dto.js';
import type { DecideLeaveRequestDto } from './dto/decide-leave-request.dto.js';
import type { Express } from 'express';
import { basename, win32 } from 'node:path';
import { NotificationsService } from '../notifications/notifications.service.js';
import { DashboardService } from '../dashboard/dashboard.service.js';

const response = (leave: LeaveRequest) => ({
  ...leave,
  absenceDate: leave.absenceDate.toISOString().slice(0, 10),
});

@Injectable()
export class LeaveRequestsService {
  private readonly logger = new Logger(LeaveRequestsService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MinioStorageService) private readonly storage: MinioStorageService,
    @Inject(NotificationsService)
    private readonly notifications: NotificationsService,
    @Inject(DashboardService) private readonly dashboard: DashboardService,
  ) {}

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

    const result = await this.prisma.$transaction(async (tx) => {
      const where = { id, ...this.visibility(user) };
      const leave = await tx.leaveRequest.findFirst({
        where,
        select: { id: true, submittedById: true },
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
      const leaveResponse = response(
        await tx.leaveRequest.findUniqueOrThrow({ where: { id } }),
      );
      return { leaveResponse, notificationUserId: leave.submittedById };
    });
    await this.dashboard.invalidate(user.id);
    // Keputusan sudah commit; enqueue Redis terpisah, jadi transactional outbox
    // diperlukan untuk menutup celah jika proses berhenti tepat di antara keduanya.
    await this.notifications.enqueueDecision({
      userId: result.notificationUserId,
      leaveRequestId: id,
      status: dto.status,
    });
    return result.leaveResponse;
  }

  async addAttachment(
    user: CurrentIdentity,
    id: string,
    file: Express.Multer.File,
  ) {
    if (user.role !== 'PARENT') throw new ForbiddenException();
    if (!file) throw new BadRequestException('File is required');
    this.validateAttachment(file);

    const leave = await this.prisma.leaveRequest.findFirst({
      where: { id, ...this.visibility(user) },
      select: { id: true, status: true, attachment: { select: { id: true } } },
    });
    if (!leave) throw new NotFoundException('Leave request not found');
    if (leave.status !== 'PENDING')
      throw new ConflictException(
        'Attachments can only be added while pending',
      );
    if (leave.attachment)
      throw new ConflictException('An attachment already exists');

    const objectKey = await this.storage.put({
      buffer: file.buffer,
      mimeType: file.mimetype,
    });
    try {
      const fileName = this.safeFileName(file.originalname);
      return await this.prisma.attachment.create({
        data: {
          leaveRequestId: leave.id,
          objectKey,
          fileName,
          mimeType: file.mimetype,
          fileSize: file.size,
        },
        select: {
          id: true,
          leaveRequestId: true,
          fileName: true,
          mimeType: true,
          fileSize: true,
        },
      });
    } catch (error) {
      try {
        await this.storage.remove(objectKey);
      } catch {
        this.logger.warn('Could not clean up an object after metadata failure');
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException('An attachment already exists');
      throw error;
    }
  }

  async attachmentUrl(user: CurrentIdentity, id: string) {
    const leave = await this.prisma.leaveRequest.findFirst({
      where: { id, ...this.visibility(user) },
      select: {
        attachment: {
          select: {
            id: true,
            objectKey: true,
            fileName: true,
            mimeType: true,
            fileSize: true,
          },
        },
      },
    });
    if (!leave?.attachment) throw new NotFoundException('Attachment not found');
    const url = await this.storage.signDownload(leave.attachment.objectKey);
    const { objectKey: _, ...metadata } = leave.attachment;
    return { ...metadata, url, expiresIn: 300 };
  }

  private validateAttachment(file: Express.Multer.File) {
    const bytes = file.buffer;
    const signatures: Record<string, (value: Buffer) => boolean> = {
      'application/pdf': (value) => value.subarray(0, 5).toString() === '%PDF-',
      'image/jpeg': (value) =>
        value.length >= 3 &&
        value[0] === 0xff &&
        value[1] === 0xd8 &&
        value[2] === 0xff,
      'image/png': (value) =>
        value.length >= 8 &&
        value
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    };
    if (!signatures[file.mimetype]?.(bytes))
      throw new BadRequestException(
        'Only matching PDF, JPEG, or PNG files are supported',
      );
  }

  private safeFileName(value: string) {
    const sanitized = Array.from(win32.basename(value))
      .filter((character) => {
        const codePoint = character.codePointAt(0) ?? 0;
        return codePoint >= 0x20 && codePoint !== 0x7f;
      })
      .join('');
    return basename(sanitized).trim().slice(0, 255) || 'attachment';
  }
}
