import "server-only";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";

/**
 * Session of the current request, verified by Better Auth against the Session table (signed cookie
 * → token → row that is not expired). Call it while handling a request, never at module level.
 * null means "not signed in"; a present cookie alone proves nothing.
 */
export async function getCurrentSession() {
  return auth.api.getSession({
    headers: await headers(),
  });
}
