import { CheckCircle2, ExternalLink, FlaskConical, Loader2, SkipForward, XCircle } from 'lucide-react';
import { TestResult } from '../lib/api/types';
import { useI18n } from '../lib/i18n';

export function AllureReport({ tests }: { tests: TestResult[] }) {
  const { t } = useI18n();
  const total = tests.length;
  const passed = tests.filter(test => test.status === 'success').length;
  const failed = tests.filter(test => test.status === 'fail').length;
  const skipped = tests.filter(test => test.status === 'skipped').length;
  const running = tests.filter(test => test.status === 'running').length;
  const percentage = total > 0 ? Math.round((passed / total) * 100) : 0;

  return (
    <div className="max-w-4xl space-y-4 p-4 sm:p-5" data-testid="allure-report">
      <div className="flex items-start gap-3">
        <span className="rounded-md border border-purple-500/25 bg-purple-500/10 p-2">
          <FlaskConical className="h-4 w-4 text-purple-400" />
        </span>
        <div>
          <h2 className="text-sm font-semibold">{t('exec.tests.allureTitle')}</h2>
          <p className="mt-1 text-[10px] text-muted-foreground">{t('cockpit.overview.allureHint')}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[
          { label: t('test.status.passed'), value: passed, className: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' },
          { label: t('test.status.failed'), value: failed, className: 'border-red-500/20 bg-red-500/10 text-red-400' },
          { label: t('test.status.skipped'), value: skipped, className: 'border-border/40 bg-muted/30 text-muted-foreground' },
          { label: t('test.status.running'), value: running, className: 'border-primary/20 bg-primary/10 text-primary' },
          { label: t('exec.tests.successRate'), value: percentage, suffix: '%', className: 'border-yellow-500/20 bg-yellow-500/10 text-yellow-400' },
        ].map(metric => (
          <div key={metric.label} className={`rounded-lg border p-3 text-center ${metric.className}`} data-testid={`allure-metric-${metric.label}`}>
            <div className="text-2xl font-bold">{metric.value}{metric.suffix}</div>
            <div className="mt-0.5 text-[10px] text-muted-foreground">{metric.label}</div>
          </div>
        ))}
      </div>

      {tests.length === 0 ? (
        <div className="rounded-md border border-dashed border-border/50 px-3 py-10 text-center text-xs italic text-muted-foreground" data-testid="allure-empty">
          {t('cockpit.overview.allureEmpty')}
        </div>
      ) : (
        (['unit', 'e2e'] as const).map(type => {
          const typeTests = tests.filter(test => test.type === type);
          if (typeTests.length === 0) return null;
          return (
            <section key={type} className="overflow-hidden rounded-lg border border-border/40" data-testid={`allure-section-${type}`}>
              <div className="border-b border-border/40 bg-muted/25 px-3 py-2 text-xs font-bold">
                {type === 'unit' ? t('plan.tests.unit') : t('plan.tests.e2e')}
              </div>
              <div className="divide-y divide-border/20">
                {typeTests.map((test, index) => (
                  <div key={`${test.name}-${index}`} className={`flex items-center gap-2.5 px-3 py-2 ${test.status === 'fail' ? 'bg-red-500/5' : ''}`} data-testid={`allure-test-${type}-${index}`}>
                    {test.status === 'success' && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />}
                    {test.status === 'fail' && <XCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />}
                    {test.status === 'skipped' && <SkipForward className="h-3.5 w-3.5 shrink-0 text-muted-foreground/35" />}
                    {test.status === 'running' && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />}
                    <span className="min-w-0 flex-1 truncate text-[11px]">{test.name}</span>
                    {test.repo && <span className="shrink-0 font-mono text-[9px] text-muted-foreground">{test.repo}</span>}
                    {test.durationMs != null && <span className="shrink-0 font-mono text-[10px] text-muted-foreground/40">{test.durationMs}ms</span>}
                  </div>
                ))}
              </div>
            </section>
          );
        })
      )}

      <div className="flex items-center justify-center gap-2 rounded-lg border border-border/40 px-4 py-2.5 text-sm text-muted-foreground" data-testid="allure-full-report-link">
        <ExternalLink className="h-3.5 w-3.5" />
        {t('exec.tests.fullReport')}
        <span className="rounded bg-muted/50 px-1.5 py-0.5 text-[9px]">{t('exec.tests.soon')}</span>
      </div>
    </div>
  );
}