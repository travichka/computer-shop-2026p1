import { expect, it } from "vitest";

// Lab 10, extension CI/CD: deliberately failing test proving that Release does not publish. Reverted next.
it("deliberately fails to prove that the release gate works", () => {
  expect("release").toBe("blocked");
});
