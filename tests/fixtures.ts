import type { Product, ProductType } from "@/lib/products/types";

let nextCode = 0;

/** Builds a valid product; override any field for a specific case. */
export function makeProduct(overrides: Partial<Product> & Pick<Product, "id">): Product {
  nextCode += 1;
  const type: ProductType = overrides.type ?? "cpu";
  return {
    code: `TEST${String(nextCode).padStart(6, "0")}`,
    name: `Produkt ${overrides.id}`,
    type,
    price: 10000,
    amount: 5,
    description: "Opis testowy",
    date: "2026-10-01T10:00:00.000Z",
    image: `/images/products/${type}.webp`,
    ...overrides,
  };
}

/**
 * Name-order compatibility fixture from the lab instructions, kept for the
 * database adapter tests in Lab 08. Includes two Unicode spellings of "Ą".
 */
export const NAME_FIXTURE: ReadonlyArray<{ id: number; name: string }> = [
  { id: 2, name: "ALFA" },
  { id: 1, name: "alfa" },
  { id: 3, name: "Beta" },
  { id: 4, name: "Zeta" },
  { id: 5, name: "Alfa" },
  { id: 6, name: "Łącznik" },
  { id: 8, name: "Ą" }, // decomposed: A + combining ogonek
  { id: 7, name: "Ą" }, // precomposed U+0104
];

/**
 * Expected ids for NAME_FIXTURE sorted by name. "alfa", "ALFA" and "Alfa" share
 * the key "alfa" (tie → id 1, 2, 5); "ą" (C4 85) and "ł" (C5 82) sort after
 * ASCII "zeta" in UTF-8 byte order; both spellings of "Ą" tie → id 7, 8.
 */
export const NAME_FIXTURE_EXPECTED_IDS = [1, 2, 5, 3, 4, 7, 8, 6];
