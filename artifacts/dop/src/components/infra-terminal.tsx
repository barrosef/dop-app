import { useEffect, useRef, useState } from 'react';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { useI18n } from '../lib/i18n';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

type ServerMessage =
  | { type: 'ready'; cwd: string; resourceName: string }
  | { type: 'output'; data: string }
  | { type: 'exit'; exitCode: number; signal?: number }
  | { type: 'error'; message: string };

function terminalSocketUrl(workspaceId: string, resourceId: string, resourceName: string) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const params = new URLSearchParams({ workspaceId, resourceId, resourceName });
  return `${protocol}//${window.location.host}/api/terminal?${params.toString()}`;
}

export function InfraTerminal({
  workspaceId,
  resourceId,
  resourceName,
}: {
  workspaceId: string;
  resourceId: string;
  resourceName: string;
}) {
  const { t } = useI18n();
  const terminalElementRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [statusDetail, setStatusDetail] = useState('');

  useEffect(() => {
    const element = terminalElementRef.current;
    if (!element) return;

    let disposed = false;
    let opened = false;
    let hadServerError = false;
    const terminal = new Terminal({
      convertEol: true,
      cursorBlink: true,
      cursorStyle: 'block',
      fontFamily: '"JetBrains Mono", "SFMono-Regular", Consolas, monospace',
      fontSize: 13,
      lineHeight: 1.25,
      scrollback: 4000,
      theme: {
        background: '#0a0d12',
        foreground: '#d5dde8',
        cursor: '#60a5fa',
        selectionBackground: '#1d4ed866',
        black: '#111827',
        brightBlack: '#64748b',
        green: '#4ade80',
        brightGreen: '#86efac',
        blue: '#60a5fa',
        brightBlue: '#93c5fd',
        red: '#f87171',
        brightRed: '#fca5a5',
        yellow: '#facc15',
        brightYellow: '#fde047',
      },
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(element);
    terminal.writeln('\x1b[90mConnecting to interactive shell…\x1b[0m');

    const send = (socket: WebSocket, message: object) => {
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
    };
    const fit = (socket?: WebSocket) => {
      try {
        fitAddon.fit();
        if (socket) send(socket, { type: 'resize', cols: terminal.cols, rows: terminal.rows });
      } catch {
        // The terminal can be temporarily hidden while its parent changes tabs.
      }
    };

    const socket = new WebSocket(terminalSocketUrl(workspaceId, resourceId, resourceName));
    const resizeObserver = new ResizeObserver(() => fit(socket));
    resizeObserver.observe(element);
    const dataSubscription = terminal.onData(data => send(socket, { type: 'input', data }));

    socket.addEventListener('open', () => {
      if (disposed) return;
      opened = true;
      setStatus('connected');
      setStatusDetail('');
      fit(socket);
      terminal.focus();
    });
    socket.addEventListener('message', event => {
      if (typeof event.data !== 'string') return;
      let message: ServerMessage;
      try {
        message = JSON.parse(event.data) as ServerMessage;
      } catch {
        return;
      }

      if (message.type === 'output') terminal.write(message.data);
      if (message.type === 'ready') {
        terminal.writeln(`\x1b[90mConnected to ${message.resourceName} · ${message.cwd}\x1b[0m`);
      }
      if (message.type === 'exit') {
        terminal.writeln(`\r\n\x1b[90mShell exited (${message.exitCode}).\x1b[0m`);
        setStatus('disconnected');
      }
      if (message.type === 'error') {
        hadServerError = true;
        terminal.writeln(`\r\n\x1b[31m${message.message}\x1b[0m`);
        setStatus('error');
        setStatusDetail(message.message);
      }
    });
    socket.addEventListener('close', () => {
      if (!disposed && !hadServerError) setStatus(opened ? 'disconnected' : 'error');
    });
    socket.addEventListener('error', () => {
      if (!disposed) {
        setStatus('error');
        setStatusDetail(t('cockpit.infrastructure.terminalConnectionError'));
      }
    });

    requestAnimationFrame(() => fit(socket));
    return () => {
      disposed = true;
      resizeObserver.disconnect();
      dataSubscription.dispose();
      if (socket.readyState === WebSocket.OPEN) send(socket, { type: 'close' });
      socket.close();
      terminal.dispose();
    };
  }, [resourceId, resourceName, workspaceId]);

  const statusCopy: Record<ConnectionStatus, string> = {
    connecting: t('cockpit.infrastructure.terminalConnecting'),
    connected: t('cockpit.infrastructure.terminalConnected'),
    disconnected: t('cockpit.infrastructure.terminalDisconnected'),
    error: statusDetail || t('cockpit.infrastructure.terminalConnectionError'),
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#0a0d12]" data-testid="infra-terminal-panel">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/40 px-3 py-2 text-[10px]">
        <span className="flex min-w-0 items-center gap-2 text-muted-foreground" aria-live="polite" data-testid="infra-terminal-status">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${status === 'connected' ? 'bg-emerald-400' : status === 'error' ? 'bg-red-400' : status === 'connecting' ? 'animate-pulse bg-amber-400' : 'bg-muted-foreground'}`} />
          <span className="truncate">{statusCopy[status]}</span>
        </span>
        <span className="shrink-0 text-[9px] text-muted-foreground">{t('cockpit.infrastructure.terminalServerWarning')}</span>
      </div>
      <div ref={terminalElementRef} onClick={() => terminalElementRef.current?.querySelector('textarea')?.focus()} className="min-h-0 flex-1 overflow-hidden p-2 sm:p-3" data-testid="infra-web-terminal" />
    </div>
  );
}