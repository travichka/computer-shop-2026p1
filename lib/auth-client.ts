import { createAuthClient } from "better-auth/react";

// Browser client of the Better Auth endpoints mounted at /api/auth (same origin, so no baseURL).
// It only starts sign-in/sign-out; views get the session from the server (lib/session.ts).
export const authClient = createAuthClient();

export const { signIn, signOut } = authClient;
