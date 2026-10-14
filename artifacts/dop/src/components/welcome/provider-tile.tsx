import { Check } from 'lucide-react';
import type { ProviderSummary } from '@workspace/api-client-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { providerInitials } from '@/lib/platform/welcome';

/** A provider's mark: initials on the API's `brand_color` — no logo files. */
export function ProviderMark({ provider, size = 'md' }: { provider: ProviderSummary; size?: 'md' | 'lg' }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center rounded-md border border-border font-mono font-semibold text-primary-foreground',
        size === 'lg' ? 'h-11 w-11 text-sm' : 'h-9 w-9 text-xs',
        !provider.brand_color && 'bg-muted text-foreground',
      )}
      style={provider.brand_color ? { backgroundColor: provider.brand_color } : undefined}
    >
      {providerInitials(provider.name)}
    </span>
  );
}

export function OperatedBadge({ operated }: { operated?: boolean }) {
  const t = useI18n((s) => s.t);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-[11px]',
        operated ? 'text-foreground' : 'text-muted-foreground',
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          operated ? 'bg-primary' : 'border border-muted-foreground/60',
        )}
        aria-hidden="true"
      />
      {operated ? t('welcome.provider.operated') : t('welcome.provider.registered')}
    </span>
  );
}

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
    <Button
      variant="outline"
      onClick={onSelect}
      data-testid={`tile-provider-${provider.key}`}
      className={cn(
        'group h-auto w-full justify-start gap-3 whitespace-normal p-3.5 text-left transition-colors hover:bg-muted/50',
        connections > 0 && 'border-primary/60',
        !provider.operated && 'opacity-90',
      )}
    >
      <ProviderMark provider={provider} />
      <span className="min-w-0 flex-1 space-y-1">
        <span className="block truncate text-sm font-medium text-foreground">{provider.name}</span>
        <OperatedBadge operated={provider.operated} />
      </span>
      {connections > 0 ? (
        <span className="flex items-center gap-1 font-mono text-[11px] tabular-nums text-primary">
          <Check className="h-3.5 w-3.5" />
          {connections}
        </span>
      ) : (
        <span className="text-[11px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          {t('welcome.provider.open')}
        </span>
      )}
    </Button>
  );
}
