// Deterministic generator of the product catalogue (data/products.json).
// Usage: node scripts/generate-products.mjs [seed]   (default seed: 2026)
// The same seed always produces byte-identical output.

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const COUNT = 100;
const seed = Number(process.argv[2] ?? 2026);
if (!Number.isSafeInteger(seed)) throw new Error(`Invalid seed: ${process.argv[2]}`);

// mulberry32 — small, well-known seeded PRNG.
function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = mulberry32(seed);
const int = (min, max) => min + Math.floor(random() * (max - min + 1));
const pick = (items) => items[int(0, items.length - 1)];

const CATALOGUE = {
  cpu: {
    prefix: ["Procesor", "CPU", "procesor"],
    models: ["Ryzen 5 9600X", "Ryzen 7 9700X", "Ryzen 9 9950X", "Core Ultra 5 245K", "Core Ultra 7 265K", "Core Ultra 9 285K"],
    suffix: ["BOX", "Tray", "z chłodzeniem", "wersja złota"],
    price: [499, 3299],
    description: "Wydajny procesor do komputerów stacjonarnych. Gwarancja producenta 36 miesięcy.",
  },
  gpu: {
    prefix: ["Karta graficzna", "GPU", "karta graficzna"],
    models: ["GeForce RTX 5060", "GeForce RTX 5070", "GeForce RTX 5080", "Radeon RX 9060 XT", "Radeon RX 9070 XT", "Arc B580"],
    suffix: ["OC", "Gaming", "Biała Edycja", "Low Profile"],
    price: [1199, 6999],
    description: "Karta graficzna do gier i obliczeń. Obsługa śledzenia promieni i wielu monitorów.",
  },
  ram: {
    prefix: ["Pamięć RAM", "PAMIĘĆ", "pamięć ram"],
    models: ["DDR5 16 GB 5600 MHz", "DDR5 32 GB 6000 MHz", "DDR5 64 GB 6400 MHz", "DDR4 16 GB 3200 MHz", "DDR4 32 GB 3600 MHz"],
    suffix: ["CL30", "RGB", "Łączona para", "niskoprofilowa"],
    price: [149, 1599],
    description: "Moduły pamięci operacyjnej o niskich opóźnieniach. Dożywotnia gwarancja.",
  },
  disk: {
    prefix: ["Dysk SSD", "Dysk HDD", "DYSK SSD", "dysk"],
    models: ["NVMe 1 TB", "NVMe 2 TB", "NVMe 4 TB", "SATA 512 GB", "SATA 2 TB", "8 TB 7200 obr./min"],
    suffix: ["Gen4", "Gen5", "z radiatorem", "Żółta seria"],
    price: [129, 2499],
    description: "Pojemny i szybki nośnik danych. Szyfrowanie sprzętowe i niskie zużycie energii.",
  },
};
const TYPES = Object.keys(CATALOGUE);
const CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

const START = Date.UTC(2024, 0, 1);
const END = Date.UTC(2026, 9, 1);

const usedCodes = new Set();
function uniqueCode() {
  for (;;) {
    let code = "";
    for (let i = 0; i < 10; i++) code += CODE_ALPHABET[int(0, CODE_ALPHABET.length - 1)];
    if (!usedCodes.has(code)) {
      usedCodes.add(code);
      return code;
    }
  }
}

const products = [];
for (let id = 1; id <= COUNT; id++) {
  // Round-robin category guarantees every category is present.
  const type = TYPES[(id - 1) % TYPES.length];
  const spec = CATALOGUE[type];
  const baseName = `${pick(spec.prefix)} ${pick(spec.models)} ${pick(spec.suffix)}`;
  // Mixed letter case: most names as written, some fully upper or lower case.
  const casing = pick(["as-is", "as-is", "as-is", "upper", "lower"]);
  const name =
    casing === "upper" ? baseName.toUpperCase() : casing === "lower" ? baseName.toLowerCase() : baseName;
  const zloty = int(spec.price[0], spec.price[1]);
  products.push({
    id,
    code: uniqueCode(),
    name,
    type,
    price: zloty * 100 + pick([0, 0, 49, 99]),
    // Roughly every fifth product is out of stock.
    amount: random() < 0.2 ? 0 : int(1, 60),
    description: spec.description,
    date: new Date(START + Math.floor(random() * (END - START))).toISOString(),
    image: `/images/products/${type}.webp`,
  });
}

// Guaranteed edge cases (deterministic, independent of random draws):
// two identical names with different ids (both disks: indexes 11 and 43 share the category),
products[43].name = products[11].name;
// a RAM name written in decomposed Unicode (NFD) — equal to its NFC form after normalisation,
products[22].name = "Pamięć RAM DDR5 32 GB Łączona para";
// and at least one product out of stock in every category.
for (let i = 0; i < TYPES.length; i++) products[i + 4].amount = 0;

const missing = TYPES.filter((type) => !products.some((product) => product.type === type));
if (missing.length > 0) throw new Error(`Missing categories: ${missing.join(", ")}`);

const outFile = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "products.json");
mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, `${JSON.stringify(products, null, 2)}\n`, "utf8");
console.log(`Wrote ${products.length} products (seed ${seed}) to ${outFile}`);
