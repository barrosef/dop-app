import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, MessageSquareText, Pencil, RotateCw } from 'lucide-react';
import {
  getMeQueryKey,
  getSecondFactorStateQueryKey,
  useConfirmSecondFactor,
  useEnrollSecondFactor,
  useMe,
  useUpdateProfile,
} from '@workspace/api-client-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ApiErrorNotice } from '@/components/welcome/api-error';
import { StepActions, StepHeader, StepPanel } from '@/components/welcome/step-frame';
import { useI18n } from '@/lib/i18n';
import { useAccount } from '@/lib/platform/account';
import { retryAfterSeconds } from '@/lib/platform/api-error';
import { resendDelaySeconds } from '@/lib/platform/welcome';
import { useWelcomeStep } from '@/hooks/use-welcome-step';

/** Dial codes to help typing E.164. A help, not a whitelist: any `+` number goes. */
const DIAL_CODES = [
  { country: 'BR', code: '55' },
  { country: 'US', code: '1' },
  { country: 'PT', code: '351' },
  { country: 'GB', code: '44' },
  { country: 'ES', code: '34' },
  { country: 'AR', code: '54' },
  { country: 'MX', code: '52' },
  { country: 'DE', code: '49' },
  { country: 'FR', code: '33' },
];

/** Client mirror of E.164's shape for a faster answer; the server's answer wins. */
const E164 = /^\+[1-9]\d{7,14}$/u;

interface Enrolment {
  factorId: string;
  challengeId: string;
  destination: string;
  masked?: string;
}

