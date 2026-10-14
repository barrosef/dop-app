import { useMemo, useState } from 'react';
import { Cable, KeyRound } from 'lucide-react';
import {
  getListProvidersQueryKey,
  getListResourcesQueryKey,
  useListProviders,
  useListResources,
  type ProviderSummary,
  type ResourceSummary,
} from '@workspace/api-client-react';

import { Button } from '@/components/ui/button';
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
import { ProviderLogo } from './provider-logo';
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
  // Set when the panel opens to replace the token of a connection already made.
  const [selectedResource, setSelectedResource] = useState<ResourceSummary | null>(null);
  const [open, setOpen] = useState(false);

  const tiles = useMemo(
    () => (providers.data ?? []).filter((p) => p.category === category),
    [providers.data, category],
  );
  const existing = useMemo(
    () => (resources.data ?? []).filter((r) => configString(r, 'category') === category),
    [resources.data, category],
  );
  const providerOf = (key: string) => (providers.data ?? []).find((p) => p.key === key);

  function openForProvider(p: ProviderSummary) {
    setSelected(p);
    setSelectedResource(null);
    setOpen(true);
  }

  // A connection whose provider left the catalogue still gets the panel: the
  // token can be replaced with what the resource itself knows.
  function openForResource(r: ResourceSummary) {
    const key = configString(r, 'provider');
    setSelected(providerOf(key) ?? { key, category, name: key });
    setSelectedResource(r);
    setOpen(true);
  }

  return (
    <div className="space-y-8">
      {existing.length > 0 || resources.isLoading || resources.error ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-foreground">
            {t('welcome.connections.existing')}
            <span className="ml-2 tabular-nums text-muted-foreground">{existing.length}</span>
          </h2>
          {resources.isLoading ? (
            <Skeleton className="h-16 w-full rounded-lg" />
          ) : resources.error ? (
            <ApiErrorNotice error={resources.error} onRetry={() => void resources.refetch()} />
          ) : (
            <ul className="overflow-hidden rounded-lg border border-border" data-testid="list-connections">
              {existing.map((r) => {
                const provider = providerOf(configString(r, 'provider'));
                return (
                  <li
                    key={r.id}
                    className="flex flex-col gap-3 border-b border-border bg-card px-4 py-3 last:border-b-0 sm:flex-row sm:items-center"
                  >
                    <ProviderLogo
                      provider={provider ?? { key: configString(r, 'provider'), name: r.name }}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{r.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {provider?.name ?? configString(r, 'provider')}
                        {configString(r, 'base_url') ? ` · ${configString(r, 'base_url')}` : ''}
                        {r.credential_ref ? '' : ` · ${t('welcome.connections.noCredential')}`}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                      <CheckConnection resourceId={r.id} compact />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openForResource(r)}
                        data-testid={`button-replace-${r.id}`}
                      >
                        <KeyRound />
                        {t('welcome.sheet.replaceToken')}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-foreground">
          {existing.length > 0 ? t('welcome.connections.addAnother') : t('welcome.connections.catalogue')}
        </h2>
        {providers.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : providers.error ? (
          <ApiErrorNotice error={providers.error} onRetry={() => void providers.refetch()} />
        ) : tiles.length === 0 ? (
          <Empty className="rounded-lg border border-dashed border-border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Cable />
              </EmptyMedia>
              <EmptyTitle>{t('welcome.connections.noProviders.title')}</EmptyTitle>
              <EmptyDescription>{t('welcome.connections.noProviders.body')}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {tiles.map((p) => (
              <ProviderTile
                key={p.key}
                provider={p}
                connections={existing.filter((r) => configString(r, 'provider') === p.key).length}
                onSelect={() => openForProvider(p)}
              />
            ))}
          </div>
        )}
      </section>

      {children(existing.length)}

      <ProviderSheet
        provider={selected}
        resource={selectedResource}
        category={category}
        open={open}
        onOpenChange={setOpen}
      />
    </div>
  );
}
