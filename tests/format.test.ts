import { describe, expect, it } from "vitest";
import { formatPrice } from "@/lib/format";

// Intl uses non-breaking spaces (groups of 5+ digits, before "zł"); pl-PL does not group 4 digits.
const plain = (text: string) => text.replace(/\s/g, " ");

describe("formatPrice", () => {
  it("formats grosze as złoty for number and bigint alike", () => {
    expect(plain(formatPrice(129999))).toBe("1299,99 zł");
    expect(plain(formatPrice(BigInt(129999)))).toBe("1299,99 zł");
    expect(plain(formatPrice(BigInt(5)))).toBe("0,05 zł");
    expect(plain(formatPrice(BigInt(0)))).toBe("0,00 zł");
  });

  it("stays exact beyond Number.MAX_SAFE_INTEGER", () => {
    expect(plain(formatPrice(BigInt("900719925474099301")))).toBe("9 007 199 254 740 993,01 zł");
  });
});
