// Where the user may return after signing in. Only known paths of this app are accepted, so a
// form or query string cannot turn the login into an open redirect (https://evil.example, //evil).

export const RETURN_PATHS = ["/", "/product-list", "/catalog", "/basket", "/order-history", "/account"] as const;
export type ReturnPath = (typeof RETURN_PATHS)[number];

export const DEFAULT_RETURN_PATH: ReturnPath = "/basket";

/** The raw value if it is exactly one of RETURN_PATHS, otherwise the default (/basket). */
export function safeReturnPath(raw: unknown, fallback: ReturnPath = DEFAULT_RETURN_PATH): ReturnPath {
  return typeof raw === "string" && (RETURN_PATHS as readonly string[]).includes(raw) ? (raw as ReturnPath) : fallback;
}

/** Return path for the section containing `pathname` (/product-list/12 → /product-list). */
export function returnPathForSection(pathname: string): ReturnPath {
  const section = RETURN_PATHS.filter((path) => path !== "/").find(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
  return section ?? "/";
}
