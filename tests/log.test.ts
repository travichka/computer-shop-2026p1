import { afterEach, describe, expect, it, vi } from "vitest";
import { logServerError, redact, summarizeError } from "@/lib/log";

describe("redact (Lab 10 — logs without secrets)", () => {
  it("hides credentials of a connection string but keeps the host", () => {
    const out = redact("connect failed: postgresql://shop_app:S3cr3t-pass@ep-x.eu-central-1.aws.neon.tech/shop");
    expect(out).not.toContain("S3cr3t-pass");
    expect(out).not.toContain("shop_app");
    expect(out).toContain("ep-x.eu-central-1.aws.neon.tech");
  });

  it("hides password=…, cookies and bearer/GitHub tokens", () => {
    const out = redact(
      "password=hunter2 cookie: better-auth.session_token=abc.def Bearer eyJhbGci gho_abcdefghijklmnopqrstuvwxyz012345",
    );
    for (const secret of ["hunter2", "abc.def", "eyJhbGci", "gho_abcdefghijklmnopqrstuvwxyz012345"]) {
      expect(out).not.toContain(secret);
    }
  });

  it("leaves ordinary messages unchanged", () => {
    expect(redact("Can't reach database server at host:5432")).toBe("Can't reach database server at host:5432");
  });
});

describe("summarizeError / logServerError", () => {
  afterEach(() => vi.restoreAllMocks());

  it("keeps name and driver code, redacts the message", () => {
    const error = Object.assign(new Error("password authentication failed, password=x1y2"), { code: "28P01" });
    expect(summarizeError(error)).toEqual({ name: "Error", code: "28P01", message: "password authentication failed, password=<redacted>" });
  });

  it("logs one line with the operation and no secret", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logServerError("cart.addProduct", new Error("postgresql://u:p4ss@db/shop timed out"));
    expect(spy).toHaveBeenCalledOnce();
    const line = spy.mock.calls[0].join(" ");
    expect(line).toContain("[cart.addProduct] failed");
    expect(line).not.toContain("p4ss");
  });
});
