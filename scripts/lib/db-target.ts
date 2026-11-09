// Describes a PostgreSQL connection string without its password (Lab 10: "check the connection
// target before migrate/seed without revealing the password").

export interface DbTarget {
  user: string;
  host: string;
  port: string;
  database: string;
  sslmode: string;
  pooled: boolean;
  local: boolean;
}

export function describeTarget(connectionString: string): DbTarget {
  const url = new URL(connectionString);
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new Error("Not a postgresql:// connection string.");
  }
  const host = url.hostname;
  return {
    user: decodeURIComponent(url.username),
    host,
    port: url.port || "5432",
    database: decodeURIComponent(url.pathname.slice(1)),
    sslmode: url.searchParams.get("sslmode") ?? "(none)",
    // Neon marks pooled (PgBouncer) endpoints with "-pooler" in the host name.
    pooled: host.includes("-pooler") || url.searchParams.get("pgbouncer") === "true",
    local: ["localhost", "127.0.0.1", "::1", "[::1]"].includes(host),
  };
}

/** One line, safe for a terminal, a CI log or a screenshot. */
export function formatTarget(target: DbTarget): string {
  return (
    `${target.user}@${target.host}:${target.port}/${target.database} ` +
    `sslmode=${target.sslmode} ${target.pooled ? "pooled" : "direct"} ${target.local ? "LOCAL" : "REMOTE"}`
  );
}
