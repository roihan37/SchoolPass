import { ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { RedisCacheService } from '../../infrastructure/cache/redis-cache.service.js';
import type { CurrentIdentity } from '../../common/auth/auth.identity.js';

type ClassSummary = {
  classId: string;
  className: string;
  total: number;
  pending: number;
  approved: number;
  rejected: number;
};

type DashboardSummary = {
  totals: Omit<ClassSummary, 'classId' | 'className'>;
  classes: ClassSummary[];
};

const CACHE_TTL_SECONDS = 60;

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedisCacheService) private readonly cache: RedisCacheService,
  ) {}

  async summary(user: CurrentIdentity): Promise<DashboardSummary> {
    if (user.role !== 'TEACHER') throw new ForbiddenException();
    const key = `dashboard:summary:${user.id}`;
    try {
      const cached = await this.cache.get<DashboardSummary>(key);
      if (cached) return cached;
    } catch {
      this.logger.warn('Dashboard cache read failed; reading PostgreSQL');
    }

    const summary = await this.buildSummary(user.id);
    try {
      await this.cache.set(key, summary, CACHE_TTL_SECONDS);
    } catch {
      this.logger.warn('Dashboard cache write failed');
    }
    return summary;
  }

  async invalidate(teacherId: string) {
    try {
      await this.cache.delete(`dashboard:summary:${teacherId}`);
    } catch {
      this.logger.warn(
        'Dashboard cache invalidation failed; TTL remains active',
      );
    }
  }

  private async buildSummary(teacherId: string): Promise<DashboardSummary> {
    const classes = await this.prisma.schoolClass.findMany({
      where: { teacherId },
      select: { id: true, name: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });

    const summaries = await Promise.all(
      classes.map(async (schoolClass) => {
        const counts = await this.prisma.leaveRequest.groupBy({
          by: ['status'],
          where: { student: { classId: schoolClass.id } },
          _count: { _all: true },
        });
        return {
          classId: schoolClass.id,
          className: schoolClass.name,
          total: counts.reduce((sum, item) => sum + item._count._all, 0),
          pending:
            counts.find((item) => item.status === 'PENDING')?._count._all ?? 0,
          approved:
            counts.find((item) => item.status === 'APPROVED')?._count._all ?? 0,
          rejected:
            counts.find((item) => item.status === 'REJECTED')?._count._all ?? 0,
        } satisfies ClassSummary;
      }),
    );

    return {
      classes: summaries,
      totals: summaries.reduce(
        (sum, item) => ({
          total: sum.total + item.total,
          pending: sum.pending + item.pending,
          approved: sum.approved + item.approved,
          rejected: sum.rejected + item.rejected,
        }),
        { total: 0, pending: 0, approved: 0, rejected: 0 },
      ),
    };
  }
}
