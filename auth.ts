// Config for the Better Auth CLI only (`npx --no-install auth generate --config ./auth.ts …`).
// The CLI runs outside Next.js: it loads .env itself and gets the shared provider/model settings,
// without the application's database adapter and without server-only imports. The app uses lib/auth.ts.
import "dotenv/config";
import { betterAuth } from "better-auth";
import { readAuthEnv, sharedAuthOptions } from "./lib/auth-options";

export const auth = betterAuth(sharedAuthOptions(readAuthEnv()));
