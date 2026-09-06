import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  getSecondFactorStateQueryKey,
  useConfirmSecondFactor,
  useEnrollSecondFactor,
} from '@workspace/api-client-react';
import { AlertTriangle, ChevronRight, SkipForward } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import { useI18n } from '@/lib/i18n';

const STEPS = [
  { id: 'phone', i18nKey: 'wizard.onboarding.rail.phone' },
  { id: 'tools', i18nKey: 'wizard.onboarding.rail.tools' },
  { id: 'social', i18nKey: 'wizard.onboarding.rail.social' },
  { id: 'referral', i18nKey: 'wizard.onboarding.rail.referral' },
  { id: 'plans', i18nKey: 'wizard.onboarding.rail.plans' },
] as const;

type PhoneValues = { destination: string };
type CodeValues = { code: string };
type ErrorRecord = Record<string, unknown>;

interface ApiErrorLike {
  message?: string;
  status?: number;
  data?: unknown;
  headers?: Headers;
  response?: { headers?: Headers };
}

function asRecord(value: unknown): ErrorRecord | null {
  return typeof value === 'object' && value !== null
    ? (value as ErrorRecord)
    : null;
}

function apiErrorMessage(error: unknown, fallback: string): string {
  const apiError = asRecord(error) as ApiErrorLike | null;
  const data = asRecord(apiError?.data);
  const detail = data?.detail;

  if (Array.isArray(detail)) {
    const validation = asRecord(detail[0]);
    if (typeof validation?.msg === 'string') return validation.msg;
  }

  for (const candidate of [
    data?.detail,
    data?.message,
    data?.title,
    data?.error_description,
    data?.error,
    apiError?.message,
  ]) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate;
  }

  return fallback;
}

function remainingAttempts(error: unknown): number | null {
  const apiError = asRecord(error) as ApiErrorLike | null;
  const data = asRecord(apiError?.data);

  for (const value of [data?.remaining_attempts, data?.attempts_remaining]) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }

  return null;
}

function retryAfterSeconds(error: unknown): number | null {
  const apiError = asRecord(error) as ApiErrorLike | null;
  if (apiError?.status !== 429) return null;

  const data = asRecord(apiError.data);
  for (const value of [data?.retry_after_seconds, data?.retry_after]) {
    const seconds = typeof value === 'string' ? Number(value) : value;
    if (typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0) {
      return Math.ceil(seconds);
    }
  }

  const headers = apiError.response?.headers ?? apiError.headers;
  const value = headers?.get('retry-after');
  if (!value) return null;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds > 0) return Math.ceil(seconds);

  const retryAt = Date.parse(value);
  if (Number.isNaN(retryAt)) return null;
  return Math.max(1, Math.ceil((retryAt - Date.now()) / 1000));
}

function ErrorNotice({ error }: { error: unknown }) {
  const t = useI18n((state) => state.t);
  const attempts = remainingAttempts(error);
  const retryAfter = retryAfterSeconds(error);

  return (
    <div
      className="space-y-1 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
      role="alert"
      data-testid="status-onboarding-error"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>{apiErrorMessage(error, t('wizard.onboarding.phone.error'))}</p>
      </div>
      {attempts !== null ? (
        <p className="ml-6 font-mono text-xs tabular-nums" data-testid="text-attempts-remaining">
          {t('wizard.onboarding.phone.remaining', { n: attempts })}
        </p>
      ) : null}
      {retryAfter !== null ? (
        <p className="ml-6 font-mono text-xs tabular-nums" data-testid="text-retry-after">
          {t('wizard.onboarding.phone.retryAfter', { s: retryAfter })}
        </p>
      ) : null}
    </div>
  );
}

