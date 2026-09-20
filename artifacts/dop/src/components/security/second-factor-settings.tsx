/**
 * Managing the second factor: the list, the enrolment and the recovery codes
 * (ADR-0020).
 *
 * Three things this screen never does, and each absence is the design:
 *
 *   - it does not show a registered seed again. The platform keeps it to
 *     VERIFY, not to show — a screen that could show it would turn every
 *     session into an enrolment of a new device;
 *   - it does not offer a kind the account does not accept. The list comes from
 *     the core (`allowed`), because the policy is the account's;
 *   - it does not say whether removing the last factor is allowed. It asks, and
 *     the core refuses where the account requires one.
 */
import React from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  KeyRound,
  Mail,
  Smartphone,
  Trash2,
} from 'lucide-react';
import {
  getListSecondFactorsQueryKey,
  getSecondFactorStateQueryKey,
  useConfirmSecondFactor,
  useEnrollSecondFactor,
  useRegenerateRecoveryCodes,
  useRevokeSecondFactor,
  useSecondFactorState,
  type EnrollResponse,
  type FactorSummary,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';

import { useI18n } from '../../lib/i18n';
import { useAccount } from '../../lib/platform/account';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';

const ICON = {
  totp: KeyRound,
  email: Mail,
  sms: Smartphone,
} as const;

export function SecondFactorSettings() {
  const t = useI18n((s) => s.t);
  const queryClient = useQueryClient();
  const { activeAccount } = useAccount();
  const { data, isLoading, error } = useSecondFactorState({
    query: { queryKey: getSecondFactorStateQueryKey(), enabled: Boolean(activeAccount) },
  });

  const [adding, setAdding] = React.useState(false);
  const [codes, setCodes] = React.useState<string[] | null>(null);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: getSecondFactorStateQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListSecondFactorsQueryKey() });
  }

  if (isLoading) {
    return <p className="text-xs text-muted-foreground">{t('twofa.verifying')}</p>;
  }
  if (error) {
    return (
      <p className="text-xs text-destructive">
        {t('account.error', { reason: (error as Error).message })}
      </p>
    );
  }

  const factors = data?.factors ?? [];
  const allowed = data?.allowed ?? [];

  return (
    <div className="space-y-4" data-testid="second-factor-settings">
      <div>
        <h2 className="text-sm font-semibold">{t('twofa.settings.title')}</h2>
        <p className="text-xs text-muted-foreground">{t('twofa.settings.subtitle')}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {data?.required ? t('twofa.settings.required') : t('twofa.settings.optional')}
        </p>
      </div>

      {factors.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('twofa.settings.none')}</p>
      ) : (
        <ul className="space-y-1.5">
          {factors.map((f) => (
            <FactorRow key={f.id} factor={f} onChanged={refresh} />
          ))}
        </ul>
      )}

      {adding && allowed.length > 0 ? (
        <EnrollFactor
          allowed={allowed}
          onDone={(newCodes) => {
            setAdding(false);
            if (newCodes.length) setCodes(newCodes);
            refresh();
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <Button
          type="button"
          onClick={() => setAdding(true)}
          disabled={allowed.length === 0}
          variant="outline"
          size="sm"
          className="shadow-none"
          data-testid="add-factor"
        >
          {t('twofa.settings.add')}
        </Button>
      )}
      {allowed.length === 0 ? <p className="text-xs text-muted-foreground">{t('twofa.settings.noMethods')}</p> : null}

      {/* The recovery codes only make sense once there IS a factor: they are the
          way back from it, and offering them before would be offering a key to a
          door nobody has locked. */}
      {factors.some((f) => f.status === 'active') ? (
        <RecoveryCodes
          left={data?.recovery_codes_left ?? 0}
          onGenerated={(newCodes) => setCodes(newCodes)}
        />
      ) : null}

      {codes ? <CodesDialog codes={codes} onClose={() => setCodes(null)} /> : null}
    </div>
  );
}

