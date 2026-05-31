import React, { useState, useEffect, useRef } from 'react';
import { marked } from 'marked';
import { Eye, Code2, Pencil, Check, X, MessageSquare, Save } from 'lucide-react';

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

  // Update draft if content prop changes externally
  useEffect(() => { setDraft(content); }, [content]);

  // Render markdown
  useEffect(() => {
    const rendered = marked.parse(editing ? draft : content);
    if (typeof rendered === 'string') setHtml(rendered);
    else rendered.then(setHtml);
  }, [content, draft, editing, mode]);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (editing && mode === 'source') {
      textareaRef.current?.focus();
    }
  }, [editing, mode]);

  const handleEdit = () => {
    setMode('source');
    setEditing(true);
    setDraft(content);
  };

  const handleSave = () => {
    onSave?.(draft);
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(content);
    setEditing(false);
  };

  const handleChatRequest = () => {
    onChatRequest?.('/edit ');
  };

  return (
    <div className="flex flex-col rounded-lg border border-border/50 overflow-hidden bg-[#0f1117]">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border/40 bg-muted/20 shrink-0">
        {/* View toggle */}
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

        {/* Action buttons */}
        {!readOnly && !editing && (
          <>
            {onChatRequest && (
              <button
                onClick={handleChatRequest}
                title="Solicitar edição ao Claude via chat"
                className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded border border-border/40 text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/10 transition-colors"
              >
                <MessageSquare className="w-3 h-3" /> Editar via Claude
              </button>
            )}
            <button
              onClick={handleEdit}
              title="Editar manualmente"
              className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded border border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <Pencil className="w-3 h-3" /> Editar
            </button>
          </>
        )}

        {editing && (
          <>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 transition-colors"
            >
              <Save className="w-3 h-3" /> Salvar
            </button>
            <button
              onClick={handleCancel}
              className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded border border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <X className="w-3 h-3" /> Cancelar
            </button>
          </>
        )}
      </div>

      {/* Body */}
      {mode === 'preview' ? (
        <div
          className="flex-1 overflow-y-auto p-5 prose-doc"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          readOnly={!editing}
          spellCheck={false}
          className={`flex-1 resize-none p-4 font-mono text-[12px] leading-relaxed bg-[#0a0a0c] text-[#c8d3f5] focus:outline-none min-h-0 ${
            !editing ? 'cursor-default opacity-80' : ''
          }`}
        />
      )}
    </div>
  );
}
