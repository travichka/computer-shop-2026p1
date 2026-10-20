import { PRODUCT_TYPES, type Product, type ProductType } from "./types";

export const MAX_INT32 = 2147483647;

const PRODUCT_KEYS = [
  "id",
  "code",
  "name",
  "type",
  "price",
  "amount",
  "description",
  "date",
  "image",
] as const;

const CODE_PATTERN = /^[A-Z0-9]{10}$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})Z$/;
const IMAGE_PATTERN = /^\/images\/products\/[a-z0-9-]+\.(webp|png|jpg|jpeg|svg)$/;
const MAX_DESCRIPTION_LENGTH = 500;

export class ProductValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Invalid product data (${issues.length} issue(s)): ${issues.slice(0, 5).join("; ")}`);
    this.name = "ProductValidationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIntInRange(value: unknown, min: number, max: number): value is number {
  return Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;
}

/** Well-formed UTF-16 (no lone surrogates) and no U+0000. */
export function isSafeText(value: unknown): value is string {
  return typeof value === "string" && value.isWellFormed() && !value.includes("\u0000");
}

/**
 * Strict UTC date check: exact format, years 0001–9999, a date that really
 * exists (no 2026-02-30) and a lossless round trip through toISOString().
 */
export function isValidUtcDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  if (year < 1 || year > 9999) return false;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return false;
  return new Date(time).toISOString() === value;
}

function validateProduct(value: unknown, where: string, issues: string[]): Product | null {
  if (!isRecord(value)) {
    issues.push(`${where}: expected an object`);
    return null;
  }
  const before = issues.length;

  for (const key of Object.keys(value)) {
    if (!(PRODUCT_KEYS as readonly string[]).includes(key)) {
      issues.push(`${where}: unexpected field "${key}"`);
    }
  }

  const { id, code, name, type, price, amount, description, date, image } = value;

  if (!isIntInRange(id, 1, MAX_INT32)) issues.push(`${where}.id: integer 1..${MAX_INT32} required`);
  if (typeof code !== "string" || !CODE_PATTERN.test(code)) {
    issues.push(`${where}.code: 10 uppercase ASCII letters or digits required`);
  }
  if (!isSafeText(name) || name.trim() === "") {
    issues.push(`${where}.name: non-empty, well-formed text without U+0000 required`);
  }
  if (typeof type !== "string" || !(PRODUCT_TYPES as readonly string[]).includes(type)) {
    issues.push(`${where}.type: one of ${PRODUCT_TYPES.join(", ")} required`);
  }
  if (!isIntInRange(price, 0, MAX_INT32)) issues.push(`${where}.price: integer 0..${MAX_INT32} (grosze) required`);
  if (!isIntInRange(amount, 0, MAX_INT32)) issues.push(`${where}.amount: integer 0..${MAX_INT32} required`);
  if (!isSafeText(description) || description.length > MAX_DESCRIPTION_LENGTH) {
    issues.push(`${where}.description: well-formed text up to ${MAX_DESCRIPTION_LENGTH} characters required`);
  }
  if (!isValidUtcDate(date)) issues.push(`${where}.date: existing UTC date YYYY-MM-DDTHH:mm:ss.sssZ required`);
  if (typeof image !== "string" || !IMAGE_PATTERN.test(image)) {
    issues.push(`${where}.image: local URL under /images/products/ required`);
  }

  if (issues.length !== before) return null;
  return {
    id: id as number,
    code: code as string,
    name: name as string,
    type: type as ProductType,
    price: price as number,
    amount: amount as number,
    description: description as string,
    date: date as string,
    image: image as string,
  };
}

/**
 * Validates untrusted data (e.g. parsed JSON) against the product contract.
 * Returns fresh, frozen objects; throws ProductValidationError listing every issue.
 */
export function validateProducts(data: unknown): readonly Product[] {
  if (!Array.isArray(data)) throw new ProductValidationError(["root: expected an array of products"]);

  const issues: string[] = [];
  const products: Product[] = [];
  const ids = new Set<number>();
  const codes = new Set<string>();

  data.forEach((item, index) => {
    const product = validateProduct(item, `[${index}]`, issues);
    if (!product) return;
    if (ids.has(product.id)) issues.push(`[${index}].id: duplicate id ${product.id}`);
    if (codes.has(product.code)) issues.push(`[${index}].code: duplicate code ${product.code}`);
    ids.add(product.id);
    codes.add(product.code);
    products.push(Object.freeze(product));
  });

  if (issues.length > 0) throw new ProductValidationError(issues);
  return Object.freeze(products);
}
