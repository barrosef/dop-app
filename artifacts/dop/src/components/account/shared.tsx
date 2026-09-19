import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useI18n } from '../../lib/i18n';

export function Refused({ error }: { error: Error }) {
  const t = useI18n((s) => s.t);
  const status = (error as { status?: number }).status;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive break-words">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="min-w-0 break-words">
        {status === 403
          ? t('account.onlyManagers')
          : t('account.error', { reason: error.message })}
      </p>
    </div>
  );
}

export function SectionHeading({ children, icon }: { children: React.ReactNode; icon: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight mb-4">
      <span className="text-primary">{icon}</span>
      {children}
    </h2>
  );
}

export function MutationFeedback({
  pending,
  success,
  error,
}: {
  pending?: boolean;
  success?: boolean;
  error?: string;
}) {
  const t = useI18n((s) => s.t);
  if (error) return <p className="mt-2 text-sm text-destructive break-words" role="alert">{error}</p>;
  if (pending) return <p role="status" className="mt-2 text-sm text-muted-foreground">{t('account.feedback.pending')}</p>;
  if (success) return <p className="mt-2 text-sm text-foreground" role="status">{t('account.feedback.success')}</p>;
  return null;
}
