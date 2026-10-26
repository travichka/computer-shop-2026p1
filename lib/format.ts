const priceFormat = new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" });

/** Formats an integer amount of grosze as złoty, e.g. 129999 → "1299,99 zł". */
export function formatPrice(grosze: number): string {
  return priceFormat.format(grosze / 100);
}

// Dates are stored in UTC; formatting in UTC keeps server HTML independent of the server's time zone.
const dateFormat = new Intl.DateTimeFormat("pl-PL", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" });

/** Formats a contract date, e.g. "2026-10-01T10:00:00.000Z" → "1 października 2026 10:00". */
export function formatDate(iso: string): string {
  return `${dateFormat.format(new Date(iso))} UTC`;
}
