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

describe("readAuthEnv on Vercel (Lab 10 — login after moving to the cloud)", () => {
  const PROD = { ...VALID, BETTER_AUTH_URL: "https://computer-shop-2026p1.vercel.app" };

  it("accepts the stable https domain in Production and Preview", () => {
    expect(readAuthEnv({ ...PROD, VERCEL_ENV: "production" }).BETTER_AUTH_URL).toBe(PROD.BETTER_AUTH_URL);
    expect(() => readAuthEnv({ ...PROD, VERCEL_ENV: "preview" })).not.toThrow();
  });

  it.each(["http://localhost:3000", "https://localhost:3000", "http://computer-shop-2026p1.vercel.app", "https://127.0.0.1"])(
    "rejects %s as the deployed base URL",
    (url) => {
      expect(() => readAuthEnv({ ...VALID, BETTER_AUTH_URL: url, VERCEL_ENV: "production" })).toThrow(/https/);
    },
  );

  it("rejects a path in the deployed base URL (callback would be wrong)", () => {
    expect(() =>
      readAuthEnv({ ...PROD, BETTER_AUTH_URL: "https://computer-shop-2026p1.vercel.app/api/auth", VERCEL_ENV: "production" }),
    ).toThrow(/origin only/);
  });

  it("still allows http://localhost in local development", () => {
    expect(() => readAuthEnv({ ...VALID, VERCEL_ENV: "development" })).not.toThrow();
    expect(() => readAuthEnv(VALID)).not.toThrow();
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

  it("trusts exactly the origin of BETTER_AUTH_URL — no wildcard domains", () => {
    expect(options.trustedOrigins).toEqual(["http://localhost:3000"]);
    const prod = sharedAuthOptions(readAuthEnv({ ...VALID, BETTER_AUTH_URL: "https://computer-shop-2026p1.vercel.app" }));
    expect(prod.trustedOrigins).toEqual(["https://computer-shop-2026p1.vercel.app"]);
    expect(prod.trustedOrigins.some((origin) => origin.includes("*"))).toBe(false);
  });

  it("keeps the database session authoritative and the security checks on", () => {
    expect(options.session.cookieCache.enabled).toBe(false);
    expect(options).not.toHaveProperty("advanced");
    expect(JSON.stringify(options)).not.toMatch(/disableCSRFCheck|disableOriginCheck/);
  });
});
