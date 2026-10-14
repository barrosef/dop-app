import { ArrowRight, Check } from 'lucide-react';
import type { ProviderSummary } from '@workspace/api-client-react';

import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { ProviderLogo } from './provider-logo';

export function OperatedBadge({ operated }: { operated?: boolean }) {
  const t = useI18n((s) => s.t);
  return (
    <span className={cn('text-xs', operated ? 'text-muted-foreground' : 'text-muted-foreground/80')}>
      {operated ? t('welcome.provider.operated') : t('welcome.provider.registered')}
    </span>
  );
}

/**
 * One provider of the catalogue, as the API lists it. A tile with connections
 * already made says how many; the rest invite. `operated` is the API's word.
 */
export function ProviderTile({
  provider,
  connections,
  onSelect,
}: {
  provider: ProviderSummary;
  connections: number;
  onSelect: () => void;
}) {
  const t = useI18n((s) => s.t);
  return (
    <button
      type="button"
      onClick={onSelect}
      data-testid={`tile-provider-${provider.key}`}
      className={cn(
        'group flex w-full items-center gap-3 rounded-lg border bg-card p-3 text-left outline-none transition-colors',
        'hover:border-foreground/25 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring',
        connections > 0 ? 'border-primary/60' : 'border-border',
      )}
    >
      <ProviderLogo provider={provider} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{provider.name}</span>
        <OperatedBadge operated={provider.operated} />
      </span>
      {connections > 0 ? (
        <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium tabular-nums text-primary">
          <Check className="h-3.5 w-3.5" />
          {connections}
        </span>
      ) : (
        <ArrowRight
          className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          aria-hidden="true"
        />
      )}
      <span className="sr-only">{t('welcome.provider.open')}</span>
    </button>
  );
}
