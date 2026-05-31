import React, { useState, useEffect, useRef, useCallback } from 'react';
import { marked } from 'marked';
import { Eye, Code2, Pencil, X, MessageSquare, Save } from 'lucide-react';

interface DocViewerProps {
  content: string;
  readOnly?: boolean;
  onSave?: (newContent: string) => void;
  onChatRequest?: (prefill: string) => void;
}

marked.setOptions({ breaks: true, gfm: true });

export function DocViewer({ content, readOnly = false, onSave, onChatRequest }: DocViewerProps) {
  const [mode, setMode]       = useState<'preview' | 'source'>('preview');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(content);
  const [html, setHtml]       = useState('');
  const textareaRef           = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setDraft(content); }, [content]);

  useEffect(() => {
    const rendered = marked.parse(editing ? draft : content);
    if (typeof rendered === 'string') setHtml(rendered);
    else rendered.then(setHtml);
  }, [content, draft, editing, mode]);

  // Auto-resize textarea to fit content — no scrollbar inside
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    if (mode === 'source') autoResize();
  }, [mode, draft, autoResize]);

  useEffect(() => {
    if (editing && mode === 'source') textareaRef.current?.focus();
  }, [editing, mode]);

  const handleEdit = () => { setMode('source'); setEditing(true); setDraft(content); };
  const handleSave = () => { onSave?.(draft); setEditing(false); };
  const handleCancel = () => { setDraft(content); setEditing(false); };

  return (
    <div className="rounded-lg border border-border/50 overflow-hidden bg-[#0f1117]">

      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border/40 bg-muted/20">
        <div className="flex rounded-md overflow-hidden border border-border/40 text-[11px]">
          <button
            onClick={() => setMode('preview')}
            className={`flex items-center gap-1.5 px-2.5 py-1 transition-colors ${
              mode === 'preview'
                ? 'bg-primary/20 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
            }`}
          >
            <Eye className="w-3 h-3" /> Preview
          </button>
          <button
            onClick={() => setMode('source')}
            className={`flex items-center gap-1.5 px-2.5 py-1 transition-colors border-l border-border/40 ${
              mode === 'source'
                ? 'bg-primary/20 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
            }`}
          >
            <Code2 className="w-3 h-3" /> Fonte
          </button>
        </div>

        <div className="flex-1" />

        {!readOnly && !editing && (
          <>
            {onChatRequest && (
              <button
                onClick={() => onChatRequest?.('/edit ')}
                className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded border border-border/40 text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/10 transition-colors"
              >
                <MessageSquare className="w-3 h-3" /> Editar via Claude
              </button>
            )}
            <button
              onClick={handleEdit}
              className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded border border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <Pencil className="w-3 h-3" /> Editar
            </button>
          </>
        )}

        {editing && (
          <>
            <button onClick={handleSave} className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 transition-colors">
              <Save className="w-3 h-3" /> Salvar
            </button>
            <button onClick={handleCancel} className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded border border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
              <X className="w-3 h-3" /> Cancelar
            </button>
          </>
        )}
      </div>

      {/* Body — grows to fit content, no internal scroll */}
      {mode === 'preview' ? (
        <div
          className="p-5 prose-doc min-h-64"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={e => { setDraft(e.target.value); autoResize(); }}
          readOnly={!editing}
          spellCheck={false}
          rows={1}
          className={`w-full resize-none p-4 font-mono text-[12px] leading-relaxed bg-[#0a0a0c] text-[#c8d3f5] focus:outline-none overflow-hidden min-h-64 ${
            !editing ? 'cursor-default opacity-80' : ''
          }`}
        />
      )}
    </div>
  );
}
