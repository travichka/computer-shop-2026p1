import { describe, expect, it } from "vitest";
import { describeTarget, formatTarget } from "@/scripts/lib/db-target";

describe("describeTarget (Lab 10 — check the target without the password)", () => {
  it("describes a Neon pooled URL and never includes the password", () => {
    const url = "postgresql://shop_app:Sup3r-Secret@ep-cool-1-pooler.eu-central-1.aws.neon.tech/shop?sslmode=verify-full";
    const target = describeTarget(url);
    expect(target).toMatchObject({ user: "shop_app", database: "shop", sslmode: "verify-full", pooled: true, local: false });
    expect(formatTarget(target)).not.toContain("Sup3r-Secret");
    expect(formatTarget(target)).toContain("REMOTE");
  });

  it("marks a direct local database", () => {
    const target = describeTarget("postgresql://shop:x@localhost:5432/shop");
    expect(target).toMatchObject({ pooled: false, local: true, sslmode: "(none)", port: "5432" });
  });

  it("rejects other protocols", () => {
    expect(() => describeTarget("mysql://u:p@h/db")).toThrow(/postgresql/);
  });
});
