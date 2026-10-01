import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@jobpilot/database";

let prisma: PrismaClient | undefined;

export function getPrisma(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl === undefined || databaseUrl.trim().length === 0) {
    throw new Error("DATABASE_URL is required");
  }
  if (prisma === undefined) {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: databaseUrl }),
    });
  }
  return prisma;
}
