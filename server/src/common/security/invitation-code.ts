import { createHash, randomBytes } from 'node:crypto';

export function createInvitationCode(prefix: string) {
  const code = `${prefix}-${randomBytes(18).toString('base64url').toUpperCase()}`;
  return { code, codeHash: hashInvitationCode(code) };
}

export function hashInvitationCode(code: string) {
  return createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}

