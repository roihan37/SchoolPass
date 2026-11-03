import { testDatabaseUrl } from '../src/config/database-env.js';

describe('test database isolation', () => {
  beforeEach(() => {
    vi.stubEnv('DATABASE_URL', 'postgresql://127.0.0.1/schoolpass');
    vi.stubEnv('TEST_DATABASE_URL', '');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('uses a separate database by default', () => {
    expect(new URL(testDatabaseUrl()).pathname).toBe('/schoolpass_test');
  });

  it.each(['schoolpass', 'production', 'schoolpass_test'])(
    'rejects an unsafe test target %s',
    (name) => {
      if (name === 'schoolpass_test') {
        vi.stubEnv('DATABASE_URL', 'postgresql://127.0.0.1/schoolpass_test');
      }
      vi.stubEnv('TEST_DATABASE_URL', `postgresql://127.0.0.1/${name}`);
      expect(() => testDatabaseUrl()).toThrow('Test database must be separate');
    },
  );
});
