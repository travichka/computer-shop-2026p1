import { parseProductCriteria } from "@/lib/products/criteria";
import { productRepository } from "@/lib/products/repository";

// The repository uses PrismaPg + pg (TCP sockets) — Node.js runtime only, never Edge.
export const runtime = "nodejs";

/**
 * GET /api/products?type=all|cpu|gpu|ram|disk&stock=all|available|unavailable&sort=name|newest
 * 200 → Product[] (possibly []), 400 → invalid parameters, 500 → repository failure.
 * Uses the same repository as the catalog page; the page never calls this endpoint over HTTP.
 */
export async function GET(request: Request) {
  const parsed = parseProductCriteria(new URL(request.url).searchParams);
  if (!parsed.ok) {
    return Response.json({ error: "Invalid query parameters", details: parsed.errors }, { status: 400 });
  }

  try {
    return Response.json(await productRepository.getProducts(parsed.criteria));
  } catch (error) {
    console.error("GET /api/products failed", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
