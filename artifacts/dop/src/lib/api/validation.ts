import { RepositoryOverviewCommitSchema } from '@workspace/api-zod';
import { Card, RepositoryOverview } from './types';

export class ApiValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiValidationError';
  }
}

/**
 * Validates provider data at the API boundary without changing its shape.
 * In particular, a multi-repository card may not silently reuse `commits`.
 */
export function validateCard(card: Card): Card {
  const result = RepositoryOverviewCommitSchema.safeParse(card.repositoryOverview);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'repositoryOverview'}: ${issue.message}`)
      .join('; ');
    throw new ApiValidationError(`Invalid commit attribution for card ${card.id}: ${details}`);
  }
  return card;
}

/**
 * Returns the exact count for one repository, or null when the provider
 * explicitly marked attribution unavailable. It intentionally never falls
 * back to a card-level total for multi-repository cards.
 */
export function getCommitCountForRepository(
  overview: RepositoryOverview,
  repoName: string,
): number | null {
  if (overview.commitsByRepoStatus === 'unavailable') return null;

  if (overview.repos.length > 1) {
    const attributedCount = overview.commitsByRepo?.[repoName];
    return typeof attributedCount === 'number' ? attributedCount : null;
  }

  const attributedCount = overview.commitsByRepo?.[repoName];
  if (typeof attributedCount === 'number') return attributedCount;
  return typeof overview.commits === 'number' ? overview.commits : null;
}