import { z } from "zod";

const commitCountSchema = z.number().int().nonnegative();

/**
 * Contract for commit metrics returned with a repository overview.
 *
 * A multi-repository overview must either contain a count for every related
 * repository or explicitly mark the metric as unavailable. The aggregate
 * `commits` value is never used as a substitute for repository attribution.
 */
export const RepositoryOverviewCommitSchema = z
  .object({
    repos: z.array(z.string().min(1)),
    commits: commitCountSchema.nullable().optional(),
    commitsByRepo: z.record(commitCountSchema).optional(),
    commitsByRepoStatus: z.enum(["available", "unavailable"]).optional(),
  })
  .superRefine((overview, context) => {
    const repos = [...new Set(overview.repos)];
    const hasAttribution = overview.commitsByRepo
      ? repos.every((repo) => Object.prototype.hasOwnProperty.call(overview.commitsByRepo, repo))
      : false;

    if (repos.length > 1) {
      if (overview.commitsByRepoStatus !== "unavailable" && !hasAttribution) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["commitsByRepo"],
          message: "Multi-repository overviews require a commit count for every repository or commitsByRepoStatus=unavailable.",
        });
      }

      if (hasAttribution && overview.commits !== undefined && overview.commits !== null) {
        const attributedTotal = repos.reduce(
          (total, repo) => total + (overview.commitsByRepo?.[repo] ?? 0),
          0,
        );
        if (overview.commits !== attributedTotal) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["commits"],
            message: "The aggregate commit total must equal the sum of repository commit totals.",
          });
        }
      }
    } else if (
      overview.commits === undefined &&
      overview.commitsByRepoStatus !== "unavailable"
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["commits"],
        message: "A single-repository overview requires a commit total or commitsByRepoStatus=unavailable.",
      });
    }
  });

export type RepositoryOverviewCommit = z.infer<typeof RepositoryOverviewCommitSchema>;