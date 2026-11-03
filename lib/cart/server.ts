import "server-only";

import { getPrisma } from "@/lib/db";
import { getCurrentSession } from "@/lib/session";
import { createCartService } from "./cart-service";

/** Cart service of the app: owner = verified session of the current request (lib/session.ts). */
export const cartService = createCartService({ getSession: getCurrentSession, getClient: getPrisma });
