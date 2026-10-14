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
        variant="outline"
        size="sm"
        onClick={() => check.mutate({ resourceId })}
        disabled={check.isPending}
        className={cn('w-full', compact && 'sm:w-auto')}
        data-testid={`button-check-${resourceId}`}
      >
        {check.isPending ? <Loader2 className="animate-spin" /> : <Activity />}
        {t('welcome.check.test')}
      </Button>
      {check.error ? <ApiErrorNotice error={check.error} testId="status-check-error" /> : null}
      {result ? (
        <div
          className={cn(
            'space-y-1 rounded-md px-3 py-2 text-xs',
            !result.operated && 'bg-muted text-muted-foreground',
            result.operated && result.ok && 'bg-primary/10 text-foreground',
            result.operated && !result.ok && 'bg-destructive/10 text-foreground',
          )}
          data-testid="status-check-result"
        >
          <p className="font-medium">
            {!result.operated
              ? t('welcome.check.notOperated')
              : result.ok
                ? t('welcome.check.ok')
                : t('welcome.check.failed')}
          </p>
          {result.identity ? (
            <p className="text-muted-foreground">
              {t('welcome.check.identity')} <span className="font-medium text-foreground">{result.identity}</span>
            </p>
          ) : null}
          {result.message ? <p className="text-muted-foreground">{result.message}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
