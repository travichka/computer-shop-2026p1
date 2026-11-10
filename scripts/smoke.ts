// Automated part of the deployment acceptance test (Lab 10, chapter 7) against a running app:
//   npm run smoke -- https://computer-shop-2026p1.vercel.app
//   npm run smoke -- http://localhost:3000
// Read-only and anonymous: no cookies, no tokens, no writes. It covers the public catalog, 404s,
// images, protected pages without a session, and the OAuth configuration of the deployment
// (callback on the same stable domain, foreign origins refused) — the part that typically breaks
// after moving the app to the cloud. Signed-in cart scenarios with two GitHub accounts stay manual.
import { formatPrice } from "@/lib/format";
import { queryProducts } from "@/lib/products/query";
import { PRODUCT_TYPES, type Product, type ProductCriteria } from "@/lib/products/types";

//   npm run smoke -- <url> --expect-sha <commit>   also checks that exactly this commit is deployed
const args = process.argv.slice(2);
const shaFlag = args.indexOf("--expect-sha");
const expectedSha = shaFlag >= 0 ? args[shaFlag + 1] : process.env.SMOKE_EXPECT_SHA;
const positional = args.filter((arg, index) => !arg.startsWith("--") && !(shaFlag >= 0 && index === shaFlag + 1));
const base = new URL(positional[0] ?? process.env.SMOKE_URL ?? "http://localhost:3000").origin;
const results: { name: string; ok: boolean; detail: string; ms: number }[] = [];

