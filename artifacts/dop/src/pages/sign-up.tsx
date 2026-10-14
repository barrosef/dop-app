/**
 * Creating an account — two halves. Left: the promise. Right: *how do you
 * want to enter?* — Google, GitHub, or e-mail expanding inline into address
 * and password, with the password policy stated before it is violated.
 *
 * The provider buttons here and on `sign-in.tsx` are the SAME call
 * (`signInWith`) — a provider sign-in creates the account when there is none.
 * After it, `/` is right: the onboarding gate in `App.tsx` sends a new
 * account to the journey.
 */
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { validatePassword, type PasswordValidationStatus } from 'firebase/auth';
import {
  AlertTriangle,
  Check,
  Chrome,
  Circle,
  Github,
  Loader2,
  Mail,
  TerminalSquare,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { cn } from '@/lib/utils';
import { useSession } from '../lib/platform/session';
import { decideFromAuthError, type AuthDecision } from '../lib/platform/auth-errors';
import { FIREBASE_AUTH_EMULATOR_URL } from '../lib/platform/config';
import { auth } from '../lib/platform/firebase';
import { useI18n } from '../lib/i18n';

type T = ReturnType<typeof useI18n.getState>['t'];

function messageFor(t: T, decision: AuthDecision): string {
  switch (decision.kind) {
    case 'invalid-credential':
      return t('auth.invalid');
    case 'weak-password':
      return t('auth.error.weakPassword');
    case 'misconfigured-domain':
      return t('auth.error.misconfigured');
    case 'abandoned':
      // Firebase reports a deliberate cancel and an org blocking third-party
      // apps with the SAME code — see `auth-errors.ts`.
      return t('auth.error.abandoned');
    case 'rate-limited':
      return t('auth.error.rateLimited');
    case 'popup-blocked':
      return t('auth.error.popupBlocked');
    case 'unknown':
      return t('auth.error.unknown', { code: decision.code });
    default:
      return t('auth.error.unknown', { code: decision.kind });
  }
}

/** Firebase's own floor when no project policy is configured. */
const FIREBASE_MIN_LENGTH = 6;

/**
 * A visual strength hint — presentation only. Acceptance is Firebase's:
 * `validatePassword` (the project's policy) and the sign-up call itself.
 */
function strengthOf(password: string): number {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/u.test(password) && /[A-Z]/u.test(password)) score += 1;
  if (/\d/u.test(password)) score += 1;
  if (/[^A-Za-z0-9]/u.test(password)) score += 1;
  return Math.min(4, score);
}

interface Values {
  email: string;
  password: string;
}

