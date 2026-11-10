// Response time and pool usage under concurrent requests (Lab 10, extension "Pomiar wydajności").
//   npm run perf -- http://localhost:3000 [--requests 200] [--concurrency 1,10,50]
// Run it against a test database only (e.g. `next start` with the local or a separate test DB),
// never to load the shared Production database. While requests run, pg_stat_activity of the
// database in MONITOR_DATABASE_URL (default DATABASE_URL) is sampled every 25 ms and the
// connections of the app (application_name = "computer-shop") are counted.
// The first request of every path is reported separately (cold: fresh process, empty pool,
// not yet compiled code paths) from the following rounds (warm).
import { config } from "dotenv";
import pg from "pg";
import { APP_CONNECTION_NAME } from "@/lib/prisma-client";
import { describeTarget, formatTarget } from "./lib/db-target";

config({ quiet: true });

const args = process.argv.slice(2);
function option(name: string, fallback: string): string {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}
const base = new URL(args.find((arg) => /^https?:\/\//.test(arg)) ?? "http://localhost:3000").origin;
const requests = Number(option("requests", "200"));
const levels = option("concurrency", "1,10,50").split(",").map(Number);
const PATHS = ["/api/products?sort=name", "/api/products?type=gpu&stock=available&sort=newest", "/product-list/1"];

const monitorUrl = process.env.MONITOR_DATABASE_URL ?? process.env.DATABASE_URL;

interface PoolSample {
  total: number;
  active: number;
}

async function startMonitor() {
  if (!monitorUrl) return null;
  const client = new pg.Client({ connectionString: monitorUrl, application_name: "perf-monitor" });
  await client.connect();
  const limits = await client.query<{ max: string }>(`SELECT current_setting('max_connections') AS max`);
  const samples: PoolSample[] = [];
  let running = true;
  const loop = (async () => {
    while (running) {
      const { rows } = await client.query<{ total: string; active: string }>(
        `SELECT count(*) AS total, count(*) FILTER (WHERE state = 'active') AS active
         FROM pg_stat_activity WHERE application_name = $1`,
        [APP_CONNECTION_NAME],
      );
      samples.push({ total: Number(rows[0].total), active: Number(rows[0].active) });
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  })();
  return {
    maxConnections: Number(limits.rows[0].max),
    snapshot: () => samples.splice(0),
    stop: async () => {
      running = false;
      await loop;
      await client.end();
    },
  };
}

async function timed(path: string): Promise<{ ms: number; status: number }> {
  const started = performance.now();
  const response = await fetch(new URL(path, base));
  await response.arrayBuffer();
  return { ms: performance.now() - started, status: response.status };
}

function percentile(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

async function round(concurrency: number) {
  const latencies: number[] = [];
  let errors = 0;
  let next = 0;
  const started = performance.now();
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (next < requests) {
        const path = PATHS[next++ % PATHS.length];
        const { ms, status } = await timed(path);
        latencies.push(ms);
        if (status !== 200) errors++;
      }
    }),
  );
  const seconds = (performance.now() - started) / 1000;
  latencies.sort((a, b) => a - b);
  return {
    p50: percentile(latencies, 50),
    p95: percentile(latencies, 95),
    max: latencies[latencies.length - 1],
    rps: requests / seconds,
    errors,
  };
}

const monitor = await startMonitor();
console.log(`Performance test of ${base} — ${new Date().toISOString()}, Node ${process.version}`);
if (monitorUrl) console.log(`Pool monitor: ${formatTarget(describeTarget(monitorUrl))}, max_connections=${monitor?.maxConnections}`);
console.log(`Paths (round-robin): ${PATHS.join(", ")}; ${requests} requests per round\n`);

console.log("First request of each path (cold):");
for (const path of PATHS) {
  const { ms, status } = await timed(path);
  console.log(`  ${path.padEnd(52)} ${ms.toFixed(1).padStart(8)} ms  HTTP ${status}`);
}
monitor?.snapshot();

console.log("\n| concurrency | p50 ms | p95 ms | max ms | req/s | errors | app conns max | active max |");
console.log("|---:|---:|---:|---:|---:|---:|---:|---:|");
for (const concurrency of levels) {
  const result = await round(concurrency);
  const samples = monitor?.snapshot() ?? [];
  const conns = samples.length ? Math.max(...samples.map((sample) => sample.total)) : NaN;
  const active = samples.length ? Math.max(...samples.map((sample) => sample.active)) : NaN;
  console.log(
    `| ${concurrency} | ${result.p50.toFixed(1)} | ${result.p95.toFixed(1)} | ${result.max.toFixed(1)} | ` +
      `${result.rps.toFixed(0)} | ${result.errors} | ${conns} | ${active} |`,
  );
}
await monitor?.stop();
