import { ConnectionStep } from '@/components/welcome/connection-step';
import { StepActions, StepHeader } from '@/components/welcome/step-frame';
import { useI18n } from '@/lib/i18n';
import { useWelcomeStep } from '@/hooks/use-welcome-step';

/** Where your code lives — required. The API refuses `done` with no git connection. */
export default function WelcomeCode() {
  const t = useI18n((s) => s.t);
  const step = useWelcomeStep('code');
  return (
    <div className="space-y-8">
      <StepHeader step="code" title={t('welcome.code.title')} lead={t('welcome.code.lead')} />
      <ConnectionStep category="git">
        {(connections) => (
          <StepActions
            primaryLabel={
              connections > 0
                ? t('welcome.code.primaryWith', { n: connections })
                : t('welcome.code.primary')
            }
            onPrimary={() => void step.record('done')}
            primaryPending={step.pendingStatus === 'done'}
            onSkip={() => void step.record('skipped')}
            skipPending={step.pendingStatus === 'skipped'}
            error={step.error}
          />
        )}
      </ConnectionStep>
    </div>
  );
}
