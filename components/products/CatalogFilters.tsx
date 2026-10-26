import Form from "next/form";
import Link from "next/link";
import { CATALOG_TYPES, type CatalogSettings } from "@/lib/products/catalog-params";
import { SORT_LABELS, STOCK_LABELS, TYPE_LABELS } from "@/lib/products/labels";
import { PRODUCT_SORTS, STOCK_FILTERS } from "@/lib/products/types";

// Tailwind CSS 4 utilities (extension); tokens such as bg-paper are defined in app/globals.css.
const LABEL = "flex flex-col gap-1 text-sm font-bold";
const CONTROL =
  "rounded border-2 border-[#181817] bg-white px-2 py-1 font-[inherit] text-[#181817] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus";

/**
 * GET form (server component). Submitting builds ?type=…&stock=…&sort=… from all three controls,
 * so changing one filter keeps the others. next/form navigates on the client and pushes a history
 * entry, so Back/Forward return to earlier settings. The key remounts the uncontrolled selects
 * whenever the URL changes (e.g. after Back), so the controls always match the address.
 */
export default function CatalogFilters({ settings }: { settings: CatalogSettings }) {
  return (
    <Form
      action="/product-list"
      key={`${settings.type}|${settings.stock}|${settings.sort}`}
      className="mb-4 flex flex-wrap items-end gap-x-4 gap-y-3 rounded-lg bg-paper p-4 text-ink"
      aria-label="Filtry katalogu"
    >
      <label className={LABEL}>
        Kategoria
        <select name="type" defaultValue={settings.type} className={CONTROL}>
          {CATALOG_TYPES.map((value) => (
            <option key={value} value={value}>
              {TYPE_LABELS[value]}
            </option>
          ))}
        </select>
      </label>
      <label className={LABEL}>
        Dostępność
        <select name="stock" defaultValue={settings.stock} className={CONTROL}>
          {STOCK_FILTERS.map((value) => (
            <option key={value} value={value}>
              {STOCK_LABELS[value]}
            </option>
          ))}
        </select>
      </label>
      <label className={LABEL}>
        Sortowanie
        <select name="sort" defaultValue={settings.sort} className={CONTROL}>
          {PRODUCT_SORTS.map((value) => (
            <option key={value} value={value}>
              {SORT_LABELS[value]}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-center gap-4">
        <button type="submit" className={`${CONTROL} bg-control font-bold`}>
          Zastosuj
        </button>
        <Link
          href="/product-list"
          className="text-ink focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          Wyczyść filtry
        </Link>
      </div>
    </Form>
  );
}