async function check(name: string, run: () => Promise<string>) {
  const started = performance.now();
  try {
    const detail = await run();
    results.push({ name, ok: true, detail, ms: performance.now() - started });
  } catch (error) {
    results.push({ name, ok: false, detail: (error as Error).message, ms: performance.now() - started });
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function get(path: string, init: RequestInit = {}) {
  return fetch(new URL(path, base), { redirect: "manual", ...init });
}

async function html(path: string, expectedStatus: number) {
  const response = await get(path);
  assert(response.status === expectedStatus, `${path}: HTTP ${response.status}, expected ${expectedStatus}`);
  return response.text();
}

/** Server text must never contain driver/ORM details or connection strings. */
function assertNoLeak(text: string, where: string) {
  const leak = /(postgres(ql)?:\/\/|PrismaClient|ECONNREFUSED|at Object\.|SELECT .* FROM)/i.exec(text);
  assert(!leak, `${where} leaks server details: "${leak?.[0]}"`);
}

let all: Product[] = [];

await check("deployed version", async () => {
  const response = await get("/api/version");
  assert(response.status === 200, `HTTP ${response.status}`);
  const version = (await response.json()) as { commit: string; environment: string; region: string; node: string };
  assert(version.node.startsWith("v24."), `Node.js ${version.node}, expected 24.x`);
  if (expectedSha) {
    assert(version.commit === expectedSha, `commit ${version.commit}, expected ${expectedSha}`);
  }
  return `${version.commit.slice(0, 12)} ${version.environment} ${version.region} node ${version.node}`;
});

await check("home page", async () => {
  const body = await html("/", 200);
  assertNoLeak(body, "/");
  return "200";
});

await check("catalog API: 100 products, prices in grosze", async () => {
  const response = await get("/api/products");
  assert(response.status === 200, `HTTP ${response.status}`);
  all = (await response.json()) as Product[];
  assert(all.length === 100, `${all.length} products, expected 100`);
  assert(new Set(all.map((product) => product.id)).size === 100, "duplicate product ids");
  assert(new Set(all.map((product) => product.code)).size === 100, "duplicate product codes (catalog duplicated?)");
  assert(all.every((product) => Number.isInteger(product.price) && product.price >= 0), "price is not whole grosze");
  assert(new Set(all.map((product) => product.type)).size === 4, "expected 4 categories");
  return `${all.length} products, 4 categories`;
});

const CASES: ProductCriteria[] = [
  { sort: "name" },
  { sort: "newest" },
  { type: "gpu", stock: "available", sort: "name" },
  { type: "disk", stock: "unavailable", sort: "newest" },
  ...PRODUCT_TYPES.map((type) => ({ type, sort: "name" as const })),
];

await check("filters and sorting equal the Lab 06 reference", async () => {
  assert(all.length === 100, "catalog not loaded");
  for (const criteria of CASES) {
    const query = new URLSearchParams(Object.entries(criteria) as [string, string][]);
    const response = await get(`/api/products?${query}`);
    assert(response.status === 200, `?${query}: HTTP ${response.status}`);
    const got = ((await response.json()) as Product[]).map((product) => product.id);
    const expected = queryProducts(all, criteria).map((product) => product.id);
    assert(JSON.stringify(got) === JSON.stringify(expected), `?${query}: order/content differs from reference`);
  }
  return `${CASES.length} combinations`;
});

await check("invalid filter → 400 without details of the server", async () => {
  const response = await get("/api/products?type=bogus&sort=price");
  assert(response.status === 400, `HTTP ${response.status}`);
  assertNoLeak(await response.text(), "400 body");
  return "400";
});

await check("product details and price in złoty", async () => {
  const product = all.find((item) => item.id === 1) ?? all[0];
  assert(product, "no product");
  const body = await html(`/product-list/${product.id}`, 200);
  const name = product.name.replaceAll("&", "&amp;");
  assert(body.includes(name), "product name not on the page");
  const price = formatPrice(product.price);
  assert(body.includes(price), `price ${price} not on the page`);
  return `#${product.id} ${price}`;
});

await check("non-existent and invalid product id → 404 view", async () => {
  for (const id of ["999999", "abc", "0"]) {
    const body = await html(`/product-list/${id}`, 404);
    assert(body.includes("Nie znaleziono produktu"), `/product-list/${id}: no own 404 view`);
  }
  return "999999, abc, 0";
});

await check("product images are served", async () => {
  const images = [...new Set(all.map((product) => product.image))];
  for (const image of images) {
    const response = await get(image);
    assert(response.status === 200, `${image}: HTTP ${response.status}`);
    assert(response.headers.get("content-type")?.startsWith("image/"), `${image}: not an image`);
  }
  return `${images.length} files`;
});

await check("unknown URL → own 404 view with a way back", async () => {
  const body = await html("/this-page-does-not-exist-lab10", 404);
  assert(body.includes("Nie znaleziono strony") && body.includes('href="/"'), "no own 404 view");
  return "404";
});

await check("basket and order history without a session", async () => {
  const basket = await html("/basket", 200);
  assert(basket.includes("Koszyk jest dostępny po zalogowaniu"), "basket does not ask to sign in");
  const history = await html("/order-history", 200);
  assert(history.includes("dostępna po zalogowaniu"), "order history does not ask to sign in");
  return "sign-in prompt, no data";
});

await check("no session without a cookie; a fake cookie is ignored", async () => {
  const anonymous = await get("/api/auth/get-session");
  assert(anonymous.status === 200, `HTTP ${anonymous.status}`);
  assert((await anonymous.text()).trim() === "null", "session returned without a cookie");
  const forged = await get("/api/auth/get-session", {
    headers: { cookie: "better-auth.session_token=forged.value; __Secure-better-auth.session_token=forged.value" },
  });
  assert((await forged.text()).trim() === "null", "forged cookie accepted");
  return "null, null";
});

await check("GitHub OAuth starts with a callback on this stable domain", async () => {
  const response = await get("/api/auth/sign-in/social", {
    method: "POST",
    headers: { "content-type": "application/json", origin: base },
    body: JSON.stringify({ provider: "github", callbackURL: "/basket" }),
  });
  assert(response.status === 200, `HTTP ${response.status}`);
  const { url } = (await response.json()) as { url?: string };
  assert(url, "no authorization URL");
  const authorize = new URL(url);
  assert(authorize.origin === "https://github.com", `goes to ${authorize.origin}`);
  const redirect = authorize.searchParams.get("redirect_uri");
  assert(redirect === `${base}/api/auth/callback/github`, `redirect_uri=${redirect} (BETTER_AUTH_URL wrong?)`);
  assert(authorize.searchParams.get("client_id"), "client_id missing");
  assert(!authorize.searchParams.get("scope")?.includes("repo"), "asks for repository access");
  assert(base.startsWith("https://") || base.startsWith("http://localhost"), "not HTTPS");
  return `redirect_uri=${redirect}`;
});

await check("redirect to a foreign domain after login is refused", async () => {
  const response = await get("/api/auth/sign-in/social", {
    method: "POST",
    headers: { "content-type": "application/json", origin: base },
    body: JSON.stringify({ provider: "github", callbackURL: "https://attacker.example/steal" }),
  });
  assert(response.status === 403, `HTTP ${response.status}, expected 403`);
  return "403 INVALID_CALLBACK_URL";
});

await check("cookie request from a foreign origin is refused (CSRF)", async () => {
  const response = await get("/api/auth/sign-out", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://attacker.example", cookie: "better-auth.session_token=x" },
    body: "{}",
  });
  assert(response.status === 403, `HTTP ${response.status}, expected 403`);
  return "403 INVALID_ORIGIN";
});

await check("OAuth callback with a forged state does not log in", async () => {
  const response = await get("/api/auth/callback/github?code=fake&state=forged");
  assert(response.status >= 300 && response.status < 500, `HTTP ${response.status}`);
  assert(!(response.headers.get("set-cookie") ?? "").includes("session_token=") ||
    (response.headers.get("set-cookie") ?? "").includes("session_token=;"), "session cookie issued");
  return `HTTP ${response.status}`;
});

const width = Math.max(...results.map((result) => result.name.length));
console.log(`Smoke test of ${base} — ${new Date().toISOString()}`);
for (const result of results) {
  console.log(`${result.ok ? "PASS" : "FAIL"}  ${result.name.padEnd(width)}  ${result.ms.toFixed(0).padStart(5)} ms  ${result.detail}`);
}
const failed = results.filter((result) => !result.ok).length;
console.log(failed ? `${failed} of ${results.length} checks FAILED` : `All ${results.length} checks passed`);
process.exitCode = failed ? 1 : 0;
