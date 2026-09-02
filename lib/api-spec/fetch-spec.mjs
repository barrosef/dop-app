/**
 * Downloads the BFF's (dop-api's) OpenAPI specification and writes it to
 * `openapi.json`.
 *
 * The spec is VERSIONED in this repository, not fetched at generation time.
 * Two reasons:
 *
 *  1. Generation stops depending on a server being up — `pnpm codegen` runs the
 *     same in CI, on the machine of whoever has just cloned, and on a plane.
 *  2. A contract change shows in the diff. A field that vanished from the BFF
 *     becomes a red line in the review, not a type error nobody can explain
 *     three commits later.
 *
 * The price is manual synchronisation: when the BFF changes, somebody runs this
 * script. It is the right price — it is visible, while the alternative (a
 * fetched spec) fails silently, generating a different client for every day of
 * the week.
 *
 * Usage:
 *   pnpm --filter @workspace/api-spec run fetch-spec
 *   DOP_API_URL=http://dop-api.dop-local.svc:8000 pnpm ... run fetch-spec
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";

const base = (process.env.DOP_API_URL ?? "http://127.0.0.1:8000").replace(/\/+$/, "");
const url = `${base}/openapi.json`;
const destination = path.resolve(import.meta.dirname, "openapi.json");

const response = await fetch(url);
if (!response.ok) {
  throw new Error(`Failed to download ${url}: HTTP ${response.status} ${response.statusText}`);
}

const spec = await response.json();
if (!spec?.paths || Object.keys(spec.paths).length === 0) {
  throw new Error(`The spec at ${url} has no paths — the BFF answered, but this is not the expected spec.`);
}

// A deterministic write (2 spaces, a trailing newline): without it, every
// download would produce an artificial diff.
await writeFile(destination, `${JSON.stringify(spec, null, 2)}\n`, "utf8");
console.log(
  `openapi.json updated from ${url} — ${Object.keys(spec.paths).length} paths.`,
);
