import { describe, expect, it } from "vitest";
import { DEFAULT_POOL_MAX, poolConfig } from "@/lib/prisma-client";

const URL_ = "postgresql://app:secret@db.example.com:5432/shop?sslmode=verify-full";

describe("poolConfig (Lab 10 — pool per cloud instance)", () => {
  it("uses a small default pool with short idle timeout", () => {
    const config = poolConfig(URL_, {});
    expect(config.max).toBe(DEFAULT_POOL_MAX);
    expect(config.idleTimeoutMillis).toBeLessThanOrEqual(10_000);
    expect(config.connectionTimeoutMillis).toBeGreaterThan(0);
    expect(config.application_name).toBe("computer-shop");
  });

  it("keeps the connection string (TLS mode comes from it, never disabled here)", () => {
    const config = poolConfig(URL_, {});
    expect(config.connectionString).toBe(URL_);
    expect(config.ssl).toBeUndefined();
  });

  it("reads DATABASE_POOL_MAX", () => {
    expect(poolConfig(URL_, { DATABASE_POOL_MAX: "3" }).max).toBe(3);
  });

  it.each(["0", "-1", "51", "2.5", "abc"])("rejects DATABASE_POOL_MAX=%s", (value) => {
    expect(() => poolConfig(URL_, { DATABASE_POOL_MAX: value })).toThrow(/DATABASE_POOL_MAX/);
  });
});
