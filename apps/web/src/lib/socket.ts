import { io, type Socket } from "socket.io-client";

import { resolveSocketUrl } from "./runtimeUrls";

const SOCKET_URL = resolveSocketUrl();

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      withCredentials: true
    });
  }

  return socket;
}

export function connectSocket(): void {
  const client = getSocket();
  if (!client.connected) {
    client.connect();
  }
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
  }
}
