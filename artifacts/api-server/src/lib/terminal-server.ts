import { existsSync, realpathSync, statSync } from "node:fs";
import type { IncomingMessage } from "node:http";
import type { Server } from "node:http";
import path from "node:path";
import { spawn, type IPty } from "node-pty";
import { WebSocket, WebSocketServer } from "ws";
import { logger } from "./logger";

const TERMINAL_PATH = "/api/terminal";
const MAX_SESSIONS = 4;
const IDLE_TIMEOUT_MS = 20 * 60 * 1000;
const MAX_INPUT_LENGTH = 16 * 1024;
const MAX_MESSAGE_SIZE = MAX_INPUT_LENGTH + 1024;
const identifierPattern = /^[a-zA-Z0-9._:-]{1,96}$/;

type TerminalMessage =
  | { type: "input"; data: string }
  | { type: "resize"; cols: number; rows: number }
  | { type: "close" };

type TerminalSession = {
  pty: IPty;
  socket: WebSocket;
  resourceId: string;
  idleTimer: NodeJS.Timeout;
  closed: boolean;
};

function send(socket: WebSocket, payload: object) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
}

function safeNumber(value: number, fallback: number, maximum: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(Math.floor(value), maximum));
}

function getTerminalRoot() {
  const configuredRoot = process.env.DOP_TERMINAL_ROOT;
  if (!configuredRoot) {
    const serverRoot = process.cwd();
    logger.warn({ serverRoot }, "DOP_TERMINAL_ROOT is not set; using the API server working directory");
    if (!existsSync(serverRoot) || !statSync(serverRoot).isDirectory()) {
      throw new Error("The API server working directory is unavailable.");
    }
    return realpathSync(serverRoot);
  }
  const resolvedRoot = path.resolve(configuredRoot);

  if (!existsSync(resolvedRoot) || !statSync(resolvedRoot).isDirectory()) {
    throw new Error("The configured terminal workspace directory is unavailable.");
  }

  return realpathSync(resolvedRoot);
}

function parseConnection(request: IncomingMessage) {
  const url = new URL(request.url ?? "", "http://terminal.local");
  const workspaceId = url.searchParams.get("workspaceId") ?? "";
  const resourceId = url.searchParams.get("resourceId") ?? "";
  const resourceName = url.searchParams.get("resourceName") ?? "";

  if (![workspaceId, resourceId, resourceName].every(value => identifierPattern.test(value))) {
    throw new Error("Invalid terminal resource.");
  }

  return { workspaceId, resourceId, resourceName };
}

function isSameOrigin(request: IncomingMessage) {
  const origin = request.headers.origin;
  const requestHost = request.headers.host;
  if (!origin || !requestHost) return false;

  try {
    const originHost = new URL(origin).host;
    return originHost === requestHost;
  } catch {
    return false;
  }
}

function parseTerminalMessage(value: unknown): TerminalMessage | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const message = value as Record<string, unknown>;

  if (message.type === "close") return { type: "close" };
  if (message.type === "input" && typeof message.data === "string") {
    return { type: "input", data: message.data };
  }
  if (message.type === "resize" && typeof message.cols === "number" && typeof message.rows === "number") {
    return { type: "resize", cols: message.cols, rows: message.rows };
  }
  return null;
}

function terminalEnvironment(connection: ReturnType<typeof parseConnection>) {
  const inherited = process.env;
  return {
    HOME: inherited.HOME,
    LANG: inherited.LANG ?? "en_US.UTF-8",
    PATH: inherited.PATH,
    SHELL: inherited.SHELL ?? "/bin/bash",
    TERM: "xterm-256color",
    COLORTERM: "truecolor",
    DOP_WORKSPACE_ID: connection.workspaceId,
    DOP_RESOURCE_ID: connection.resourceId,
    DOP_RESOURCE_NAME: connection.resourceName,
  };
}

