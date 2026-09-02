/**
 * The start screen: the attention box taking the centre.
 *
 * "Zero screens before the work" (the navigation-and-cockpit spec §1): what
 * opens the session is the queue of "where am I needed", not a catalogue of
 * workspaces. The tree stays in the sidebar, on the left, to choose the scope
 * when the dev wants to navigate rather than to answer.
 */
import React from 'react';

import { AttentionList } from '../components/platform/attention-box';
import { useI18n } from '../lib/i18n';

export default function Start() {
  const t = useI18n((s) => s.t);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold tracking-tight">
          {t('start.title')}
        </h1>
        <p className="text-xs text-muted-foreground">{t('start.subtitle')}</p>
      </div>
      <div className="mx-auto min-h-0 w-full max-w-3xl flex-1 overflow-hidden">
        <AttentionList />
      </div>
    </div>
  );
}
