import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";
import { testUtils } from "better-auth/plugins";
import { convertSetCookieToCookie } from "better-auth/test";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sharedAuthOptions } from "@/lib/auth-options";
import { createTestAuth, signIn, TEST_ENV, USER_A } from "./test-auth";
import { createTestClient, resetDatabase } from "./test-db";

// Extension "Sesje na wielu urządzeniach": two browser profiles = two Session rows of one user.
const client = createTestClient();
const auth = createTestAuth(client);
afterAll(() => client.$disconnect());

let profile1: Headers;
let profile2: Headers;

beforeEach(async () => {
  await resetDatabase(client);
  await client.user.create({ data: USER_A });
  profile1 = await signIn(auth, USER_A.id);
  profile2 = await signIn(auth, USER_A.id);
});

const userOf = async (headers: Headers) => (await auth.api.getSession({ headers }))?.user.id ?? null;

describe("signing out one device vs. revoking all sessions", () => {
  it("signOut ends only the current session; the other profile stays signed in", async () => {
    await auth.api.signOut({ headers: profile1 });
    expect(await userOf(profile1)).toBeNull();
    expect(await userOf(profile2)).toBe(USER_A.id);
    expect(await client.session.count()).toBe(1);
  });

  it("revokeOtherSessions keeps the current session and rejects the other profile", async () => {
    await auth.api.revokeOtherSessions({ headers: profile1 });
    expect(await userOf(profile1)).toBe(USER_A.id);
    expect(await userOf(profile2)).toBeNull();
  });

  it("revokeSessions rejects every profile of the user immediately", async () => {
    await auth.api.revokeSessions({ headers: profile1 });
    expect(await userOf(profile1)).toBeNull();
    expect(await userOf(profile2)).toBeNull();
    expect(await client.session.count()).toBe(0);
  });

  it("listSessions shows both sessions of the user", async () => {
    expect(await auth.api.listSessions({ headers: profile1 })).toHaveLength(2);
  });
});

describe("why the cookie cache stays disabled", () => {
  it("with cookieCache enabled a revoked profile is still accepted until the cache expires", async () => {
    const cached = betterAuth({
      ...sharedAuthOptions(TEST_ENV),
      session: { cookieCache: { enabled: true, maxAge: 300 } },
      database: prismaAdapter(client, { provider: "postgresql" }),
      plugins: [testUtils()],
      telemetry: { enabled: false },
    });
    const login = await (await cached.$context).test.login({ userId: USER_A.id });
    // The first getSession sets the signed session_data cookie; the browser would send it back.
    const { headers: setCookie } = await cached.api.getSession({ headers: login.headers, returnHeaders: true });
    const withCache = convertSetCookieToCookie(new Headers([["cookie", login.headers.get("cookie")!], ...setCookie]));

    await client.session.deleteMany({ where: { userId: USER_A.id } }); // "log out everywhere"

    expect((await cached.api.getSession({ headers: withCache }))?.user.id).toBe(USER_A.id); // stale!
    expect(await auth.api.getSession({ headers: withCache })).toBeNull(); // app config: rejected at once
  });
});