export default function SignUp() {
  const { signUp, signInWith } = useSession();
  const t = useI18n((s) => s.t);
  const navigate = useNavigate();
  const [error, setError] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [providerPending, setProviderPending] = React.useState<'google' | 'github' | null>(null);
  const [emailOpen, setEmailOpen] = React.useState(false);
  const [policy, setPolicy] = React.useState<PasswordValidationStatus | null>(null);
  const form = useForm<Values>({ defaultValues: { email: '', password: '' } });
  const password = form.watch('password');

  // The project's password policy, read from Firebase itself (no endpoint of
  // ours): the requirements are shown BEFORE anything is typed.
  React.useEffect(() => {
    let cancelled = false;
    validatePassword(auth, password)
      .then((status) => {
        if (!cancelled) setPolicy(status);
      })
      .catch(() => {
        if (!cancelled) setPolicy(null);
      });
    return () => {
      cancelled = true;
    };
  }, [password]);

  const options = policy?.passwordPolicy.customStrengthOptions;
  const minLength = options?.minPasswordLength ?? FIREBASE_MIN_LENGTH;
  const rules: { label: string; met: boolean }[] = [
    { label: t('auth.signUp.rule.length', { n: minLength }), met: policy?.meetsMinPasswordLength ?? password.length >= minLength },
  ];
  if (options?.containsLowercaseLetter) rules.push({ label: t('auth.signUp.rule.lower'), met: Boolean(policy?.containsLowercaseLetter) });
  if (options?.containsUppercaseLetter) rules.push({ label: t('auth.signUp.rule.upper'), met: Boolean(policy?.containsUppercaseLetter) });
  if (options?.containsNumericCharacter) rules.push({ label: t('auth.signUp.rule.number'), met: Boolean(policy?.containsNumericCharacter) });
  if (options?.containsNonAlphanumericCharacter) rules.push({ label: t('auth.signUp.rule.symbol'), met: Boolean(policy?.containsNonAlphanumericCharacter) });
  const strength = strengthOf(password);
  const strengthLabels = [
    t('auth.signUp.strength.0'),
    t('auth.signUp.strength.1'),
    t('auth.signUp.strength.2'),
    t('auth.signUp.strength.3'),
    t('auth.signUp.strength.4'),
  ];

  // Read the decision from the CAUGHT ERROR, never from `pendingLink` state:
  // `signInWith` sets that state and then rethrows in the same tick. A
  // provider failure belongs on `/link-provider` (a credential was captured);
  // a password sign-up for an existing address goes straight to `/sign-in`.
  function handleFailure(failure: unknown, viaProvider: boolean): void {
    const decision = decideFromAuthError(failure);
    if (decision.kind === 'link-required') {
      if (viaProvider) {
        navigate('/link-provider');
      } else {
        navigate('/sign-in', { state: { linkEmail: decision.email } });
      }
      return;
    }
    setError(messageFor(t, decision));
  }

  async function onSubmit(values: Values) {
    setError('');
    setSubmitting(true);
    try {
      await signUp(values.email, values.password);
      navigate('/verify-email');
    } catch (failure) {
      handleFailure(failure, false);
    } finally {
      setSubmitting(false);
    }
  }

  async function onProvider(provider: 'google' | 'github') {
    setError('');
    setProviderPending(provider);
    try {
      await signInWith(provider);
      navigate('/');
    } catch (failure) {
      handleFailure(failure, true);
    } finally {
      setProviderPending(null);
    }
  }

  const promise = [
    { n: '01', title: t('auth.signUp.promise.code'), body: t('auth.signUp.promise.codeBody') },
    { n: '02', title: t('auth.signUp.promise.cards'), body: t('auth.signUp.promise.cardsBody') },
    { n: '03', title: t('auth.signUp.promise.agent'), body: t('auth.signUp.promise.agentBody') },
  ];

  return (
    <div className="grid min-h-[100dvh] bg-background text-foreground lg:grid-cols-2">
      <section className="relative flex flex-col justify-between overflow-hidden border-b border-border bg-muted/30 px-6 py-8 sm:px-12 lg:border-b-0 lg:border-r lg:py-14">
        <div className="flex items-center gap-2">
          <TerminalSquare className="h-5 w-5 text-primary" aria-hidden="true" />
          <span className="font-semibold tracking-tight">DOP</span>
        </div>
        <div className="my-10 max-w-md space-y-8 lg:my-0">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            {t('auth.signUp.headline')}
          </h1>
          <ol className="space-y-5">
            {promise.map((p, i) => (
              <li
                key={p.n}
                className="flex gap-4 animate-in fade-in slide-in-from-left-2 fill-mode-both duration-500"
                style={{ animationDelay: `${120 + i * 110}ms` }}
              >
                <span className="pt-0.5 font-mono text-xs tabular-nums text-primary">{p.n}</span>
                <span className="space-y-1">
                  <span className="block text-base font-medium">{p.title}</span>
                  <span className="block text-sm leading-relaxed text-muted-foreground">{p.body}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
        <p className="hidden font-mono text-[11px] text-muted-foreground lg:block">{t('auth.signUp.footnote')}</p>
      </section>

      <section className="flex items-center justify-center px-6 py-10 sm:px-12">
        <div className="w-full max-w-sm space-y-6" data-testid="form-sign-up">
          <div className="space-y-1.5">
            <h2 className="text-xl font-semibold tracking-tight">{t('auth.signUp.how')}</h2>
            <p className="text-sm text-muted-foreground">{t('auth.signUp.subtitle')}</p>
          </div>

          <div className="space-y-2">
            <Button
              variant="outline"
              className="h-10 w-full justify-start"
              onClick={() => onProvider('google')}
              disabled={providerPending !== null}
              data-testid="button-google"
            >
              {providerPending === 'google' ? <Loader2 className="animate-spin" /> : <Chrome />}
              {t('auth.with.google')}
            </Button>
            <Button
              variant="outline"
              className="h-10 w-full justify-start"
              onClick={() => onProvider('github')}
              disabled={providerPending !== null}
              data-testid="button-github"
            >
              {providerPending === 'github' ? <Loader2 className="animate-spin" /> : <Github />}
              {t('auth.with.github')}
            </Button>
            <Button
              variant={emailOpen ? 'secondary' : 'outline'}
              className="h-10 w-full justify-start"
              onClick={() => setEmailOpen((o) => !o)}
              aria-expanded={emailOpen}
              aria-controls="sign-up-email"
              data-testid="button-email-expand"
            >
              <Mail />
              {t('auth.signUp.withEmail')}
            </Button>
          </div>

          {emailOpen ? (
            <Form {...form}>
              <form
                id="sign-up-email"
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4 border-l-2 border-primary pl-4 animate-in fade-in slide-in-from-top-1 duration-200"
              >
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('auth.email')}</FormLabel>
                      <FormControl>
                        <Input type="email" autoComplete="username" required autoFocus data-testid="input-email" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('auth.password')}</FormLabel>
                      <FormControl>
                        <Input type="password" autoComplete="new-password" required data-testid="input-password" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div className="space-y-2" aria-live="polite">
                  <div className="flex items-center gap-3">
                    <Progress value={(strength / 4) * 100} className="h-1 flex-1" aria-label={t('auth.signUp.strength.label')} />
                    <span className="w-16 text-right text-[11px] text-muted-foreground">{strengthLabels[strength]}</span>
                  </div>
                  <ul className="space-y-1">
                    {rules.map((r) => (
                      <li
                        key={r.label}
                        className={cn('flex items-center gap-2 text-xs', r.met ? 'text-foreground' : 'text-muted-foreground')}
                      >
                        {r.met ? (
                          <Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                        ) : (
                          <Circle className="h-2.5 w-2.5" aria-hidden="true" />
                        )}
                        {r.label}
                      </li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-muted-foreground">{t('auth.signUp.verifyNote')}</p>
                </div>
                <Button type="submit" className="h-10 w-full" disabled={submitting} data-testid="button-sign-up">
                  {submitting ? <Loader2 className="animate-spin" /> : null}
                  {submitting ? t('auth.signUp.submitting') : t('auth.signUp.submit')}
                </Button>
              </form>
            </Form>
          ) : null}

          {error ? (
            <div className="flex items-start gap-2 border-l-2 border-destructive bg-destructive/10 px-3 py-2 text-xs" role="alert">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
              <span data-testid="text-sign-up-error">{error}</span>
            </div>
          ) : null}

          <p className="text-center text-xs text-muted-foreground">
            <Link to="/sign-in" className="underline-offset-4 hover:underline" data-testid="link-sign-in">
              {t('auth.signUp.haveAccount')}
            </Link>
          </p>

          {FIREBASE_AUTH_EMULATOR_URL ? (
            <p className="text-center font-mono text-[10px] text-muted-foreground">
              {t('auth.emulator', { url: FIREBASE_AUTH_EMULATOR_URL })}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
