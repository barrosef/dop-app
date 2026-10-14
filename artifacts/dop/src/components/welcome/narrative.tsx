import { useI18n } from '@/lib/i18n';
import { narrativeFor } from './step-copy';

/** What this step is, what the platform does with it, what skipping costs. */
export function Narrative({ step }: { step: string }) {
  const t = useI18n((s) => s.t);
  const keys = narrativeFor(step);
  if (!keys) return null;
  const parts: { label: string; body: string }[] = [
    { label: t('welcome.narrative.label.what'), body: t(keys.what) },
    { label: t('welcome.narrative.label.does'), body: t(keys.does) },
  ];
  if (keys.skip) parts.push({ label: t('welcome.narrative.label.skip'), body: t(keys.skip) });

  return (
    <dl className="space-y-5" data-testid={`narrative-${step}`}>
      {parts.map((part, i) => (
        <div
          key={part.label}
          className="animate-in fade-in slide-in-from-bottom-1 fill-mode-both duration-500"
          style={{ animationDelay: `${i * 90}ms` }}
        >
          <dt className="mb-1.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            <span className="tabular-nums">{String(i + 1).padStart(2, '0')}</span>
            <span className="h-px w-4 bg-border" aria-hidden="true" />
            {part.label}
          </dt>
          <dd className="text-[13px] leading-relaxed text-foreground/85">{part.body}</dd>
        </div>
      ))}
    </dl>
  );
}
