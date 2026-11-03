import {
  createParamDecorator,
  SetMetadata,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Role } from '../generated/prisma/client.js';

export interface CurrentIdentity {
  id: string;
  name: string;
  email: string;
  role: Role;
}
export type AuthenticatedRequest = Request & { user: CurrentIdentity };
export const Public = () => SetMetadata('auth:public', true);
export const Roles = (...roles: Role[]) => SetMetadata('auth:roles', roles);
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CurrentIdentity =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
