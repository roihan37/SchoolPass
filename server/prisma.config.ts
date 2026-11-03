import { defineConfig } from 'prisma/config';
import { databaseUrl } from './src/config/database-env.js';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'npm run seed:run',
  },
  datasource: { url: databaseUrl() },
});
