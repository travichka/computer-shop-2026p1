import { execSync } from "node:child_process";
import type { NextConfig } from "next";

// Commit of this build (Lab 10: the acceptance test must name the SHA that is really deployed).
// Vercel Git builds set VERCEL_GIT_COMMIT_SHA, GitHub Actions sets GITHUB_SHA, locally git is asked.
// Public information only — no secrets are ever put into next.config.ts.
function buildCommit(): string {
  const fromCi = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA;
  if (fromCi) return fromCi;
  try {
    return execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "unknown";
  }
}

const nextConfig: NextConfig = {
  env: {
    APP_COMMIT_SHA: buildCommit(),
    APP_BUILT_AT: new Date().toISOString(),
  },
};

export default nextConfig;
