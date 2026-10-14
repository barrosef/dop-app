import { useMemo, useState } from 'react';
import { Cable } from 'lucide-react';
import {
  getListProvidersQueryKey,
  getListResourcesQueryKey,
  useListProviders,
  useListResources,
  type ProviderSummary,
  type ResourceSummary,
} from '@workspace/api-client-react';

import { Skeleton } from '@/components/ui/skeleton';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { useI18n } from '@/lib/i18n';
import { useAccount } from '@/lib/platform/account';
import { ApiErrorNotice } from './api-error';
import { CheckConnection } from './check-connection';
import { ProviderSheet } from './provider-sheet';
import { ProviderTile } from './provider-tile';

function configString(resource: ResourceSummary, key: string): string {
  const value = resource.config?.[key];
  return typeof value === 'string' ? value : '';
}

/**
 * Tiles of one catalogue category, what already exists in that category, and
 * the side panel. Shared by `/welcome/code` (git) and `/welcome/tasks`.
 * Returns the count of existing connections to the caller through render.
 */
export function ConnectionStep({
  category,
  children,
}: {
  category: string;
  children: (connections: number) => React.ReactNode;
}) {
  const t = useI18n((s) => s.t);
  const { activeAccount } = useAccount();
  const providers = useListProviders({
    query: { queryKey: getListProvidersQueryKey(), enabled: Boolean(activeAccount) },
  });
  const resources = useListResources(
    { kind: 'integration' },
    {
      query: {
        queryKey: getListResourcesQueryKey({ kind: 'integration' }),
        enabled: Boolean(activeAccount),
      },
    },
  );
  const [selected, setSelected] = useState<ProviderSummary | null>(null);
  const [open, setOpen] = useState(false);

  const tiles = useMemo(
    () => (providers.data ?? []).filter((p) => p.category === category),
    [providers.data, category],
  );
  const existing = useMemo(
    () => (resources.data ?? []).filter((r) => configString(r, 'category') === category),
    [resources.data, category],
  );
  const providerName = (key: string) =>
    (providers.data ?? []).find((p) => p.key === key)?.name ?? key;

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {t('welcome.connections.catalogue')}
        </h2>
        {providers.isLoading ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-[66px] w-full" />
            ))}
          </div>
        ) : providers.error ? (
          <ApiErrorNotice error={providers.error} onRetry={() => void providers.refetch()} />
        ) : tiles.length === 0 ? (
          <Empty className="border border-dashed border-border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Cable />
              </EmptyMedia>
              <EmptyTitle>{t('welcome.connections.noProviders.title')}</EmptyTitle>
              <EmptyDescription>{t('welcome.connections.noProviders.body')}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {tiles.map((p) => (
              <ProviderTile
                key={p.key}
                provider={p}
                connections={existing.filter((r) => configString(r, 'provider') === p.key).length}
                onSelect={() => {
                  setSelected(p);
                  setOpen(true);
                }}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {t('welcome.connections.existing')}
          <span className="tabular-nums text-foreground">{existing.length}</span>
        </h2>
        {resources.isLoading ? (
          <Skeleton className="h-12 w-full" />
        ) : resources.error ? (
          <ApiErrorNotice error={resources.error} onRetry={() => void resources.refetch()} />
        ) : existing.length === 0 ? (
          <p className="border border-dashed border-border px-4 py-3 text-xs text-muted-foreground">
            {t('welcome.connections.none')}
          </p>
        ) : (
          <ul className="divide-y divide-border border border-border" data-testid="list-connections">
            {existing.map((r) => (
              <li key={r.id} className="flex flex-col gap-2 border-l-2 border-l-primary px-3 py-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground">{r.name}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {providerName(configString(r, 'provider'))}
                    {configString(r, 'base_url') ? ` · ${configString(r, 'base_url')}` : ''}
                    {r.credential_ref ? '' : ` · ${t('welcome.connections.noCredential')}`}
                  </p>
                </div>
                <div className="sm:w-56">
                  <CheckConnection resourceId={r.id} compact />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {children(existing.length)}

      <ProviderSheet provider={selected} category={category} open={open} onOpenChange={setOpen} />
    </div>
  );
}
