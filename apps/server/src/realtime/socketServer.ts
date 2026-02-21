import type { Server as HttpServer } from "node:http";

import cookie from "cookie";
import { Server as SocketIOServer } from "socket.io";

import { verifyAuthToken } from "../auth/jwt.js";
import type { AppConfig } from "../config/env.js";
import type { RunNotification } from "../agent/types.js";
import { isCorsOriginAllowed } from "../security/corsOriginPolicy.js";

function userRoom(userId: string): string {
  return `user:${userId}`;
}

export interface RealtimeGateway {
  emitRunEvent(userId: string, event: RunNotification): void;
  close(): Promise<void>;
}

export function createRealtimeGateway(server: HttpServer, config: AppConfig): RealtimeGateway {
  const io = new SocketIOServer(server, {
    cors: {
      origin(origin, callback) {
        callback(null, isCorsOriginAllowed(origin, config));
      },
      credentials: true
    }
  });

  io.use((socket, next) => {
    const header = socket.handshake.headers.cookie;
    const cookies = cookie.parse(header ?? "");
    const tokenFromCookie = cookies[config.cookieName];
    const tokenFromAuth = typeof socket.handshake.auth?.token === "string" ? socket.handshake.auth.token : null;
    const token = tokenFromCookie ?? tokenFromAuth;

    if (!token) {
      next(new Error("Unauthorized"));
      return;
    }

    const claims = verifyAuthToken(token, config.jwtSecret);
    if (!claims) {
      next(new Error("Unauthorized"));
      return;
    }

    socket.data.userId = claims.userId;
    next();
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId as string;
    void socket.join(userRoom(userId));
  });

  return {
    emitRunEvent(userId, event) {
      io.to(userRoom(userId)).emit("run:event", event);
    },
    close() {
      io.disconnectSockets(true);
      return new Promise<void>((resolve) => {
        void io.close(() => resolve());
      });
    }
  };
}