export default function Onboarding() {
  const t = useI18n((state) => state.t);
  const navigate = useNavigate();
  const [skipped, setSkipped] = useState(false);
  const skipTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (skipTimer.current !== null) window.clearTimeout(skipTimer.current);
    },
    [],
  );

  const handleSkip = () => {
    if (skipped) return;
    setSkipped(true);
    skipTimer.current = window.setTimeout(() => navigate('/'), 450);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-background/80 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-phone-title"
      data-testid="dialog-profile-onboarding"
    >
      <div className="my-auto flex max-h-[calc(100vh-1.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-border bg-card md:max-h-[calc(100vh-3rem)] md:flex-row">
        <aside className="shrink-0 border-b border-border bg-muted/30 p-4 md:w-64 md:border-b-0 md:border-r md:p-6">
          <ol className="flex gap-2 overflow-x-auto md:flex-col md:gap-4">
            {STEPS.map((step, index) => {
              const isPhone = step.id === 'phone';
              const isSkipped = isPhone && skipped;

              return (
                <li
                  key={step.id}
                  className="flex min-w-32 items-center gap-2.5 md:min-w-0"
                  data-testid={`step-onboarding-${step.id}`}
                  aria-current={isPhone && !isSkipped ? 'step' : undefined}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] tabular-nums transition-colors ${
                      isPhone && !isSkipped
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card text-muted-foreground'
                    }`}
                  >
                    {isSkipped ? (
                      <SkipForward className="h-3 w-3" aria-hidden="true" />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span
                    className={
                      isPhone && !isSkipped
                        ? 'text-sm font-medium text-foreground'
                        : 'text-sm text-muted-foreground'
                    }
                  >
                    {t(step.i18nKey)}
                  </span>
                  {isSkipped ? (
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {t('wizard.onboarding.phone.skipped')}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </aside>

        <main className="min-h-0 flex-1 overflow-y-auto bg-card p-5 sm:p-8 md:p-10">
          <PhoneStep
            onComplete={() => navigate('/')}
            onSkip={handleSkip}
            skipPending={skipped}
          />
        </main>
      </div>
    </div>
  );
}

function PhoneStep({
  onComplete,
  onSkip,
  skipPending,
}: {
  onComplete: () => void;
  onSkip: () => void;
  skipPending: boolean;
}) {
  const t = useI18n((state) => state.t);
  const queryClient = useQueryClient();
  const [enrolled, setEnrolled] = useState<{
    challengeId: string;
    factorId: string;
    destination: string;
  } | null>(null);
  const [resendCount, setResendCount] = useState(0);
  const [cooldown, setCooldown] = useState(0);

  const enroll = useEnrollSecondFactor();
  const confirm = useConfirmSecondFactor();
  const enrollRetryAfter = retryAfterSeconds(enroll.error);

  const phoneForm = useForm<PhoneValues>({
    resolver: zodResolver(
      z.object({
        destination: z.string().trim().min(1, t('wizard.onboarding.phone.required')),
      }),
    ),
    defaultValues: { destination: '' },
  });
  const codeForm = useForm<CodeValues>({
    resolver: zodResolver(
      z.object({
        code: z
          .string()
          .regex(/^\d{6}$/, t('wizard.onboarding.phone.code.invalid')),
      }),
    ),
    defaultValues: { code: '' },
  });

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(
      () => setCooldown((current) => Math.max(0, current - 1)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    if (enrollRetryAfter !== null) {
      setCooldown((current) => Math.max(current, enrollRetryAfter));
    }
  }, [enrollRetryAfter]);

  const saveEnrollment = (
    response: {
      challenge_id: string;
      factor: { id: string; masked_destination?: string };
    },
    destination: string,
  ) => {
    setEnrolled({
      challengeId: response.challenge_id,
      factorId: response.factor.id,
      destination: response.factor.masked_destination || destination,
    });
    codeForm.reset();
  };

  const handleEnroll = (values: PhoneValues) => {
    const destination = values.destination.trim();
    enroll.mutate(
      {
        data: {
          kind: 'sms',
          label: t('wizard.onboarding.phone.factorLabel'),
          destination,
        },
      },
      {
        onSuccess: (response) => {
          saveEnrollment(response, destination);
          setCooldown(15);
        },
      },
    );
  };

  const handleResend = () => {
    if (cooldown > 0 || enroll.isPending) return;
    const destination = phoneForm.getValues('destination').trim();
    if (!destination) return;

    enroll.mutate(
      {
        data: {
          kind: 'sms',
          label: t('wizard.onboarding.phone.factorLabel'),
          destination,
        },
      },
      {
        onSuccess: (response) => {
          const nextCount = resendCount + 1;
          saveEnrollment(response, destination);
          setResendCount(nextCount);
          setCooldown(Math.min(15 * 2 ** nextCount, 120));
        },
      },
    );
  };

  const handleConfirm = (values: CodeValues) => {
    if (!enrolled) return;

    confirm.mutate(
      {
        factorId: enrolled.factorId,
        data: { challenge_id: enrolled.challengeId, code: values.code },
      },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({
            queryKey: getSecondFactorStateQueryKey(),
          });
          onComplete();
        },
      },
    );
  };

  const correctNumber = () => {
    setEnrolled(null);
    setCooldown(0);
    setResendCount(0);
    codeForm.reset();
    enroll.reset();
    confirm.reset();
    window.requestAnimationFrame(() => phoneForm.setFocus('destination'));
  };

  return (
    <div className="mx-auto max-w-md space-y-7" data-testid="section-onboarding-phone">
      <header>
        <div className="mb-4 flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          <span className="tabular-nums">01</span>
          <ChevronRight className="h-3 w-3" aria-hidden="true" />
          <span>{t('wizard.onboarding.rail.phone')}</span>
        </div>
        <h1
          id="onboarding-phone-title"
          className="text-2xl font-semibold tracking-tight text-foreground"
          data-testid="text-onboarding-title"
        >
          {t('wizard.onboarding.phone.title')}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {t('wizard.onboarding.phone.subtitle')}
        </p>
      </header>

      {!enrolled ? (
        <Form {...phoneForm}>
          <form
            onSubmit={phoneForm.handleSubmit(handleEnroll)}
            className="space-y-5"
            noValidate
          >
            <FormField
              control={phoneForm.control}
              name="destination"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('wizard.onboarding.phone.label')}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="tel"
                      autoComplete="tel"
                      inputMode="tel"
                      placeholder={t('wizard.onboarding.phone.placeholder')}
                      className="font-mono tabular-nums"
                      data-testid="input-phone-number"
                    />
                  </FormControl>
                  <FormMessage data-testid="status-phone-validation" />
                </FormItem>
              )}
            />

            {enroll.error ? <ErrorNotice error={enroll.error} /> : null}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                type="submit"
                disabled={enroll.isPending || skipPending}
                data-testid="button-phone-send"
              >
                {enroll.isPending
                  ? t('wizard.onboarding.phone.sending')
                  : t('wizard.onboarding.phone.send')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={onSkip}
                disabled={skipPending}
                data-testid="button-phone-skip"
              >
                {skipPending
                  ? t('wizard.onboarding.phone.skipped')
                  : t('wizard.onboarding.phone.skip')}
              </Button>
            </div>
          </form>
        </Form>
      ) : (
        <Form {...codeForm}>
          <form
            onSubmit={codeForm.handleSubmit(handleConfirm)}
            className="space-y-5"
            noValidate
          >
            <p
              className="text-sm text-muted-foreground"
              data-testid="text-code-destination"
            >
              {t('wizard.onboarding.phone.code.sent', {
                destination: enrolled.destination,
              })}
            </p>

            <FormField
              control={codeForm.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('wizard.onboarding.phone.code.label')}</FormLabel>
                  <FormControl>
                    <InputOTP
                      maxLength={6}
                      value={field.value}
                      onChange={field.onChange}
                      disabled={confirm.isPending || skipPending}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      data-testid="input-phone-code"
                    >
                      <InputOTPGroup>
                        {Array.from({ length: 6 }, (_, index) => (
                          <InputOTPSlot key={index} index={index} />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </FormControl>
                  <FormMessage data-testid="status-code-validation" />
                </FormItem>
              )}
            />

            {confirm.error ? <ErrorNotice error={confirm.error} /> : null}
            {enroll.error && !confirm.error ? (
              <ErrorNotice error={enroll.error} />
            ) : null}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                type="submit"
                disabled={
                  confirm.isPending ||
                  skipPending ||
                  codeForm.watch('code').length !== 6
                }
                data-testid="button-phone-verify"
              >
                {confirm.isPending
                  ? t('wizard.onboarding.phone.verifying')
                  : t('wizard.onboarding.phone.verify')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={onSkip}
                disabled={skipPending}
                data-testid="button-phone-skip-code"
              >
                {skipPending
                  ? t('wizard.onboarding.phone.skipped')
                  : t('wizard.onboarding.phone.skip')}
              </Button>
            </div>

            <div className="flex flex-col items-start border-t border-border pt-4">
              <Button
                type="button"
                variant="link"
                className="h-auto px-0 py-1"
                onClick={handleResend}
                disabled={cooldown > 0 || enroll.isPending || skipPending}
                data-testid="button-phone-resend"
              >
                {cooldown > 0
                  ? t('wizard.onboarding.phone.resendDelay', { s: cooldown })
                  : t('wizard.onboarding.phone.resend')}
              </Button>
              <Button
                type="button"
                variant="link"
                className="h-auto px-0 py-1 text-muted-foreground"
                onClick={correctNumber}
                disabled={enroll.isPending || confirm.isPending || skipPending}
                data-testid="button-phone-correct"
              >
                {t('wizard.onboarding.phone.correct')}
              </Button>
            </div>
          </form>
        </Form>
      )}
    </div>
  );
}