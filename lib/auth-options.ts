import type { BetterAuthOptions } from "better-auth";

// Settings shared by the runtime instance (lib/auth.ts), the CLI config (auth.ts in the project root)
// and the test instance. No database adapter and no server-only import here, so the Better Auth CLI
// and tsx/vitest can load it outside Next.js.

const AUTH_ENV = ["BETTER_AUTH_SECRET", "BETTER_AUTH_URL", "GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"] as const;
type AuthEnvName = (typeof AUTH_ENV)[number];
export type AuthEnv = Record<AuthEnvName, string>;

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "0.0.0.0"]);

/** Minimum length of BETTER_AUTH_SECRET (e.g. `openssl rand -base64 32` gives 44 characters). */
export const MIN_SECRET_LENGTH = 32;

/**
 * Reads and checks the server-only auth variables. A missing or blank value is an explicit error
 * at configuration time instead of `process.env.X as string` silently passing undefined on.
 */
export function readAuthEnv(env: Partial<Record<string, string>> = process.env): AuthEnv {
  const missing = AUTH_ENV.filter((name) => !env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing auth environment variables: ${missing.join(", ")} — see .env.example.`);
  }
  const values = Object.fromEntries(AUTH_ENV.map((name) => [name, env[name]!.trim()])) as AuthEnv;
  if (values.BETTER_AUTH_SECRET.length < MIN_SECRET_LENGTH) {
    throw new Error(`BETTER_AUTH_SECRET must have at least ${MIN_SECRET_LENGTH} characters.`);
  }
  const url = URL.canParse(values.BETTER_AUTH_URL) ? new URL(values.BETTER_AUTH_URL) : null;
  if (url === null || (url.protocol !== "http:" && url.protocol !== "https:")) {
    throw new Error("BETTER_AUTH_URL must be an absolute http(s) URL, e.g. http://localhost:3000.");
  }
  // Deployed on Vercel (Preview/Production): the OAuth callback must come back to the stable HTTPS
  // domain of this environment. A copied localhost value would send GitHub back to the developer's
  // machine, so it is a configuration error instead of a silent login failure.
  if (env.VERCEL_ENV === "production" || env.VERCEL_ENV === "preview") {
    if (url.protocol !== "https:" || LOCAL_HOSTS.has(url.hostname)) {
      throw new Error(`BETTER_AUTH_URL must be the public https:// domain on Vercel (${env.VERCEL_ENV}).`);
    }
    if (url.pathname !== "/" || url.search || url.hash) {
      throw new Error("BETTER_AUTH_URL must be an origin only, e.g. https://shop.vercel.app (no path).");
    }
  }
  return values;
}

/**
 * Provider and model settings without `database`. Sessions live in PostgreSQL; the signed cookie
 * cache stays disabled, so every getSession() reads the current session row (a revoked or deleted
 * session is rejected immediately). CSRF/origin checks, `state` and secure cookie defaults are kept.
 */
export function sharedAuthOptions(env: AuthEnv) {
  return {
    appName: "Computer Shop 2026",
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    // Exactly the origin of this environment — no wildcard like https://*.vercel.app, so a random
    // Preview or foreign deployment cannot start or finish a login against this instance.
    trustedOrigins: [new URL(env.BETTER_AUTH_URL).origin],
    socialProviders: {
      github: {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
        // Profile and e-mail only (the e-mail is required by Better Auth); no repository access.
        disableDefaultScope: true,
        scope: ["read:user", "user:email"],
      },
    },
    session: {
      cookieCache: { enabled: false },
    },
    account: {
      // OAuth tokens are not used by the shop; if stored, they are encrypted with the secret.
      encryptOAuthTokens: true,
    },
  } satisfies Omit<BetterAuthOptions, "database">;
}
