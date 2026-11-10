import { appVersion } from "@/lib/version";

// GET /api/version → commit SHA, build time, environment, region and Node.js version of this
// deployment. Public, no database, no secrets; used by the acceptance test (npm run smoke).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(appVersion(), { headers: { "cache-control": "no-store" } });
}
