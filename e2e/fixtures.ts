import { prismaAdapter } from "@better-auth/prisma-adapter";
import { test as base, type BrowserContext } from "@playwright/test";
import { betterAuth } from "better-auth";
import { testUtils } from "better-auth/plugins";
import { readAuthEnv, sharedAuthOptions } from "@/lib/auth-options";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import { createPrismaClient } from "@/lib/prisma-client";
import { E2E_AUTH, e2eDatabaseUrl } from "./e2e-env";

// A real database session + correctly signed cookie, made by the test process with direct access
// to the test database and the test secret (Better Auth testUtils). The app has NO extra route,
// flag or bypass for this: the browser presents the cookie and the app verifies it as usual.

export interface E2EUser {
  id: string;
  name: string;
  email: string;
}

function createE2EAuth(client: PrismaClient) {
  return betterAuth({
    ...sharedAuthOptions(readAuthEnv({ ...E2E_AUTH })),
    database: prismaAdapter(client, { provider: "postgresql" }),
    plugins: [testUtils()],
    telemetry: { enabled: false },
  });
}

export const test = base.extend<
  { signIn: (context: BrowserContext, user: E2EUser) => Promise<void> },
  { db: PrismaClient }
>({
  db: [
    async ({}, provide) => {
      const client = createPrismaClient(e2eDatabaseUrl());
      await provide(client);
      await client.$disconnect();
    },
    { scope: "worker" },
  ],
  signIn: async ({ db }, provide) => {
    const auth = createE2EAuth(db);
    await provide(async (context, user) => {
      await db.user.upsert({
        where: { id: user.id },
        create: { ...user, emailVerified: true },
        update: {},
      });
      const ctx = await auth.$context;
      const cookies = await ctx.test.getCookies({ userId: user.id, domain: "localhost" });
      await context.addCookies(cookies);
    });
  },
});

export { expect } from "@playwright/test";
