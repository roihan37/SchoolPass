import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { databaseUrl } from '../src/config/database-env.js';
import { seedDatabase } from './seed-data.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: databaseUrl(),
    connectionTimeoutMillis: 5000,
  }),
});
try {
  await seedDatabase(prisma, process.env.SEED_PASSWORD ?? '');
  console.log(
    'Fictional seed ready: 1 teacher, 2 parents, 2 classes, 3 students.',
  );
} finally {
  await prisma.$disconnect();
}
