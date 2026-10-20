const priceFormat = new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" });

/** Formats an integer amount of grosze as złoty, e.g. 129999 → "1299,99 zł". */
export function formatPrice(grosze: number): string {
  return priceFormat.format(grosze / 100);
}
