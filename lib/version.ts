// Version of the running build (inlined at build time by next.config.ts) and of its environment.

export interface AppVersion {
  commit: string;
  builtAt: string;
  environment: string;
  region: string;
  node: string;
}

export function appVersion(env: Partial<Record<string, string>> = process.env): AppVersion {
  return {
    commit: process.env.APP_COMMIT_SHA ?? "unknown",
    builtAt: process.env.APP_BUILT_AT ?? "unknown",
    // VERCEL_ENV: production | preview | development; absent outside Vercel.
    environment: env.VERCEL_ENV ?? "local",
    region: env.VERCEL_REGION ?? "local",
    node: process.version,
  };
}
