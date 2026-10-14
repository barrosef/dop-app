import { ConnectionStep } from '@/components/welcome/connection-step';
import { StepActions, StepHeader } from '@/components/welcome/step-frame';
import { useI18n } from '@/lib/i18n';
import { useWelcomeStep } from '@/hooks/use-welcome-step';

/** Where your cards live — optional. */
export default function WelcomeTasks() {
  const t = useI18n((s) => s.t);
  const step = useWelcomeStep('tasks');
  return (
    <div className="space-y-8">
      <StepHeader step="tasks" title={t('welcome.tasks.title')} lead={t('welcome.tasks.lead')} />
      <ConnectionStep category="task_manager">
        {(connections) => (
          <StepActions
            primaryLabel={
              connections > 0
                ? t('welcome.tasks.primaryWith', { n: connections })
                : t('welcome.tasks.primary')
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
