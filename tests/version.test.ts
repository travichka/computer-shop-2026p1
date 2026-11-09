import { afterEach, describe, expect, it, vi } from "vitest";
import { appVersion } from "@/lib/version";

describe("appVersion (Lab 10 — which commit is deployed)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("reports the build commit and the Vercel environment and region", () => {
    vi.stubEnv("APP_COMMIT_SHA", "0123456789abcdef0123456789abcdef01234567");
    const version = appVersion({ VERCEL_ENV: "production", VERCEL_REGION: "fra1" });
    expect(version).toMatchObject({
      commit: "0123456789abcdef0123456789abcdef01234567",
      environment: "production",
      region: "fra1",
    });
    expect(version.node).toMatch(/^v24\./);
  });

  it("falls back to local outside Vercel", () => {
    expect(appVersion({})).toMatchObject({ environment: "local", region: "local" });
  });

  it("exposes no secret-like fields", () => {
    expect(Object.keys(appVersion({}))).toEqual(["commit", "builtAt", "environment", "region", "node"]);
  });
});
