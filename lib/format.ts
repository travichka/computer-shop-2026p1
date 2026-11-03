const priceFormat = new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" });

const HUNDRED = BigInt(100);

/**
 * Formats an integer amount of grosze as złoty, e.g. 129999 → "1299,99 zł". A bigint (cart and
 * order totals) is passed to Intl as an exact decimal string, so no precision is lost beyond 2^53.
 */
export function formatPrice(grosze: number | bigint): string {
  if (typeof grosze === "number") return priceFormat.format(grosze / 100);
  const sign = grosze < 0 ? "-" : "";
  const abs = grosze < 0 ? -grosze : grosze;
  return priceFormat.format(`${sign}${abs / HUNDRED}.${String(abs % HUNDRED).padStart(2, "0")}` as `${number}`);
}

// Dates are stored in UTC; formatting in UTC keeps server HTML independent of the server's time zone.
const dateFormat = new Intl.DateTimeFormat("pl-PL", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" });

/** Formats a contract date, e.g. "2026-10-01T10:00:00.000Z" → "1 października 2026 10:00". */
export function formatDate(iso: string): string {
  return `${dateFormat.format(new Date(iso))} UTC`;
}
