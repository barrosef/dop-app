import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Copy, ExternalLink, KeyRound, Loader2, PlugZap } from 'lucide-react';
import {
  getListResourcesQueryKey,
  getOnboardingQueryKey,
  useCreateResource,
  useSetCredential,
  type ProviderSummary,
  type ResourceSummary,
} from '@workspace/api-client-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useI18n } from '@/lib/i18n';
import { toBase64 } from '@/lib/platform/welcome';
import { ApiErrorNotice } from './api-error';
import { CheckConnection } from './check-connection';
import { ProviderLogo } from './provider-logo';
import { OperatedBadge } from './provider-tile';

function CopyButton({ value, label }: { value: string; label: string }) {
  const t = useI18n((s) => s.t);
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={copy}
      aria-label={label}
      className="h-7 px-2 text-muted-foreground"
    >
      {copied ? <Check /> : <Copy />}
      <span className="text-[11px]">{copied ? t('welcome.provider.copied') : t('welcome.provider.copy')}</span>
    </Button>
  );
}

function configString(resource: ResourceSummary | null | undefined, key: string): string {
  const value = resource?.config?.[key];
  return typeof value === 'string' ? value : '';
}

/**
 * The provider's method, in a side panel: credential kind, the permissions
 * the token needs (listed and copyable), the docs, the base URL when the API
 * says it is needed, the token, and *test connection*.
 *
 * Connecting = create the integration resource, then store its credential.
 * If the second call fails the resource already exists: the retry only stores
 * the credential, it never creates a second resource.
 *
 * A token can be replaced at any time: from the connected view (the test said
 * the provider refused it) or from the list of connections made (`resource`).
 * Replacing stores a new credential on the SAME resource — the core
 * overwrites the secret under the same reference; nothing is created.
 */
