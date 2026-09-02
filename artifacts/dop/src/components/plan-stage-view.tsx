import { useI18n } from '../lib/i18n';
import { useState, useEffect, useRef, useCallback } from 'react';
import { marked } from 'marked';
import {
  FileText, FlaskConical, Eye, Code2, Pencil, X,
  MessageSquare, Save, Plus, ChevronDown, ChevronRight
} from 'lucide-react';
import { DocViewer } from './doc-viewer';

marked.setOptions({ breaks: true, gfm: true });

const UNIT_ITEM_TEMPLATE =
`\n### \`FunctionName\`
- **Arrange**: a description of the initial state / the mocks needed
- **Act**: the action executed (a function or method call)
- **Assert**: the expected result or side effect
`;

const E2E_ITEM_TEMPLATE =
`\n### Scenario: the scenario's title
- **Given that** the system's initial state / the context
- **When** the action is performed by the user
- **Then** the observable result expected in the UI or the API
`;

interface TestPlanSectionProps {
  title: string;
  icon: React.ReactNode;
  content: string;
  itemTemplate: string;
  onSave: (v: string) => void;
  onChatRequest: () => void;
}

function TestPlanSection({ title, icon, content, itemTemplate, onSave, onChatRequest }: TestPlanSectionProps) {
  const { t } = useI18n();
  const [mode, setMode]       = useState<'preview' | 'source'>('preview');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(content);
  const [html, setHtml]       = useState('');
  const [open, setOpen]       = useState(true);
  const textareaRef           = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (!editing) setDraft(content); }, [content, editing]);

  useEffect(() => {
    const rendered = marked.parse(editing ? draft : content);
    if (typeof rendered === 'string') setHtml(rendered);
    else rendered.then(setHtml);
  }, [content, draft, editing, mode]);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => { if (mode === 'source') autoResize(); }, [mode, draft, autoResize]);
  useEffect(() => { if (editing && mode === 'source') textareaRef.current?.focus(); }, [editing, mode]);

  const handleEdit   = () => { setMode('source'); setEditing(true); setDraft(content); };
  const handleSave   = () => { onSave(draft); setEditing(false); };
  const handleCancel = () => { setDraft(content); setEditing(false); };
  const handleAdd    = () => {
    const next = (editing ? draft : content) + itemTemplate;
    setDraft(next);
    setMode('source');
    setEditing(true);
    setTimeout(autoResize, 20);
  };

  return (
    <div className="rounded-lg border border-border/40 overflow-hidden">
      {/* Section header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2.5 bg-muted/25 hover:bg-muted/35 transition-colors text-left"
      >
        {open ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
               : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
        {icon}
        <span className="text-xs font-bold flex-1">{title}</span>
      </button>

      {open && (
        <>
          {/* Toolbar */}
          <div className="flex items-center gap-1 px-3 py-1.5 border-t border-border/30 border-b border-border/40 bg-muted/15">
            <div className="flex rounded-md overflow-hidden border border-border/40 text-[11px]">
              <button
                onClick={() => setMode('preview')}
                className={`flex items-center gap-1.5 px-2.5 py-1 transition-colors ${
                  mode === 'preview' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                }`}
              >
                <Eye className="w-3 h-3" /> {t('plan.action.preview') || 'Preview'}
              </button>
              <button
                onClick={() => setMode('source')}
                className={`flex items-center gap-1.5 px-2.5 py-1 transition-colors border-l border-border/40 ${
                  mode === 'source' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                }`}
              >
                <Code2 className="w-3 h-3" /> {t('plan.action.source') || 'Fonte'}
              </button>
            </div>

            <div className="flex-1" />

            {!editing && (
              <>
                <button
                  onClick={onChatRequest}
                  className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded border border-border/40 text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/10 transition-colors"
                >
                  <MessageSquare className="w-3 h-3" /> {t('plan.action.chat') || 'Via Claude'}
                </button>
                <button
                  onClick={handleEdit}
                  className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded border border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                >
                  <Pencil className="w-3 h-3" /> {t('plan.action.edit')}
                </button>
                <button
                  onClick={handleAdd}
                  className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded border border-primary/40 text-primary hover:bg-primary/10 transition-colors"
                >
                  <Plus className="w-3 h-3" /> {t('plan.action.add')}
                </button>
              </>
            )}

            {editing && (
              <>
                <button
                  onClick={handleAdd}
                  className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded border border-primary/40 text-primary hover:bg-primary/10 transition-colors"
                >
                  <Plus className="w-3 h-3" /> {t('plan.action.add')}
                </button>
                <button
                  onClick={handleSave}
                  className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                >
                  <Save className="w-3 h-3" /> {t('plan.action.save')}
                </button>
                <button
                  onClick={handleCancel}
                  className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded border border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                >
                  <X className="w-3 h-3" /> {t('plan.action.cancel')}
                </button>
              </>
            )}
          </div>

          {/* Body */}
          {mode === 'preview' ? (
            <div className="p-5 prose-doc min-h-32 bg-[#0f1117]" dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={e => { setDraft(e.target.value); autoResize(); }}
              readOnly={!editing}
              spellCheck={false}
              rows={1}
              className={`w-full resize-none p-4 font-mono text-[12px] leading-relaxed bg-[#0a0a0c] text-[#c8d3f5] focus:outline-none overflow-hidden min-h-32 ${
                !editing ? 'cursor-default opacity-80' : ''
              }`}
            />
          )}
        </>
      )}
    </div>
  );
}

