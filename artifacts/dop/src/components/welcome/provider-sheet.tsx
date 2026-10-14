import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Copy, ExternalLink, KeyRound, Loader2, PlugZap } from 'lucide-react';
import {
  getListResourcesQueryKey,
  getOnboardingQueryKey,
  useCreateResource,
  useSetCredential,
  type ProviderSummary,
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
import { OperatedBadge, ProviderMark } from './provider-tile';

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

/**
 * The provider's method, in a side panel: credential kind, the permissions
 * the token needs (listed and copyable), the docs, the base URL when the API
 * says it is needed, the token, and *test connection*.
 *
 * Connecting = create the integration resource, then store its credential.
 * If the second call fails the resource already exists: the retry only stores
 * the credential, it never creates a second resource.
 */
export function ProviderSheet({
  provider,
  category,
  open,
  onOpenChange,
}: {
  provider: ProviderSummary | null;
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
    const partial = partials.current.get(provider.key);
    setName(partial?.name ?? provider.name);
    setBaseUrl('');
    setToken('');
    setResourceId(partial?.id ?? null);
    setConnected(false);
    setError(null);
  }, [provider]);

  function requestOpenChange(next: boolean) {
    // The panel cannot close mid-connection: the token typed belongs to it.
    if (!next && pending) return;
    onOpenChange(next);
  }

  if (!provider) return null;
  const permissions = provider.permissions ?? [];

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
        setConnected(true);
      }
    } catch (failure) {
      if (showing.current === key) setError(failure);
    } finally {
      setPending(false);
      void queryClient.invalidateQueries({
        queryKey: getListResourcesQueryKey({ kind: 'integration' }),
      });
      void queryClient.invalidateQueries({ queryKey: getOnboardingQueryKey() });
    }
  }

  return (
    <Sheet open={open} onOpenChange={requestOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md" data-testid="sheet-provider">
        <SheetHeader className="space-y-3 text-left">
          <div className="flex items-center gap-3">
            <ProviderMark provider={provider} size="lg" />
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
            <h3 className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              {t('welcome.sheet.method')}
            </h3>
            <div className="flex items-center gap-2 text-sm">
              <KeyRound className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <span className="font-mono text-foreground">
                {provider.credential_kind || t('welcome.sheet.kindUnknown')}
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
              <h3 className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                {t('welcome.sheet.permissions')}
              </h3>
              {permissions.length > 0 ? (
                <CopyButton value={permissions.join('\n')} label={t('welcome.sheet.copyAll')} />
              ) : null}
            </div>
            {permissions.length > 0 ? (
              <ul className="divide-y divide-border border border-border">
                {permissions.map((p) => (
                  <li key={p} className="flex items-center justify-between gap-2 py-1 pl-3 pr-1">
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
              <div className="flex items-center gap-2 border-l-2 border-primary bg-primary/10 px-3 py-2 text-sm">
                <Check className="h-4 w-4 text-primary" />
                {t('welcome.sheet.connected', { name })}
              </div>
              <CheckConnection resourceId={resourceId} />
              <Button variant="outline" className="w-full" onClick={() => requestOpenChange(false)}>
                {t('welcome.sheet.close')}
              </Button>
            </section>
          ) : (
            <section className="space-y-4">
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
              {provider.needs_base_url ? (
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
                  <p className="text-[11px] text-muted-foreground">{t('welcome.sheet.baseUrlHint')}</p>
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
                  className="font-mono"
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
                {pending ? <Loader2 className="animate-spin" /> : <PlugZap />}
                {resourceId
                  ? t('welcome.sheet.retryCredential')
                  : t('welcome.sheet.connect', { name: provider.name })}
              </Button>
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
