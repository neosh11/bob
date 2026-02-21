import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

import type { Logger } from "pino";
import WebSocket from "ws";

import type { JsonRpcMessage, JsonRpcResponse, JsonRpcServerRequest } from "./protocol.js";

interface ClientOptions {
  codexBin: string;
  listenUrl: string;
  logger: Logger;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
  timeout: NodeJS.Timeout;
}

function toConnectUrl(listenUrl: string): string {
  const parsed = new URL(listenUrl);
  if (parsed.hostname === "0.0.0.0") {
    parsed.hostname = "127.0.0.1";
  }
  return parsed.toString();
}

function parseRawMessage(raw: WebSocket.RawData): JsonRpcMessage | null {
  const text = raw instanceof Buffer ? raw.toString("utf8") : String(raw);
  try {
    return JSON.parse(text) as JsonRpcMessage;
  } catch {
    return null;
  }
}

export class CodexJsonRpcClient {
  private readonly connectUrl: string;

  private child: ChildProcess | null = null;

  private socket: WebSocket | null = null;

  private startPromise: Promise<void> | null = null;

  private closing = false;

  private nextId = 1;

  private readonly pending = new Map<number, PendingRequest>();

  private readonly notificationHandlers = new Set<(method: string, params: unknown) => void>();

  constructor(private readonly options: ClientOptions) {
    this.connectUrl = toConnectUrl(options.listenUrl);
  }

  onNotification(handler: (method: string, params: unknown) => void): () => void {
    this.notificationHandlers.add(handler);
    return () => {
      this.notificationHandlers.delete(handler);
    };
  }

  async ensureStarted(): Promise<void> {
    if (!this.startPromise) {
      this.startPromise = this.startInternal();
    }
    await this.startPromise;
  }

  async request<T>(method: string, params: unknown): Promise<T> {
    await this.ensureStarted();
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new Error("Codex app-server is not connected.");
    }

    return this.sendRequest<T>(socket, method, params);
  }

  async notify(method: string, params: unknown): Promise<void> {
    await this.ensureStarted();
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new Error("Codex app-server is not connected.");
    }

    socket.send(
      JSON.stringify({
        jsonrpc: "2.0",
        method,
        params
      })
    );
  }

  private sendRequest<T>(socket: WebSocket, method: string, params: unknown): Promise<T> {
    const id = this.nextId;
    this.nextId += 1;

    const result = new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Codex app-server request timed out: ${method}`));
      }, 60_000);
      timeout.unref();
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject, timeout });
    });

    socket.send(
      JSON.stringify({
        jsonrpc: "2.0",
        id,
        method,
        params
      })
    );

    return result;
  }

  async close(): Promise<void> {
    this.closing = true;

    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Codex app-server client closed."));
    }
    this.pending.clear();

    const socket = this.socket;
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => resolve(), 500);
        timer.unref();
        socket.once("close", () => {
          clearTimeout(timer);
          resolve();
        });
        socket.close();
      });
    }
    this.socket = null;

    await this.terminateChild();

    this.startPromise = null;
    this.closing = false;
  }

  private async startInternal(): Promise<void> {
    let socket = await this.tryConnect(700);
    if (!socket) {
      this.spawnAppServer();
      socket = await this.waitForSocket(12_000);
    }

    this.attachSocket(socket);

    await this.sendRequest(socket, "initialize", {
      clientInfo: {
        name: "bob",
        title: "Bob",
        version: "0.1.0"
      },
      capabilities: {
        experimentalApi: false,
        optOutNotificationMethods: []
      }
    });
    socket.send(
      JSON.stringify({
        jsonrpc: "2.0",
        method: "initialized",
        params: {}
      })
    );
  }

  private spawnAppServer(): void {
    const child = spawn(this.options.codexBin, ["app-server", "--listen", this.options.listenUrl], {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env
    });

    child.stdout.on("data", (chunk: Buffer) => {
      this.options.logger.debug({ line: chunk.toString("utf8").trim() }, "codex app-server stdout");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      this.options.logger.warn({ line: chunk.toString("utf8").trim() }, "codex app-server stderr");
    });
    child.on("exit", (code, signal) => {
      this.options.logger.warn({ code, signal }, "codex app-server process exited");
      this.child = null;
      this.socket = null;
      this.startPromise = null;
    });

    this.child = child;
  }

  private async terminateChild(): Promise<void> {
    const child = this.child;
    if (!child) {
      return;
    }

    this.child = null;

    if (child.exitCode !== null || child.signalCode !== null) {
      return;
    }

    const exited = new Promise<void>((resolve) => {
      child.once("exit", () => resolve());
    });

    child.kill("SIGTERM");
    const killTimer = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGKILL");
      }
    }, 1_500);
    killTimer.unref();

    await exited;
    clearTimeout(killTimer);
  }

  private attachSocket(socket: WebSocket): void {
    this.socket = socket;

    socket.on("message", (raw: WebSocket.RawData) => {
      const message = parseRawMessage(raw);
      if (!message) {
        this.options.logger.warn("Received invalid JSON-RPC payload from app-server");
        return;
      }
      this.handleMessage(message);
    });
    socket.on("close", () => {
      if (!this.closing) {
        this.options.logger.warn("codex app-server websocket closed");
      }
      this.socket = null;
      this.startPromise = null;
    });
    socket.on("error", (error: Error) => {
      if (!this.closing) {
        this.options.logger.error({ error }, "codex app-server websocket error");
      }
    });
  }

  private handleMessage(message: JsonRpcMessage): void {
    if ("id" in message && typeof message.id === "number" && "method" in message) {
      this.handleServerRequest(message);
      return;
    }

    if ("id" in message && typeof message.id === "number") {
      const pending = this.pending.get(message.id);
      if (!pending) {
        return;
      }
      this.pending.delete(message.id);
      clearTimeout(pending.timeout);
      if ("error" in message && message.error) {
        pending.reject(new Error(message.error.message));
        return;
      }
      pending.resolve((message as JsonRpcResponse).result);
      return;
    }

    if ("method" in message) {
      const params = "params" in message ? message.params : undefined;
      for (const handler of this.notificationHandlers) {
        handler(message.method, params);
      }
    }
  }

  private handleServerRequest(message: JsonRpcServerRequest): void {
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    socket.send(
      JSON.stringify({
        jsonrpc: "2.0",
        id: message.id,
        error: {
          code: -32601,
          message: `Unsupported host callback: ${message.method}`
        }
      })
    );
  }

  private async waitForSocket(timeoutMs: number): Promise<WebSocket> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const socket = await this.tryConnect(450);
      if (socket) {
        return socket;
      }
      await sleep(150);
    }
    throw new Error(`Unable to connect to codex app-server at ${this.connectUrl}`);
  }

  private tryConnect(timeoutMs: number): Promise<WebSocket | null> {
    return new Promise((resolve) => {
      const socket = new WebSocket(this.connectUrl, { perMessageDeflate: false });
      let done = false;

      const finish = (value: WebSocket | null) => {
        if (done) {
          return;
        }
        done = true;
        resolve(value);
      };

      const timer = setTimeout(() => {
        socket.removeAllListeners();
        socket.close();
        finish(null);
      }, timeoutMs);
      timer.unref();

      socket.once("open", () => {
        clearTimeout(timer);
        finish(socket);
      });
      socket.once("error", () => {
        clearTimeout(timer);
        socket.removeAllListeners();
        socket.close();
        finish(null);
      });
    });
  }
}
