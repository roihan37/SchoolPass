import { jwtSecret } from './auth.module.js';

describe('JWT configuration', () => {
  it.each(['', 'short', ' '.repeat(40)])(
    'rejects missing or insufficient JWT secret',
    (secret) => {
      vi.stubEnv('JWT_SECRET', secret);
      try {
        expect(() => jwtSecret()).toThrow('JWT_SECRET');
      } finally {
        vi.unstubAllEnvs();
      }
    },
  );
});
