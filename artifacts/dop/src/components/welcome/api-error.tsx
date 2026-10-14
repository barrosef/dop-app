import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, RotateCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import {
  apiErrorDetail,
  apiErrorMessage,
  apiErrorStatus,
  remainingAttempts,
  retryAfterSeconds,
  stepNamedInError,
} from '@/lib/platform/api-error';
import { welcomePathFor } from '@/lib/platform/welcome';
import { stepLabel } from './step-copy';

/**
 * Renders what the API answered, as it answered. A 412 shows its `detail`;
 * when that names one of the API's steps, the step is linked.
 */
export function ApiErrorNotice({
  error,
  stepKeys,
  onRetry,
  testId = 'status-api-error',
}: {
  error: unknown;
  stepKeys?: readonly string[];
  onRetry?: () => void;
  testId?: string;
}) {
  const t = useI18n((s) => s.t);
  if (!error) return null;
  const status = apiErrorStatus(error);
  const detail = status === 412 ? apiErrorDetail(error) : null;
  const message = detail ?? apiErrorMessage(error, t('welcome.error.generic'));
  const attempts = remainingAttempts(error);
  const retryAfter = retryAfterSeconds(error);
  const named = stepKeys ? stepNamedInError(error, stepKeys) : null;

  return (
    <div
      role="alert"
      data-testid={testId}
      className="border-l-2 border-destructive bg-destructive/10 px-3 py-2.5 text-sm"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-[11px] uppercase tracking-wider text-destructive">
            {status === 412
              ? t('welcome.error.refused')
              : t('welcome.error.title')}
            {status ? <span className="ml-2 font-mono tabular-nums">{status}</span> : null}
          </p>
          <p className="text-foreground" data-testid={`${testId}-message`}>{message}</p>
          {attempts !== null ? (
            <p className="font-mono text-xs tabular-nums text-muted-foreground">
              {t('welcome.error.attempts', { n: attempts })}
            </p>
          ) : null}
          {retryAfter !== null ? (
            <p className="font-mono text-xs tabular-nums text-muted-foreground">
              {t('welcome.error.retryAfter', { s: retryAfter })}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-1">
            {named ? (
              <Button asChild size="sm" variant="outline" data-testid="link-error-step">
                <Link to={welcomePathFor(named)}>
                  {t('welcome.error.goToStep', { step: stepLabel(t, named) })}
                  <ArrowRight />
                </Link>
              </Button>
            ) : null}
            {onRetry ? (
              <Button size="sm" variant="ghost" onClick={onRetry} data-testid="button-error-retry">
                <RotateCw />
                {t('welcome.error.retry')}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
