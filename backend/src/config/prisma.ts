import { PrismaClient } from '@prisma/client';
import { isProd } from './env';

// Reuse a single PrismaClient instance across hot reloads in dev to avoid
// exhausting the Postgres connection pool.
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ??
  new PrismaClient({
    log: isProd ? ['error', 'warn'] : ['error', 'warn'],
  });

if (!isProd) {
  global.__prisma = prisma;
}
