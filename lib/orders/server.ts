import "server-only";

import { getPrisma } from "@/lib/db";
import { getCurrentSession } from "@/lib/session";
import { createOrderService } from "./order-service";

export const orderService = createOrderService({ getSession: getCurrentSession, getClient: getPrisma });