export default function WelcomeContact() {
  const t = useI18n((s) => s.t);
  const queryClient = useQueryClient();
  const { activeAccount } = useAccount();
  const me = useMe({ query: { queryKey: getMeQueryKey(), enabled: Boolean(activeAccount) } });
  const updateProfile = useUpdateProfile();
  const enroll = useEnrollSecondFactor();
  const confirm = useConfirmSecondFactor();
  const step = useWelcomeStep('contact');

  const [phone, setPhone] = useState('+55');
  // WhatsApp is the default: in this market a mobile number that is not on
  // WhatsApp is the exception, and the person unticks it in one gesture.
  const [whatsapp, setWhatsapp] = useState(true);
  const [enrolment, setEnrolment] = useState<Enrolment | null>(null);
  const [code, setCode] = useState('');
  const [sends, setSends] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<unknown>(null);
  const [sending, setSending] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  // Every enrolment request carries a generation; *correct my number* bumps
  // it, so a late answer for the old number is ignored.
  const generation = useRef(0);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current || !me.data) return;
    initialized.current = true;
    if (me.data.phone) {
      setPhone(me.data.phone);
      setWhatsapp(me.data.phone_whatsapp ?? true);
    }
  }, [me.data]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  const normalized = phone.replace(/[\s().-]/gu, '');
  const shapeOk = E164.test(normalized);
  const dial = DIAL_CODES.find((d) => normalized.startsWith(`+${d.code}`))?.code ?? '';

  function pickDial(code: string) {
    const current = DIAL_CODES.find((d) => normalized.startsWith(`+${d.code}`));
    const rest = current ? normalized.slice(current.code.length + 1) : normalized.replace(/^\+/u, '');
    setPhone(`+${code}${rest}`);
  }

  const busy = sending || confirm.isPending || step.pendingStatus !== null;

  async function sendCode(isResend: boolean) {
    if (busy) return;
    const mine = ++generation.current;
    setError(null);
    setSending(true);
    try {
      if (!isResend) {
        // The phone is saved BEFORE enrolment: a number typed and never
        // confirmed still lives on the profile; the reminder is the box's job.
        const updated = await updateProfile.mutateAsync({
          data: { phone: normalized, phone_whatsapp: whatsapp },
        });
        queryClient.setQueryData(getMeQueryKey(), updated);
      }
      const response = await enroll.mutateAsync({
        data: { kind: 'sms', destination: normalized, label: 'phone' },
      });
      if (mine !== generation.current) return;
      setEnrolment({
        factorId: response.factor.id,
        challengeId: response.challenge_id,
        destination: normalized,
        masked: response.factor.masked_destination,
      });
      setCode('');
      const next = sends + 1;
      setSends(next);
      setCooldown(resendDelaySeconds(next));
    } catch (failure) {
      if (mine !== generation.current) return;
      setError(failure);
      const wait = retryAfterSeconds(failure);
      if (wait !== null) setCooldown((c) => Math.max(c, wait));
    } finally {
      setSending(false);
    }
  }

  async function confirmCode() {
    if (!enrolment || busy) return;
    setError(null);
    if (!confirmed) {
      try {
        await confirm.mutateAsync({
          factorId: enrolment.factorId,
          data: { challenge_id: enrolment.challengeId, code },
        });
        setConfirmed(true);
      } catch (failure) {
        setError(failure);
        return;
      }
    }
    // Record first: refreshing the second-factor state can re-render the
    // gate above this screen, and the step must be written before that.
    const recorded = await step.record('done');
    if (recorded) {
      void queryClient.invalidateQueries({ queryKey: getSecondFactorStateQueryKey() });
      void queryClient.invalidateQueries({ queryKey: getMeQueryKey() });
    }
  }

  function correctNumber() {
    if (busy) return;
    generation.current += 1;
    setConfirmed(false);
    setEnrolment(null);
    setCode('');
    setError(null);
    enroll.reset();
    confirm.reset();
  }

  if (me.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }
  if (me.error) return <ApiErrorNotice error={me.error} onRetry={() => void me.refetch()} />;

  return (
    <div className="space-y-8">
      <StepHeader step="contact" title={t('welcome.contact.title')} lead={t('welcome.contact.lead')} />

      {!enrolment ? (
        <StepPanel className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="contact-phone">{t('welcome.contact.phone')}</Label>
            <div className="flex gap-2">
              <Select value={dial} onValueChange={pickDial}>
                <SelectTrigger className="w-28" aria-label={t('welcome.contact.country')} data-testid="select-dial-code">
                  <SelectValue placeholder="+" />
                </SelectTrigger>
                <SelectContent>
                  {DIAL_CODES.map((d) => (
                    <SelectItem key={d.country} value={d.code}>
                      {d.country} +{d.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                id="contact-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="flex-1 tabular-nums"
                data-testid="input-contact-phone"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {shapeOk || normalized.length < 4 ? t('welcome.contact.phoneHint') : t('welcome.contact.phoneShape')}
            </p>
            {me.data?.phone && !me.data.phone_verified ? (
              <p className="text-xs text-muted-foreground">
                {t('welcome.contact.savedUnverified', { phone: me.data.phone })}
              </p>
            ) : null}
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-muted/50 p-3" htmlFor="contact-whatsapp">
            <Checkbox
              id="contact-whatsapp"
              checked={whatsapp}
              onCheckedChange={(v) => setWhatsapp(v === true)}
              className="mt-0.5"
              data-testid="checkbox-contact-whatsapp"
            />
            <span className="space-y-0.5">
              <span className="block text-sm font-medium text-foreground">{t('welcome.contact.whatsapp')}</span>
              <span className="block text-xs text-muted-foreground">{t('welcome.contact.whatsappHint')}</span>
            </span>
          </label>
        </StepPanel>
      ) : (
        <StepPanel className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2">
            <p className="flex items-center gap-2 text-sm">
              <MessageSquareText className="h-4 w-4 text-primary" />
              {t('welcome.contact.sentTo')}{' '}
              <span className="font-medium tabular-nums">{enrolment.masked || enrolment.destination}</span>
            </p>
            <Button variant="ghost" size="sm" onClick={correctNumber} disabled={busy || confirmed} data-testid="button-correct-number">
              <Pencil />
              {t('welcome.contact.correct')}
            </Button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-code">{t('welcome.contact.code')}</Label>
            <InputOTP id="contact-code" maxLength={6} value={code} onChange={setCode} disabled={busy || confirmed} data-testid="input-contact-code">
              <InputOTPGroup>
                {Array.from({ length: 6 }, (_, i) => (
                  <InputOTPSlot key={i} index={i} className="h-11 w-11 text-base" />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void sendCode(true)}
              disabled={cooldown > 0 || busy || confirmed}
              data-testid="button-resend-code"
            >
              {sending ? <Loader2 className="animate-spin" /> : <RotateCw />}
              {cooldown > 0
                ? t('welcome.contact.resendIn', { s: cooldown })
                : t('welcome.contact.resend')}
            </Button>
            <span>{t('welcome.contact.notArrived')}</span>
          </div>
        </StepPanel>
      )}

      {error ? <ApiErrorNotice error={error} testId="status-contact-error" /> : null}

      <StepActions
        primaryLabel={enrolment ? t('welcome.contact.confirm') : t('welcome.contact.send')}
        onPrimary={() => void (enrolment ? confirmCode() : sendCode(false))}
        primaryPending={sending || confirm.isPending || step.pendingStatus === 'done'}
        primaryDisabled={enrolment ? !confirmed && code.length < 6 : !normalized || cooldown > 0}
        onSkip={() => {
          if (busy) return;
          generation.current += 1;
          void step.record('skipped');
        }}
        skipPending={step.pendingStatus === 'skipped'}
        error={step.error}
      />
    </div>
  );
}
