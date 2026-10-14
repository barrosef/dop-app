import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Check, Loader2, X } from 'lucide-react';
import {
  getHandleAvailabilityQueryKey,
  getListAccountsQueryKey,
  getMeQueryKey,
  useHandleAvailability,
  useMe,
  useUpdatePersonalAccount,
  useUpdateProfile,
} from '@workspace/api-client-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { profileInitials } from '@/components/platform/profile-initials';
import { ApiErrorNotice } from '@/components/welcome/api-error';
import { StepActions, StepHeader } from '@/components/welcome/step-frame';
import { useI18n } from '@/lib/i18n';
import { useAccount } from '@/lib/platform/account';
import {
  accountPatchFrom,
  detectedLocale,
  detectedTimezone,
  profilePatchFrom,
  supportedTimezones,
} from '@/lib/platform/welcome';
import { useWelcomeStep } from '@/hooks/use-welcome-step';

const LOCALE_OPTIONS = ['pt-BR', 'en-US', 'en-GB', 'es-ES', 'pt-PT'];

function useDebounced(value: string, ms: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

export default function WelcomeProfile() {
  const t = useI18n((s) => s.t);
  const queryClient = useQueryClient();
  const { accounts, activeAccount } = useAccount();
  const personal = accounts.find((a) => a.kind === 'personal');
  const me = useMe({ query: { queryKey: getMeQueryKey(), enabled: Boolean(activeAccount) } });
  const updateProfile = useUpdateProfile();
  const updateAccount = useUpdatePersonalAccount();
  const step = useWelcomeStep('profile');

  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [locale, setLocale] = useState('');
  const [timezone, setTimezone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const initialized = useRef(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<unknown>(null);

  useEffect(() => {
    if (initialized.current || !me.data || !personal) return;
    initialized.current = true;
    setName(me.data.name ?? '');
    setHandle(personal.handle);
    setLocale(me.data.locale || detectedLocale());
    setTimezone(me.data.timezone || detectedTimezone());
    setBirthDate(me.data.birth_date ?? '');
  }, [me.data, personal]);

  const typed = handle.trim();
  const debounced = useDebounced(typed, 400);
  const isOwn = Boolean(personal) && typed === personal?.handle;
  const availability = useHandleAvailability(debounced, {
    query: {
      queryKey: getHandleAvailabilityQueryKey(debounced),
      enabled: Boolean(activeAccount) && Boolean(debounced) && debounced !== personal?.handle,
    },
  });
  const settling = typed !== debounced || availability.isFetching;
  const taken = !isOwn && !settling && availability.data?.available === false;

  const timezones = useMemo(() => {
    const all = supportedTimezones();
    return timezone && !all.includes(timezone) ? [timezone, ...all] : all;
  }, [timezone]);
  const locales = useMemo(
    () => Array.from(new Set([locale, detectedLocale(), ...LOCALE_OPTIONS].filter(Boolean))),
    [locale],
  );

  async function save() {
    if (!me.data || !personal) return;
    setSaving(true);
    setSaveError(null);
    try {
      const patch = profilePatchFrom(me.data, { name, locale, timezone, birthDate });
      if (Object.keys(patch).length) {
        const updated = await updateProfile.mutateAsync({ data: patch });
        queryClient.setQueryData(getMeQueryKey(), updated);
      }
      const accountPatch = accountPatchFrom(personal, handle, name);
      if (accountPatch) {
        await updateAccount.mutateAsync({ data: accountPatch });
        void queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
      }
    } catch (failure) {
      setSaveError(failure);
      setSaving(false);
      return;
    }
    setSaving(false);
    await step.record('done');
  }

  if (me.isLoading || !personal || (!me.data && !me.error)) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (me.error || !me.data) {
    return <ApiErrorNotice error={me.error} onRetry={() => void me.refetch()} />;
  }

  return (
    <div className="space-y-8">
      <StepHeader
        kicker={t('welcome.profile.kicker')}
        title={t('welcome.profile.title')}
        lead={t('welcome.profile.lead')}
      />

      <div className="flex items-center gap-4 border border-border p-4">
        <Avatar className="h-14 w-14 border border-border">
          {me.data.avatar_url ? <AvatarImage src={me.data.avatar_url} alt="" /> : null}
          <AvatarFallback className="font-mono text-sm">
            {profileInitials(name || me.data.name, me.data.email)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 space-y-1">
          <p className="truncate text-base font-medium text-foreground">{name || me.data.name}</p>
          <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="truncate font-mono">{me.data.email}</span>
            {me.data.email_verified ? (
              <span className="inline-flex items-center gap-1 text-primary" data-testid="badge-email-verified">
                <BadgeCheck className="h-3.5 w-3.5" />
                {t('welcome.profile.verified')}
              </span>
            ) : null}
          </p>
          <p className="text-[11px] text-muted-foreground">{t('welcome.profile.photoNote')}</p>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="profile-name">{t('welcome.profile.name')}</Label>
          <Input
            id="profile-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            data-testid="input-profile-name"
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="profile-handle">{t('welcome.profile.handle')}</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground">
              @
            </span>
            <Input
              id="profile-handle"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="pl-7 font-mono"
              aria-describedby="profile-handle-status"
              data-testid="input-profile-handle"
            />
          </div>
          <div id="profile-handle-status" aria-live="polite" className="min-h-5 text-xs">
            {!typed ? null : isOwn ? (
              <span className="inline-flex items-center gap-1 text-primary">
                <Check className="h-3.5 w-3.5" />
                {t('welcome.profile.handleOwn')}
              </span>
            ) : settling ? (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t('welcome.profile.handleChecking')}
              </span>
            ) : availability.error ? (
              <ApiErrorNotice error={availability.error} testId="status-handle-error" />
            ) : availability.data?.available ? (
              <span className="inline-flex items-center gap-1 text-primary" data-testid="text-handle-available">
                <Check className="h-3.5 w-3.5" />
                {t('welcome.profile.handleFree')}
              </span>
            ) : taken ? (
              <span className="flex flex-wrap items-center gap-2 text-destructive" data-testid="text-handle-taken">
                <X className="h-3.5 w-3.5" />
                {t('welcome.profile.handleTaken')}
                {availability.data?.suggestion ? (
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 font-mono"
                    onClick={() => setHandle(availability.data?.suggestion ?? '')}
                    data-testid="button-handle-suggestion"
                  >
                    {t('welcome.profile.handleSuggestion', { handle: availability.data.suggestion })}
                  </Button>
                ) : null}
              </span>
            ) : null}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="profile-locale">{t('welcome.profile.locale')}</Label>
          <Select value={locale} onValueChange={setLocale}>
            <SelectTrigger id="profile-locale" data-testid="select-profile-locale">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {locales.map((l) => (
                <SelectItem key={l} value={l}>
                  <span className="font-mono">{l}</span>
                  {l === detectedLocale() ? (
                    <span className="ml-2 text-[11px] text-muted-foreground">{t('welcome.profile.detected')}</span>
                  ) : null}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="profile-timezone">{t('welcome.profile.timezone')}</Label>
          {timezones.length ? (
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger id="profile-timezone" data-testid="select-profile-timezone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {timezones.map((z) => (
                  <SelectItem key={z} value={z}>
                    <span className="font-mono">{z}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              id="profile-timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="font-mono"
            />
          )}
        </div>
        <p className="-mt-3 text-[11px] text-muted-foreground sm:col-span-2">{t('welcome.profile.detectedNote')}</p>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="profile-birth">
            {t('welcome.profile.birth')}{' '}
            <span className="font-normal text-muted-foreground">{t('welcome.profile.optional')}</span>
          </Label>
          <Input
            id="profile-birth"
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className="max-w-48 font-mono"
            data-testid="input-profile-birth"
          />
          <p className="text-[11px] text-muted-foreground">{t('welcome.profile.birthWhy')}</p>
        </div>
      </div>

      {saveError ? <ApiErrorNotice error={saveError} testId="status-profile-error" /> : null}

      <StepActions
        primaryLabel={t('welcome.profile.primary')}
        onPrimary={() => void save()}
        primaryPending={saving || step.pendingStatus === 'done'}
        primaryDisabled={taken}
        onSkip={() => void step.record('skipped')}
        skipPending={step.pendingStatus === 'skipped'}
        error={step.error}
      />
    </div>
  );
}