function FactorRow({
  factor,
  onChanged,
}: {
  factor: FactorSummary;
  onChanged: () => void;
}) {
  const t = useI18n((s) => s.t);
  const revoke = useRevokeSecondFactor();
  const [error, setError] = React.useState('');
  const Icon = ICON[factor.kind as keyof typeof ICON] ?? KeyRound;

  return (
    <li
      className="rounded-md border border-border/60 bg-card/60 px-3 py-2"
      data-testid={`factor-row-${factor.id}`}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium">
            {factor.label}
            <span className="ml-2 font-normal text-muted-foreground">
              {t(`twofa.method.${factor.kind}` as never)}
            </span>
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {factor.masked_destination}
            {factor.status === 'pending' ? ` · ${t('twofa.settings.pending')}` : ''}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t('twofa.settings.remove')}
          title={t('twofa.settings.remove')}
          disabled={revoke.isPending}
          aria-busy={revoke.isPending}
          onClick={() => {
            if (!window.confirm(t('twofa.settings.confirmRemove'))) return;
            setError('');
            revoke.mutate(
              { factorId: factor.id },
              { onSuccess: onChanged, onError: (e) => setError((e as Error).message) },
            );
          }}
          className="text-muted-foreground hover:text-destructive"
          data-testid={`remove-factor-${factor.id}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      {error ? (
        <p className="mt-1 text-[11px] text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </li>
  );
}

function EnrollFactor({
  allowed,
  onDone,
  onCancel,
}: {
  allowed: string[];
  onDone: (codes: string[]) => void;
  onCancel: () => void;
}) {
  const t = useI18n((s) => s.t);
  const [kind, setKind] = React.useState(allowed[0] ?? '');
  const [label, setLabel] = React.useState('');
  const [destination, setDestination] = React.useState('');
  const [enrolled, setEnrolled] = React.useState<EnrollResponse | null>(null);
  const [code, setCode] = React.useState('');
  const [error, setError] = React.useState('');

  const enroll = useEnrollSecondFactor();
  const confirm = useConfirmSecondFactor();

  if (enrolled) {
    return (
      <form
        className="space-y-3 rounded-md border border-border p-3"
        aria-busy={confirm.isPending}
        onSubmit={(e) => {
          e.preventDefault();
          setError('');
          confirm.mutate(
            {
              factorId: enrolled.factor.id,
              data: { challenge_id: enrolled.challenge_id, code },
            },
            {
              onSuccess: (r) => onDone(r.recovery_codes ?? []),
              onError: (err) => setError((err as Error).message),
            },
          );
        }}
      >
        {enrolled.secret ? (
          <div className="space-y-1.5">
            <p className="text-xs font-medium">{t('twofa.enroll.totp.title')}</p>
            <p className="text-[11px] text-muted-foreground">
              {t('twofa.enroll.totp.manual')}
            </p>
            {/* The manual key, not a QR: rendering one would mean a new
                dependency in the authentication path, and the same argument
                that keeps the TOTP implementation dependency-free applies here
                (see the report — it is a recorded open item, not an oversight).
                The link below opens the app directly on a phone. */}
            <p className="select-all break-all rounded bg-muted/40 px-2 py-1.5 font-mono text-sm tracking-wider">
              {enrolled.secret.replace(/(.{4})/g, '$1 ').trim()}
            </p>
            <a
              href={enrolled.uri}
              className="inline-block text-[11px] text-primary underline"
              data-testid="open-authenticator"
            >
              {t('twofa.enroll.totp.open')}
            </a>
            <p className="text-[11px] text-muted-foreground">
              {t('twofa.enroll.totp.once')}
            </p>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <label className="text-xs font-medium" htmlFor="enroll-code">
            {t('twofa.enroll.confirm')}
          </label>
          <Input
            id="enroll-code"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
              if (error) setError('');
            }}
            inputMode="numeric"
            autoComplete="one-time-code"
            disabled={confirm.isPending}
            aria-invalid={Boolean(error)}
            className="text-center font-mono text-lg tracking-[0.4em] shadow-none"
            data-testid="input-enroll-code"
          />
        </div>

        {error ? (
          <p className="text-[11px] text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex gap-2">
          <Button
            type="submit"
            disabled={confirm.isPending || code.length < 6}
            size="sm"
            data-testid="button-confirm-factor"
          >
            {confirm.isPending ? t('twofa.verifying') : t('twofa.verify')}
          </Button>
          <Button
            type="button"
            onClick={onCancel}
            variant="outline"
            size="sm"
            className="shadow-none"
            disabled={confirm.isPending}
            data-testid="button-cancel-factor-confirmation"
          >
            {t('twofa.useFactor')}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form
      className="space-y-3 rounded-md border border-border p-3"
      aria-busy={enroll.isPending}
      onSubmit={(e) => {
        e.preventDefault();
        if (!allowed.includes(kind)) return;
        setError('');
        enroll.mutate(
          { data: { kind, label, destination } },
          {
            onSuccess: (r) => setEnrolled(r),
            onError: (err) => setError((err as Error).message),
          },
        );
      }}
    >
      <div className="space-y-1.5">
        <p id="factor-kind-label" className="text-xs font-medium">
          {t('twofa.enroll.kind')}
        </p>
        <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="factor-kind-label">
          {/* Only what the ACCOUNT accepts. An account that disabled SMS does
              not see it here — the policy is not repeated on the screen, it is
              read from the core. */}
          {allowed.map((k) => (
            <Button
              key={k}
              type="button"
              onClick={() => {
                setKind(k);
                if (error) setError('');
              }}
              variant={kind === k ? 'secondary' : 'outline'}
              size="sm"
              className={kind === k ? '' : 'shadow-none text-muted-foreground'}
              disabled={enroll.isPending}
              aria-pressed={kind === k}
              data-testid={`button-factor-kind-${k}`}
            >
              {t(`twofa.method.${k}` as never)}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium" htmlFor="factor-label">
          {t('twofa.enroll.label')}
        </label>
        <Input
          id="factor-label"
          value={label}
          onChange={(e) => {
            setLabel(e.target.value);
            if (error) setError('');
          }}
          placeholder={t('twofa.enroll.labelPlaceholder')}
          disabled={enroll.isPending}
          aria-invalid={Boolean(error)}
          className="shadow-none"
          data-testid="input-factor-label"
        />
      </div>

      {kind !== 'totp' ? (
        <div className="space-y-1.5">
          <label className="text-xs font-medium" htmlFor="factor-destination">
            {t(`twofa.enroll.destination.${kind}` as never)}
          </label>
          <Input
            id="factor-destination"
            value={destination}
            onChange={(e) => {
              setDestination(e.target.value);
              if (error) setError('');
            }}
            placeholder={
              kind === 'sms' ? t('twofa.enroll.destination.smsPlaceholder') : ''
            }
            disabled={enroll.isPending}
            aria-invalid={Boolean(error)}
            className="font-mono shadow-none"
            data-testid="input-factor-destination"
          />
        </div>
      ) : null}

      {error ? (
        <p className="flex items-start gap-1.5 text-[11px] text-destructive" role="alert">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button
          type="submit"
          disabled={enroll.isPending || !label || !allowed.includes(kind)}
          size="sm"
          data-testid="button-start-enrollment"
        >
          {enroll.isPending ? t('common.loading') : t('twofa.enroll.start')}
        </Button>
        <Button
          type="button"
          onClick={onCancel}
          variant="outline"
          size="sm"
          className="shadow-none"
          disabled={enroll.isPending}
          data-testid="button-cancel-enrollment"
        >
          {t('twofa.useFactor')}
        </Button>
      </div>
    </form>
  );
}

function RecoveryCodes({
  left,
  onGenerated,
}: {
  left: number;
  onGenerated: (codes: string[]) => void;
}) {
  const t = useI18n((s) => s.t);
  const regenerate = useRegenerateRecoveryCodes();
  const [error, setError] = React.useState('');

  return (
    <div
      className="rounded-md border border-border/60 px-3 py-2"
      data-testid="recovery-codes-settings"
    >
      <p className="text-xs">
        {left > 0
          ? t('twofa.settings.recoveryLeft', { n: left })
          : t('twofa.settings.recoveryNone')}
      </p>
      <Button
        type="button"
        onClick={() => {
          setError('');
          regenerate.mutate(undefined, {
            onSuccess: (r) => onGenerated(r.codes),
            onError: (e) => setError((e as Error).message),
          });
        }}
        variant="link"
        size="sm"
        disabled={regenerate.isPending}
        aria-busy={regenerate.isPending}
        className="mt-1.5 h-auto min-h-0 px-0 py-0 text-[11px]"
        data-testid="button-regenerate-recovery-codes"
      >
        {regenerate.isPending ? t('common.loading') : t('twofa.settings.regenerate')}
      </Button>
      {error ? (
        <p className="mt-1 text-[11px] text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The codes appear ONCE. The dialog says so, because a person who closes it
 * thinking they can come back later discovers otherwise on the worst day.
 */
function CodesDialog({ codes, onClose }: { codes: string[]; onClose: () => void }) {
  const t = useI18n((s) => s.t);
  const [copied, setCopied] = React.useState(false);
  const [copying, setCopying] = React.useState(false);
  const [copyError, setCopyError] = React.useState('');

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        closeLabel={t('twofa.recoveryCodes.done')}
        overlayClassName="bg-background/70"
        className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-sm overflow-y-auto shadow-none"
        data-testid="recovery-codes-dialog"
      >
        <DialogHeader>
          <DialogTitle>{t('twofa.recoveryCodes.title')}</DialogTitle>
          <DialogDescription>{t('twofa.recoveryCodes.hint')}</DialogDescription>
        </DialogHeader>
        <p className="text-[11px] text-muted-foreground">{t('twofa.recoveryCodes.why')}</p>
        <ul
          className="grid max-h-[min(50vh,20rem)] grid-cols-1 gap-1 overflow-y-auto rounded bg-muted/40 p-2 font-mono text-xs sm:grid-cols-2"
          data-testid="recovery-codes-list"
        >
          {codes.map((c) => (
            <li key={c} className="select-all break-all" data-testid={`recovery-code-${c}`}>
              {c}
            </li>
          ))}
        </ul>
        {copyError ? (
          <p className="text-[11px] text-destructive" role="alert">
            {copyError}
          </p>
        ) : null}
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={copying}
            aria-busy={copying}
            onClick={async () => {
              setCopied(false);
              setCopyError('');
              setCopying(true);
              try {
                await navigator.clipboard.writeText(codes.join('\n'));
                setCopied(true);
              } catch (error) {
                setCopied(false);
                setCopyError(
                  t('account.error', {
                    reason: error instanceof Error ? error.message : String(error),
                  }),
                );
              } finally {
                setCopying(false);
              }
            }}
            className="w-full shadow-none sm:w-auto"
            data-testid="button-copy-recovery-codes"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copying
              ? t('common.loading')
              : copied
                ? t('twofa.recoveryCodes.copied')
                : t('twofa.recoveryCodes.copy')}
          </Button>
          <Button
            type="button"
            onClick={onClose}
            size="sm"
            disabled={copying}
            className="w-full sm:w-auto"
            data-testid="button-close-recovery-codes"
          >
            {t('twofa.recoveryCodes.done')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