export function attachTerminalServer(server: Server) {
  const webSocketServer = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_SIZE });
  const sessions = new Set<TerminalSession>();

  const closeSession = (session: TerminalSession, reason?: string) => {
    if (session.closed) return;
    session.closed = true;
    clearTimeout(session.idleTimer);
    sessions.delete(session);
    try {
      session.pty.kill();
    } catch {
      // The PTY may have exited before the browser disconnected.
    }
    if (reason) send(session.socket, { type: "error", message: reason });
    if (session.socket.readyState === WebSocket.OPEN) session.socket.close();
    logger.info({ resourceId: session.resourceId, activeSessions: sessions.size }, "Terminal session closed");
  };

  const refreshIdleTimer = (session: TerminalSession) => {
    clearTimeout(session.idleTimer);
    session.idleTimer = setTimeout(() => {
      closeSession(session, "Terminal session closed after 20 minutes of inactivity.");
    }, IDLE_TIMEOUT_MS);
    session.idleTimer.unref();
  };

  webSocketServer.on("connection", (socket: WebSocket, request: IncomingMessage) => {
    if (process.env.NODE_ENV === "production") {
      send(socket, { type: "error", message: "Live terminal sessions are only available in the development environment." });
      socket.close();
      return;
    }

    if (!isSameOrigin(request)) {
      logger.warn("Rejected terminal connection with invalid origin");
      socket.close();
      return;
    }

    let connection: ReturnType<typeof parseConnection>;
    let terminalRoot: string;
    try {
      connection = parseConnection(request);
      terminalRoot = getTerminalRoot();
    } catch (error) {
      send(socket, { type: "error", message: error instanceof Error ? error.message : "Unable to create terminal session." });
      socket.close();
      return;
    }

    if (sessions.size >= MAX_SESSIONS) {
      send(socket, { type: "error", message: "The terminal session limit has been reached. Close another terminal and try again." });
      socket.close();
      return;
    }

    let pty: IPty;
    try {
      pty = spawn(process.env.SHELL || "/bin/bash", ["-i"], {
        name: "xterm-256color",
        cols: 100,
        rows: 28,
        cwd: terminalRoot,
        env: terminalEnvironment(connection),
      });
    } catch (error) {
      logger.error({ err: error, resourceId: connection.resourceId }, "Unable to spawn terminal PTY");
      send(socket, { type: "error", message: "Unable to create the shell session." });
      socket.close();
      return;
    }

    const session: TerminalSession = {
      pty,
      socket,
      resourceId: connection.resourceId,
      idleTimer: setTimeout(() => undefined, IDLE_TIMEOUT_MS),
      closed: false,
    };
    sessions.add(session);
    refreshIdleTimer(session);
    logger.info({ resourceId: connection.resourceId, workspaceId: connection.workspaceId, activeSessions: sessions.size }, "Terminal session opened");
    send(socket, { type: "ready", cwd: terminalRoot, resourceName: connection.resourceName });

    pty.onData(data => {
      refreshIdleTimer(session);
      send(socket, { type: "output", data });
    });
    pty.onExit(({ exitCode, signal }) => {
      if (!session.closed) {
        session.closed = true;
        clearTimeout(session.idleTimer);
        sessions.delete(session);
        send(socket, { type: "exit", exitCode, signal });
        if (socket.readyState === WebSocket.OPEN) socket.close();
        logger.info({ resourceId: session.resourceId, exitCode, signal, activeSessions: sessions.size }, "Terminal process exited");
      }
    });

    socket.on("message", (raw, isBinary) => {
      if (isBinary) {
        closeSession(session, "Terminal messages must be text.");
        return;
      }

      let message: TerminalMessage | null;
      try {
        message = parseTerminalMessage(JSON.parse(raw.toString()));
      } catch {
        closeSession(session, "Malformed terminal message.");
        return;
      }
      if (!message) {
        closeSession(session, "Unsupported terminal message.");
        return;
      }

      refreshIdleTimer(session);
      if (message.type === "close") {
        closeSession(session);
        return;
      }
      if (message.type === "input" && typeof message.data === "string") {
        if (message.data.length > MAX_INPUT_LENGTH) {
          closeSession(session, "Terminal input is too large.");
          return;
        }
        pty.write(message.data);
        return;
      }
      if (message.type === "resize") {
        pty.resize(safeNumber(message.cols, 100, 300), safeNumber(message.rows, 28, 120));
        return;
      }

    });
    socket.on("close", () => closeSession(session));
    socket.on("error", error => logger.warn({ err: error, resourceId: session.resourceId }, "Terminal WebSocket error"));
  });

  server.on("upgrade", (request, socket, head) => {
    let isTerminalRequest = false;
    try {
      isTerminalRequest = new URL(request.url ?? "", "http://terminal.local").pathname === TERMINAL_PATH;
    } catch {
      isTerminalRequest = false;
    }
    if (!isTerminalRequest || !isSameOrigin(request)) {
      socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    webSocketServer.handleUpgrade(request, socket, head, client => {
      webSocketServer.emit("connection", client, request);
    });
  });

  logger.info({ path: TERMINAL_PATH }, "Terminal WebSocket server attached");
}