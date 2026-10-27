// Prisma CLI configuration (migrate, generate, db seed). The app does not read this file:
// at runtime PrismaClient connects through the PrismaPg adapter (lib/prisma-client.ts).
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: { url: env("DATABASE_URL") },
});
