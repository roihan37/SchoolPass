import { randomBytes, scryptSync } from 'node:crypto';
import { hashPassword, verifyPassword } from './password.js';

describe('password security', () => {
  it('salts hashes and verifies correct passwords only', async () => {
    const password = randomBytes(24).toString('hex');
    const first = await hashPassword(password);
    expect(first).not.toContain(password);
    expect(await hashPassword(password)).not.toBe(first);
    expect(await verifyPassword(password, first)).toBe(true);
    expect(await verifyPassword('wrong', first)).toBe(false);
  });
  it('supports Phase 01 seed hashes', async () => {
    const salt = randomBytes(16).toString('hex');
    const password = randomBytes(24).toString('hex');
    const legacy = `scrypt$${salt}$${scryptSync(password, salt, 64).toString('hex')}`;
    expect(await verifyPassword(password, legacy)).toBe(true);
  });
  it.each(['', 'plaintext', 'scrypt$bad$bad'])(
    'rejects malformed hash %j',
    async (hash) => {
      expect(await verifyPassword('anything', hash)).toBe(false);
    },
  );
});
