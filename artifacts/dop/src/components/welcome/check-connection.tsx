import { Activity, Loader2 } from 'lucide-react';
import { useCheckResource } from '@workspace/api-client-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { ApiErrorNotice } from './api-error';

/**
 * *Test connection*: asks the API and renders `operated`, `ok`, `identity`
 * and `message` as they came. A non-operated provider is an honest answer.
 */
export function CheckConnection({ resourceId, compact = false }: { resourceId: string; compact?: boolean }) {
  const t = useI18n((s) => s.t);
  const check = useCheckResource();
  const result = check.data;

  return (
    <div className="space-y-2">
      <Button
        variant={compact ? 'ghost' : 'outline'}
        size="sm"
        onClick={() => check.mutate({ resourceId })}
        disabled={check.isPending}
        className={cn(!compact && 'w-full')}
        data-testid={`button-check-${resourceId}`}
      >
        {check.isPending ? <Loader2 className="animate-spin" /> : <Activity />}
        {t('welcome.check.test')}
      </Button>
      {check.error ? <ApiErrorNotice error={check.error} testId="status-check-error" /> : null}
      {result ? (
        <div
          className={cn(
            'space-y-1 border-l-2 px-3 py-2 text-xs',
            !result.operated && 'border-muted-foreground/50 bg-muted/40',
            result.operated && result.ok && 'border-primary bg-primary/10',
            result.operated && !result.ok && 'border-destructive bg-destructive/10',
          )}
          data-testid="status-check-result"
        >
          <p className="font-medium text-foreground">
            {!result.operated
              ? t('welcome.check.notOperated')
              : result.ok
                ? t('welcome.check.ok')
                : t('welcome.check.failed')}
          </p>
          {result.identity ? (
            <p className="text-muted-foreground">
              {t('welcome.check.identity')} <span className="font-mono text-foreground">{result.identity}</span>
            </p>
          ) : null}
          {result.message ? <p className="text-muted-foreground">{result.message}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
