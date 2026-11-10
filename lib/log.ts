// Server-side error logging for the deployed app (Lab 10). A log line names the operation and the
// error class/code, so a failure can be found in the Vercel function logs, but never contains
// passwords, connection strings, cookies or OAuth tokens. The user only gets a generic message.

const REDACTIONS: ReadonlyArray<[RegExp, string]> = [
  // postgresql://user:password@host/db → postgresql://<redacted>@host/db
  [/([a-z][a-z0-9+.-]*:\/\/)[^\s/@'"]+@/gi, "$1<redacted>@"],
  [/(password|passwd|pwd|secret|token|authorization|cookie)(["']?\s*[:=]\s*["']?)[^\s,;&'"]+/gi, "$1$2<redacted>"],
  [/(better-auth\.[a-z_]+)=[^\s;]+/gi, "$1=<redacted>"],
  [/\bBearer\s+[^\s'"]+/gi, "Bearer <redacted>"],
  [/\bgh[opsu]_[A-Za-z0-9]{20,}/g, "<redacted-github-token>"],
];

/** Removes credentials from free text (error messages may quote the connection string). */
export function redact(text: string): string {
  return REDACTIONS.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), text);
}

export interface ErrorSummary {
  name: string;
  code?: string;
  message: string;
}

/** Name, driver/Prisma code and redacted message — no stack with parameters, no query values. */
export function summarizeError(error: unknown): ErrorSummary {
  if (error instanceof Error) {
    const code = (error as { code?: unknown }).code;
    return {
      name: error.name,
      ...(typeof code === "string" || typeof code === "number" ? { code: String(code) } : {}),
      message: redact(error.message).slice(0, 500),
    };
  }
  return { name: "NonError", message: redact(String(error)).slice(0, 500) };
}

/** One structured line in the function log: `[operation] failed {name, code, message}`. */
export function logServerError(operation: string, error: unknown): void {
  console.error(`[${operation}] failed`, JSON.stringify(summarizeError(error)));
}
