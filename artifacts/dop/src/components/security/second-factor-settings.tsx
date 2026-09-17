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

const ICON = {
  totp: KeyRound,
  email: Mail,
  sms: Smartphone,
} as const;

export function SecondFactorSettings() {
  const t = useI18n((s) => s.t);
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useSecondFactorState();

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

      {adding ? (
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
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/50"
          data-testid="add-factor"
        >
          {t('twofa.settings.add')}
        </button>
      )}

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
    <li className="rounded-md border border-border/60 bg-card/60 px-3 py-2">
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
        <button
          type="button"
          title={t('twofa.settings.remove')}
          onClick={() => {
            if (!window.confirm(t('twofa.settings.confirmRemove'))) return;
            revoke.mutate(
              { factorId: factor.id },
              { onSuccess: onChanged, onError: (e) => setError((e as Error).message) },
            );
          }}
          className="rounded p-1 text-muted-foreground hover:bg-muted/50 hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {error ? <p className="mt-1 text-[11px] text-destructive">{error}</p> : null}
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
  const [kind, setKind] = React.useState(allowed[0] ?? 'totp');
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
          <input
            id="enroll-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-center font-mono text-lg tracking-[0.4em]"
            placeholder="000000"
          />
        </div>

        {error ? <p className="text-[11px] text-destructive">{error}</p> : null}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={confirm.isPending || code.length < 6}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            {t('twofa.verify')}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-border px-3 py-1.5 text-xs"
          >
            {t('twofa.useFactor')}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form
      className="space-y-3 rounded-md border border-border p-3"
      onSubmit={(e) => {
        e.preventDefault();
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
        <label className="text-xs font-medium">{t('twofa.enroll.kind')}</label>
        <div className="flex gap-1.5">
          {/* Only what the ACCOUNT accepts. An account that disabled SMS does
              not see it here — the policy is not repeated on the screen, it is
              read from the core. */}
          {allowed.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`rounded-md border px-2.5 py-1.5 text-xs ${
                kind === k
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground'
              }`}
            >
              {t(`twofa.method.${k}` as never)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium" htmlFor="factor-label">
          {t('twofa.enroll.label')}
        </label>
        <input
          id="factor-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t('twofa.enroll.labelPlaceholder')}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </div>

      {kind !== 'totp' ? (
        <div className="space-y-1.5">
          <label className="text-xs font-medium" htmlFor="factor-destination">
            {t(`twofa.enroll.destination.${kind}` as never)}
          </label>
          <input
            id="factor-destination"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder={
              kind === 'sms' ? t('twofa.enroll.destination.smsPlaceholder') : ''
            }
            className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm"
          />
        </div>
      ) : null}

      {error ? (
        <p className="flex items-start gap-1.5 text-[11px] text-destructive">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={enroll.isPending || !label}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          {t('twofa.enroll.start')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border px-3 py-1.5 text-xs"
        >
          {t('twofa.useFactor')}
        </button>
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
    <div className="rounded-md border border-border/60 px-3 py-2">
      <p className="text-xs">
        {left > 0
          ? t('twofa.settings.recoveryLeft', { n: left })
          : t('twofa.settings.recoveryNone')}
      </p>
      <button
        type="button"
        onClick={() => {
          setError('');
          regenerate.mutate(undefined, {
            onSuccess: (r) => onGenerated(r.codes),
            onError: (e) => setError((e as Error).message),
          });
        }}
        className="mt-1.5 text-[11px] text-primary underline"
      >
        {t('twofa.settings.regenerate')}
      </button>
      {error ? <p className="mt-1 text-[11px] text-destructive">{error}</p> : null}
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-6">
      <div className="w-full max-w-sm space-y-3 rounded-lg border border-border bg-card p-5">
        <h3 className="text-sm font-semibold">{t('twofa.recoveryCodes.title')}</h3>
        <p className="text-[11px] text-muted-foreground">{t('twofa.recoveryCodes.hint')}</p>
        <p className="text-[11px] text-muted-foreground">{t('twofa.recoveryCodes.why')}</p>
        <ul className="grid grid-cols-2 gap-1 rounded bg-muted/40 p-2 font-mono text-xs">
          {codes.map((c) => (
            <li key={c} className="select-all">
              {c}
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(codes.join('\n'));
              setCopied(true);
            }}
            className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? t('twofa.recoveryCodes.copied') : t('twofa.recoveryCodes.copy')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
          >
            {t('twofa.recoveryCodes.done')}
          </button>
        </div>
      </div>
    </div>
  );
}