export function ProviderSheet({
  provider,
  resource = null,
  category,
  open,
  onOpenChange,
}: {
  provider: ProviderSummary | null;
  /** An existing connection whose token is being replaced. */
  resource?: ResourceSummary | null;
  category: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useI18n((s) => s.t);
  const queryClient = useQueryClient();
  const createResource = useCreateResource();
  const setCredential = useSetCredential();
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [token, setToken] = useState('');
  const [resourceId, setResourceId] = useState<string | null>(null);
  // The resource already holds a credential: the form replaces it, the
  // success message says "updated" rather than "connected".
  const [hasCredential, setHasCredential] = useState(false);
  // The last store replaced a credential (not the first of this resource).
  const [replaced, setReplaced] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  // A resource created whose credential failed to store, per provider: coming
  // back to that provider retries the credential instead of creating twice.
  const partials = useRef(new Map<string, { id: string; name: string }>());
  // Which provider the panel is showing NOW; an answer for another is stale.
  const showing = useRef<string | null>(null);

  useEffect(() => {
    showing.current = provider?.key ?? null;
    if (!provider) return;
    setToken('');
    setConnected(false);
    setReplaced(false);
    setError(null);
    if (resource) {
      setName(resource.name);
      setBaseUrl(configString(resource, 'base_url'));
      setResourceId(resource.id);
      setHasCredential(Boolean(resource.credential_ref));
      return;
    }
    const partial = partials.current.get(provider.key);
    setName(partial?.name ?? provider.name);
    setBaseUrl('');
    setResourceId(partial?.id ?? null);
    setHasCredential(false);
  }, [provider, resource]);

  function requestOpenChange(next: boolean) {
    // The panel cannot close mid-connection: the token typed belongs to it.
    if (!next && pending) return;
    onOpenChange(next);
  }

  if (!provider) return null;
  const permissions = provider.permissions ?? [];
  const replacing = Boolean(resourceId) && hasCredential;

  async function connect() {
    if (!provider || pending) return;
    const key = provider.key;
    const secret = token;
    setPending(true);
    setError(null);
    try {
      let id = resourceId;
      if (!id) {
        const config: Record<string, unknown> = { category, provider: provider.key };
        if (provider.needs_base_url && baseUrl.trim()) config.base_url = baseUrl.trim();
        const resource = await createResource.mutateAsync({
          data: { kind: 'integration', name: name.trim(), config },
        });
        id = resource.id;
        partials.current.set(key, { id, name: name.trim() });
        if (showing.current === key) setResourceId(id);
      }
      await setCredential.mutateAsync({
        resourceId: id,
        data: { secret_base64: toBase64(secret) },
      });
      partials.current.delete(key);
      if (showing.current === key) {
        setToken('');
        setReplaced(hasCredential);
        setHasCredential(true);
        setConnected(true);
      }
    } catch (failure) {
      // The token stays in the field: the person corrects it and tries again.
      if (showing.current === key) setError(failure);
    } finally {
      setPending(false);
      void queryClient.invalidateQueries({
        queryKey: getListResourcesQueryKey({ kind: 'integration' }),
      });
      void queryClient.invalidateQueries({ queryKey: getOnboardingQueryKey() });
    }
  }

  // Back to the form with the same resource: only the token is asked again.
  function replaceToken() {
    setConnected(false);
    setToken('');
    setError(null);
  }

  // Changed their mind: the stored token stays. From the list the panel just
  // closes; from the connected view it goes back there.
  function keepToken() {
    if (resource) {
      requestOpenChange(false);
      return;
    }
    setToken('');
    setError(null);
    setConnected(true);
  }

  const connectLabel = replacing
    ? t('welcome.sheet.saveNewToken')
    : resourceId
      ? t('welcome.sheet.retryCredential')
      : t('welcome.sheet.connect', { name: provider.name });

  return (
    <Sheet open={open} onOpenChange={requestOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md [--radius:0.75rem]" data-testid="sheet-provider">
        <SheetHeader className="space-y-3 text-left">
          <div className="flex items-center gap-3">
            <ProviderLogo provider={provider} size="lg" />
            <div className="min-w-0">
              <SheetTitle>{provider.name}</SheetTitle>
              <OperatedBadge operated={provider.operated} />
            </div>
          </div>
          <SheetDescription>
            {provider.operated ? t('welcome.sheet.leadOperated') : t('welcome.sheet.leadRegistered')}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <section className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">
              {t('welcome.sheet.method')}
            </h3>
            <div className="flex items-center gap-2 text-sm">
              <KeyRound className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <span className="text-foreground">
                {provider.credential_kind === 'token' ? t('welcome.sheet.kindToken') : provider.credential_kind || t('welcome.sheet.kindUnknown')}
              </span>
            </div>
            {provider.docs_url ? (
              <a
                href={provider.docs_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline"
                data-testid="link-provider-docs"
              >
                {t('welcome.sheet.docs')}
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-foreground">
                {t('welcome.sheet.permissions')}
              </h3>
              {permissions.length > 0 ? (
                <CopyButton value={permissions.join('\n')} label={t('welcome.sheet.copyAll')} />
              ) : null}
            </div>
            {permissions.length > 0 ? (
              <ul className="overflow-hidden rounded-md border border-border">
                {permissions.map((p) => (
                  <li key={p} className="flex items-center justify-between gap-2 border-b border-border py-1 pl-3 pr-1 last:border-b-0">
                    <code className="truncate font-mono text-xs text-foreground">{p}</code>
                    <CopyButton value={p} label={t('welcome.sheet.copyOne', { p })} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">{t('welcome.sheet.noPermissions')}</p>
            )}
          </section>

          <Separator />

          {connected && resourceId ? (
            <section className="space-y-4">
              <div className="flex items-center gap-2 rounded-md bg-primary/10 px-3 py-2 text-sm" data-testid="status-connected">
                <Check className="h-4 w-4 text-primary" />
                {replaced ? t('welcome.sheet.replaced', { name }) : t('welcome.sheet.connected', { name })}
              </div>
              <CheckConnection resourceId={resourceId} />
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="outline" className="flex-1" onClick={replaceToken} data-testid="button-replace-token">
                  <KeyRound />
                  {t('welcome.sheet.replaceToken')}
                </Button>
                <Button variant="ghost" className="flex-1" onClick={() => requestOpenChange(false)}>
                  {t('welcome.sheet.close')}
                </Button>
              </div>
            </section>
          ) : (
            <section className="space-y-4">
              {replacing ? (
                <p className="text-sm text-muted-foreground" data-testid="text-replace-lead">
                  {t('welcome.sheet.replaceLead')}
                </p>
              ) : null}
              <div className="space-y-1.5">
                <Label htmlFor="connection-name">{t('welcome.sheet.name')}</Label>
                <Input
                  id="connection-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={Boolean(resourceId)}
                  data-testid="input-connection-name"
                />
              </div>
              {provider.needs_base_url || (replacing && baseUrl) ? (
                <div className="space-y-1.5">
                  <Label htmlFor="connection-base-url">{t('welcome.sheet.baseUrl')}</Label>
                  <Input
                    id="connection-base-url"
                    type="url"
                    inputMode="url"
                    placeholder="https://"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    disabled={Boolean(resourceId)}
                    className="font-mono"
                    data-testid="input-connection-base-url"
                  />
                  {!resourceId ? (
                    <p className="text-[11px] text-muted-foreground">{t('welcome.sheet.baseUrlHint')}</p>
                  ) : null}
                </div>
              ) : null}
              <div className="space-y-1.5">
                <Label htmlFor="connection-token">{t('welcome.sheet.token')}</Label>
                <Input
                  id="connection-token"
                  type="password"
                  autoComplete="off"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  autoFocus={replacing}
                  data-testid="input-connection-token"
                />
                <p className="text-[11px] text-muted-foreground">{t('welcome.sheet.tokenHint')}</p>
              </div>
              {error ? <ApiErrorNotice error={error} testId="status-connect-error" /> : null}
              <Button
                className="w-full"
                onClick={connect}
                disabled={pending || !name.trim() || !token}
                data-testid="button-connect"
              >
                {pending ? <Loader2 className="animate-spin" /> : replacing ? <KeyRound /> : <PlugZap />}
                {connectLabel}
              </Button>
              {replacing ? (
                <Button variant="ghost" className="w-full" onClick={keepToken} data-testid="button-replace-cancel">
                  {t('welcome.sheet.keepToken')}
                </Button>
              ) : null}
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
