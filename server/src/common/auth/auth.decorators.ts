import {
  createParamDecorator,
  SetMetadata,
  type ExecutionContext,
} from '@nestjs/common';
import type { Role } from '../../generated/prisma/client.js';
import type { AuthenticatedRequest, CurrentIdentity } from './auth.identity.js';

export const Public = () => SetMetadata('auth:public', true);
export const Roles = (...roles: Role[]) => SetMetadata('auth:roles', roles);
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CurrentIdentity =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
