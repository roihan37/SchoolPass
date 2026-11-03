import type { Request } from 'express';
import type { Role } from '../../generated/prisma/client.js';

export interface CurrentIdentity {
  id: string;
  name: string;
  email: string;
  role: Role;
}
export type AuthenticatedRequest = Request & { user: CurrentIdentity };

export const identitySelect = {
  id: true,
  name: true,
  email: true,
  role: true,
} as const;
