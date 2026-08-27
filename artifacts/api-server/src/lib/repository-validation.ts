import { RepositoryOverviewCommitSchema } from "@workspace/api-zod";

/**
 * API-facing validation for provider repository metrics. Keep this at the
 * server boundary so future card providers cannot emit an ambiguous
 * multi-repository commit total.
 */
export function validateRepositoryCommitAttribution(payload: unknown) {
  return RepositoryOverviewCommitSchema.parse(payload);
}