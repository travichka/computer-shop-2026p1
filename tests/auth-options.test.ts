import { describe, expect, it } from "vitest";
import { readAuthEnv, sharedAuthOptions } from "@/lib/auth-options";

const VALID = {
  BETTER_AUTH_SECRET: "x".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
  GITHUB_CLIENT_ID: "client-id",
  GITHUB_CLIENT_SECRET: "client-secret",
};

describe("readAuthEnv", () => {
  it("returns the four variables when all are set", () => {
    expect(readAuthEnv(VALID)).toEqual(VALID);
  });

  it.each(Object.keys(VALID))("names a missing or blank %s instead of passing undefined on", (name) => {
    expect(() => readAuthEnv({ ...VALID, [name]: undefined })).toThrow(name);
    expect(() => readAuthEnv({ ...VALID, [name]: "   " })).toThrow(name);
  });

  it("rejects a short secret and a relative or non-http base URL", () => {
    expect(() => readAuthEnv({ ...VALID, BETTER_AUTH_SECRET: "short" })).toThrow(/at least 32/);
    expect(() => readAuthEnv({ ...VALID, BETTER_AUTH_URL: "localhost:3000" })).toThrow(/http/);
    expect(() => readAuthEnv({ ...VALID, BETTER_AUTH_URL: "ftp://localhost" })).toThrow(/http/);
  });
});

describe("sharedAuthOptions", () => {
  const options = sharedAuthOptions(readAuthEnv(VALID));

  it("uses exactly GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET and only profile + e-mail scopes", () => {
    expect(options.socialProviders.github).toMatchObject({
      clientId: "client-id",
      clientSecret: "client-secret",
      disableDefaultScope: true,
      scope: ["read:user", "user:email"],
    });
    expect(options.socialProviders.github.scope.some((scope) => scope.includes("repo"))).toBe(false);
  });

  it("keeps the database session authoritative and the security checks on", () => {
    expect(options.session.cookieCache.enabled).toBe(false);
    expect(options).not.toHaveProperty("advanced");
    expect(JSON.stringify(options)).not.toMatch(/disableCSRFCheck|disableOriginCheck/);
  });
});