export interface TestPlan {
  unit: string;
  e2e: string;
}

interface PlanStageViewProps {
  document: string | undefined;
  testPlan: TestPlan;
  onDocSave: (content: string) => void;
  onDocChatRequest: () => void;
  onTestPlanSave: (type: 'unit' | 'e2e', content: string) => void;
  onTestPlanChatRequest: (type: 'unit' | 'e2e') => void;
}

type PlanTab = 'plan' | 'tests';

export function PlanStageView({
  document,
  testPlan,
  onDocSave,
  onDocChatRequest,
  onTestPlanSave,
  onTestPlanChatRequest,
}: PlanStageViewProps) {
  const { t } = useI18n();
  const [tab, setTab] = useState<PlanTab>('plan');

  return (
    <div className="space-y-3">
      {/* Tab bar */}
      <div className="flex border-b border-border/40">
        {([
          { key: 'plan'  as PlanTab, Icon: FileText,    label: t('plan.tab.impl') || 'Implementation plan' },
          { key: 'tests' as PlanTab, Icon: FlaskConical, label: t('plan.tab.tests') || 'Test plan'              },
        ]).map(({ key, Icon, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
              tab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {/* ── The implementation plan ── */}
      {tab === 'plan' && (
        document ? (
          <DocViewer
            content={document}
            onSave={onDocSave}
            onChatRequest={onDocChatRequest}
          />
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground italic py-4">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
            {t('plan.generating') || 'Claude is generating the implementation plan…'}
          </div>
        )
      )}

      {/* ── The test plan ── */}
      {tab === 'tests' && (
        <div className="space-y-3">
          <TestPlanSection
            title={t('plan.tests.unit') || "Unit tests (AAA)"}
            icon={<FlaskConical className="w-3.5 h-3.5 text-purple-400 shrink-0" />}
            content={testPlan.unit}
            itemTemplate={UNIT_ITEM_TEMPLATE}
            onSave={content => onTestPlanSave('unit', content)}
            onChatRequest={() => onTestPlanChatRequest('unit')}
          />
          <TestPlanSection
            title={t('plan.tests.e2e') || "E2E tests"}
            icon={<span className="text-sm leading-none shrink-0">🌐</span>}
            content={testPlan.e2e}
            itemTemplate={E2E_ITEM_TEMPLATE}
            onSave={content => onTestPlanSave('e2e', content)}
            onChatRequest={() => onTestPlanChatRequest('e2e')}
          />
        </div>
      )}
    </div>
  );
}
