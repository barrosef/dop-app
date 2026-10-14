import { siBitbucket, siClickup, siGithub, siGitlab, siJira, type SimpleIcon } from 'simple-icons';
import type { ProviderSummary } from '@workspace/api-client-react';

import { cn } from '@/lib/utils';
import { providerInitials } from '@/lib/platform/welcome';

/**
 * Brand glyphs for the catalogue's provider keys. The catalogue is the API's;
 * this only knows how to draw the ones it has a glyph for. A key with no
 * glyph (Azure DevOps has none in simple-icons) falls back to initials.
 *
 * Glyphs render in `currentColor`, never in the brand's own colour: GitHub's
 * black mark would vanish on the dark theme, and a wall of brand colours is
 * what makes an integrations grid look like a sticker sheet.
 */
const GLYPHS: Record<string, SimpleIcon> = {
  github: siGithub,
  gitlab: siGitlab,
  gitlab_self_hosted: siGitlab,
  bitbucket: siBitbucket,
  jira: siJira,
  clickup: siClickup,
};

export function ProviderLogo({
  provider,
  size = 'md',
  className,
}: {
  provider: Pick<ProviderSummary, 'key' | 'name'>;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const glyph = GLYPHS[provider.key];
  const box = size === 'lg' ? 'h-12 w-12 rounded-xl' : size === 'sm' ? 'h-8 w-8 rounded-md' : 'h-10 w-10 rounded-lg';
  const mark = size === 'lg' ? 'h-6 w-6' : size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center bg-muted text-foreground',
        box,
        className,
      )}
    >
      {glyph ? (
        <svg viewBox="0 0 24 24" className={mark} fill="currentColor">
          <path d={glyph.path} />
        </svg>
      ) : (
        <span className="text-xs font-semibold">{providerInitials(provider.name)}</span>
      )}
    </span>
  );
}
