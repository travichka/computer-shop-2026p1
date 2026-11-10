import { describe, expect, it } from "vitest";
import { isLocalDatabase, shouldSeedDemo } from "@/prisma/seed-options";

const LOCAL = "postgresql://shop:x@localhost:5432/shop";
const REMOTE = "postgresql://owner:x@ep-cool-1.eu-central-1.aws.neon.tech/shop?sslmode=verify-full";

describe("seed options (Lab 10 — catalog-only seed of the remote database)", () => {
  it("recognises local and remote hosts", () => {
    expect(isLocalDatabase(LOCAL)).toBe(true);
    expect(isLocalDatabase("postgresql://shop:x@127.0.0.1:5433/shop")).toBe(true);
    expect(isLocalDatabase(REMOTE)).toBe(false);
  });

  it("seeds demo accounts locally but not on a remote database by default", () => {
    expect(shouldSeedDemo(LOCAL, {})).toBe(true);
    expect(shouldSeedDemo(REMOTE, {})).toBe(false);
  });

  it("follows an explicit SEED_DEMO flag", () => {
    expect(shouldSeedDemo(REMOTE, { SEED_DEMO: "true" })).toBe(true);
    expect(shouldSeedDemo(LOCAL, { SEED_DEMO: "false" })).toBe(false);
    expect(() => shouldSeedDemo(LOCAL, { SEED_DEMO: "yes" })).toThrow(/SEED_DEMO/);
  });
});
