import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";
import { testUtils } from "better-auth/plugins";
import { readAuthEnv, sharedAuthOptions } from "@/lib/auth-options";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import { createCartService, type CartService } from "@/lib/cart/cart-service";

// Test-only Better Auth instance over the test database: the same shared options as the app plus
// the testUtils plugin, which creates real Session rows and correctly signed cookies. The plugin
// registers no HTTP routes and is never part of lib/auth.ts, so it is not a login bypass of the app.
// Fixed fake credentials: the tests never talk to GitHub and do not need the real .env secrets.
const TEST_ENV = readAuthEnv({
  BETTER_AUTH_SECRET: "test-only-secret-0123456789abcdefghijklmnopqrstuv",
  BETTER_AUTH_URL: "http://localhost:3000",
  GITHUB_CLIENT_ID: "test-client-id",
  GITHUB_CLIENT_SECRET: "test-client-secret",
});

export function createTestAuth(client: PrismaClient) {
  return betterAuth({
    ...sharedAuthOptions(TEST_ENV),
    database: prismaAdapter(client, { provider: "postgresql" }),
    plugins: [testUtils()],
    telemetry: { enabled: false },
  });
}

export type TestAuth = ReturnType<typeof createTestAuth>;

/** Two fictional accounts for the A/B tests (no OAuth account, no password). */
export const USER_A = { id: "test-user-a", name: "Użytkownik A", email: "a@computer-shop.test" };
export const USER_B = { id: "test-user-b", name: "Użytkownik B", email: "b@computer-shop.test" };

/** A real database session of `userId`: its signed cookie as request headers. */
export async function signIn(auth: TestAuth, userId: string): Promise<Headers> {
  const ctx = await auth.$context;
  return (await ctx.test.login({ userId })).headers;
}

/**
 * Cart service exactly as the app wires it, except that the "current request" is given by
 * `headers`: the owner comes from auth.api.getSession over these headers, verified in the database.
 */
export function cartServiceFor(auth: TestAuth, client: PrismaClient, headers: Headers): CartService {
  return createCartService({
    getSession: () => auth.api.getSession({ headers }),
    getClient: () => client,
  });
}
