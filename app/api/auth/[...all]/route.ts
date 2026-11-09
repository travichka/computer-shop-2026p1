import { auth } from '@/lib/auth';
import { toNextJsHandler } from 'better-auth/next-js';

// Better Auth uses PrismaPg + pg (TCP sockets) — Node.js runtime only, never Edge.
export const runtime = 'nodejs';

export const { GET, POST } = toNextJsHandler(auth);
